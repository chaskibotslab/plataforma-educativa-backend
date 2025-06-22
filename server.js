// server.js - Servidor simplificado usando solo Supabase client
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3000;

// Configuración de Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Error: Variables de Supabase no configuradas');
  console.error('SUPABASE_URL:', supabaseUrl ? 'Configurado ✅' : 'NO CONFIGURADO ❌');
  console.error('SUPABASE_ANON_KEY:', supabaseKey ? 'Configurado ✅' : 'NO CONFIGURADO ❌');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Middleware
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

// ====== CONFIGURACIÓN CORS CORREGIDA ======
app.use(cors({
  origin: [
    'https://app.chaskibots.com',
    'https://chaskibots.com',
    'http://localhost:3000',
    'http://localhost:5173',
    process.env.FRONTEND_URL
  ].filter(Boolean), // Filtra valores undefined
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// ====== RUTAS PRINCIPALES ======

// Ruta principal
app.get('/', (req, res) => {
  res.json({ 
    message: '🤖 Plataforma Educativa Chaski Bots - API funcionando', 
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    status: 'online',
    environment: process.env.NODE_ENV || 'development'
  });
});

// Health check mejorado
app.get('/api/health', async (req, res) => {
  try {
    // Probar conexión con Supabase usando una consulta simple
    const { data, error } = await supabase
      .from('niveles')
      .select('id')
      .limit(1);
    
    if (error) {
      console.error('❌ Health check error:', error);
      return res.status(500).json({ 
        status: 'ERROR',
        database: 'Disconnected',
        supabase: 'Error',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
    
    res.json({ 
      status: 'OK',
      database: 'Connected',
      supabase: 'Connected',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      dataTest: data ? 'Success' : 'No data but connected'
    });
  } catch (error) {
    console.error('❌ Health check failed:', error);
    res.status(500).json({ 
      status: 'ERROR',
      database: 'Error',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// ====== RUTAS DE DATOS ======

// Obtener niveles educativos
app.get('/api/niveles', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('niveles')
      .select('*')
      .eq('activo', true)
      .order('orden_nivel');

    if (error) {
      console.error('❌ Error obteniendo niveles:', error);
      return res.status(500).json({ 
        error: 'Error al obtener niveles',
        details: error.message 
      });
    }

    res.json({ 
      success: true,
      count: data.length,
      niveles: data 
    });
  } catch (error) {
    console.error('❌ Error obteniendo niveles:', error);
    res.status(500).json({ 
      error: 'Error interno del servidor',
      details: error.message 
    });
  }
});

// Obtener cursos por nivel
app.get('/api/cursos/:nivelId', async (req, res) => {
  try {
    const { nivelId } = req.params;
    
    const { data, error } = await supabase
      .from('cursos')
      .select(`
        *,
        niveles(nombre, descripcion)
      `)
      .eq('nivel_id', nivelId)
      .eq('activo', true)
      .order('orden_curso');

    if (error) {
      console.error('❌ Error obteniendo cursos:', error);
      return res.status(500).json({ 
        error: 'Error al obtener cursos',
        details: error.message 
      });
    }

    res.json({ 
      success: true,
      count: data.length,
      cursos: data 
    });
  } catch (error) {
    console.error('❌ Error obteniendo cursos:', error);
    res.status(500).json({ 
      error: 'Error interno del servidor',
      details: error.message 
    });
  }
});

// Obtener todos los cursos (nuevo endpoint)
app.get('/api/cursos', async (req, res) => {
  try {
    const { nivel } = req.query;
    
    let query = supabase
      .from('cursos')
      .select(`
        *,
        niveles(nombre, descripcion, color, icono)
      `)
      .eq('activo', true)
      .order('orden_curso');

    if (nivel) {
      const { data: nivelData } = await supabase
        .from('niveles')
        .select('id')
        .eq('nombre', nivel)
        .single();
      
      if (nivelData) {
        query = query.eq('nivel_id', nivelData.id);
      }
    }

    const { data, error } = await query;

    if (error) {
      console.error('❌ Error obteniendo cursos:', error);
      return res.status(500).json({ 
        error: 'Error al obtener cursos',
        details: error.message 
      });
    }

    res.json({ 
      success: true,
      count: data.length,
      cursos: data 
    });
  } catch (error) {
    console.error('❌ Error obteniendo cursos:', error);
    res.status(500).json({ 
      error: 'Error interno del servidor',
      details: error.message 
    });
  }
});

// Obtener lecciones de un curso
app.get('/api/lecciones/:cursoId', async (req, res) => {
  try {
    const { cursoId } = req.params;
    
    const { data, error } = await supabase
      .from('lecciones')
      .select('*')
      .eq('curso_id', cursoId)
      .eq('activo', true)
      .order('orden_leccion');

    if (error) {
      console.error('❌ Error obteniendo lecciones:', error);
      return res.status(500).json({ 
        error: 'Error al obtener lecciones',
        details: error.message 
      });
    }

    res.json({ 
      success: true,
      count: data.length,
      lecciones: data 
    });
  } catch (error) {
    console.error('❌ Error obteniendo lecciones:', error);
    res.status(500).json({ 
      error: 'Error interno del servidor',
      details: error.message 
    });
  }
});

// Obtener instituciones
app.get('/api/instituciones', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('instituciones')
      .select('id, nombre, codigo_acceso')
      .eq('activo', true);

    if (error) {
      console.error('❌ Error obteniendo instituciones:', error);
      return res.status(500).json({ 
        error: 'Error al obtener instituciones',
        details: error.message 
      });
    }

    res.json({ 
      success: true,
      count: data.length,
      instituciones: data 
    });
  } catch (error) {
    console.error('❌ Error obteniendo instituciones:', error);
    res.status(500).json({ 
      error: 'Error interno del servidor',
      details: error.message 
    });
  }
});

// ====== AUTENTICACIÓN ======

// Registro mejorado de estudiantes
app.post('/api/auth/registro-estudiante', async (req, res) => {
  try {
    const { nombre, apellidos, email, password, codigo_institucion, grado } = req.body;

    if (!nombre || !apellidos || !email || !password || !codigo_institucion || !grado) {
      return res.status(400).json({ 
        error: 'Todos los campos son requeridos' 
      });
    }

    // Verificar código institucional
    const { data: institucion, error: instError } = await supabase
      .from('instituciones')
      .select('id, nombre')
      .eq('codigo_acceso', codigo_institucion)
      .eq('activo', true)
      .single();

    if (instError || !institucion) {
      return res.status(400).json({ 
        error: 'Código de institución inválido' 
      });
    }

    // Crear usuario con Supabase Auth
    const { data: authUser, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          nombre,
          apellidos,
          rol: 'estudiante',
          grado,
          institucion_id: institucion.id
        }
      }
    });

    if (authError) {
      console.error('Auth error:', authError);
      return res.status(400).json({ 
        error: 'Error al crear usuario: ' + authError.message 
      });
    }

    // Crear registro en tabla usuarios
    const { data: dbUser, error: dbError } = await supabase
      .from('usuarios')
      .insert([{
        id: authUser.user.id, // Usar el mismo ID de auth
        institucion_id: institucion.id,
        nombre,
        apellidos,
        email,
        password_hash: 'managed_by_supabase_auth', // Placeholder
        rol: 'estudiante',
        grado,
        activo: true
      }])
      .select()
      .single();

    if (dbError) {
      console.error('DB insert error:', dbError);
      // Si falla la inserción en la tabla, continuar igual
      console.log('Usuario creado en auth, pero no en tabla usuarios');
    }

    res.status(201).json({
      success: true,
      message: 'Estudiante registrado exitosamente',
      user: {
        id: authUser.user.id,
        email: authUser.user.email,
        nombre,
        apellidos,
        rol: 'estudiante',
        grado,
        institucion: institucion.nombre
      }
    });

  } catch (error) {
    console.error('❌ Error en registro:', error);
    res.status(500).json({ 
      error: 'Error interno del servidor',
      details: error.message 
    });
  }
});

// Login de estudiantes
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ 
        error: 'Email y contraseña son requeridos' 
      });
    }

    // Autenticar con Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (authError) {
      console.error('Login error:', authError);
      return res.status(401).json({ 
        error: 'Credenciales inválidas' 
      });
    }

    // Buscar información adicional del usuario en la tabla usuarios
    const { data: userData, error: userError } = await supabase
      .from('usuarios')
      .select(`
        id, nombre, apellidos, rol, grado, activo,
        instituciones(nombre, codigo_acceso)
      `)
      .eq('email', email)
      .eq('activo', true)
      .single();

    if (userError) {
      console.log('No user data found in usuarios table, using auth data');
      // Si no hay datos en la tabla usuarios, usar datos de auth
      res.json({
        success: true,
        message: 'Login exitoso',
        user: {
          id: authData.user.id,
          email: authData.user.email,
          nombre: authData.user.user_metadata.nombre || 'Usuario',
          apellidos: authData.user.user_metadata.apellidos || '',
          rol: authData.user.user_metadata.rol || 'estudiante',
          grado: authData.user.user_metadata.grado || 'sin-grado'
        },
        session: authData.session
      });
    } else {
      // Usar datos de la tabla usuarios
      res.json({
        success: true,
        message: 'Login exitoso',
        user: {
          id: userData.id,
          email: email,
          nombre: userData.nombre,
          apellidos: userData.apellidos,
          rol: userData.rol,
          grado: userData.grado,
          institucion: userData.instituciones?.nombre || 'Sin institución'
        },
        session: authData.session
      });
    }

  } catch (error) {
    console.error('❌ Error en login:', error);
    res.status(500).json({ 
      error: 'Error interno del servidor',
      details: error.message 
    });
  }
});

// Verificar sesión actual
app.get('/api/auth/me', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'Token no proporcionado' });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({ error: 'Token inválido' });
    }

    // Buscar datos adicionales en la tabla usuarios
    const { data: userData } = await supabase
      .from('usuarios')
      .select(`
        nombre, apellidos, rol, grado,
        instituciones(nombre)
      `)
      .eq('id', user.id)
      .single();

    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        nombre: userData?.nombre || user.user_metadata.nombre || 'Usuario',
        apellidos: userData?.apellidos || user.user_metadata.apellidos || '',
        rol: userData?.rol || user.user_metadata.rol || 'estudiante',
        grado: userData?.grado || user.user_metadata.grado || 'sin-grado',
        institucion: userData?.instituciones?.nombre
      }
    });

  } catch (error) {
    console.error('❌ Error verificando sesión:', error);
    res.status(500).json({ 
      error: 'Error interno del servidor',
      details: error.message 
    });
  }
});

// Logout
app.post('/api/auth/logout', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      await supabase.auth.signOut(token);
    }

    res.json({
      success: true,
      message: 'Logout exitoso'
    });

  } catch (error) {
    console.error('❌ Error en logout:', error);
    res.status(500).json({ 
      error: 'Error interno del servidor',
      details: error.message 
    });
  }
});

// ====== MANEJO DE ERRORES ======

// Middleware de manejo de errores
app.use((err, req, res, next) => {
  console.error('❌ Error no manejado:', err.stack);
  res.status(500).json({ 
    error: 'Algo salió mal!',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Error interno del servidor'
  });
});

// Ruta 404
app.use('*', (req, res) => {
  res.status(404).json({ 
    error: 'Ruta no encontrada',
    path: req.originalUrl 
  });
});

// ====== INICIAR SERVIDOR ======
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`📡 Supabase URL: ${supabaseUrl ? 'Configurado ✅' : 'NO CONFIGURADO ❌'}`);
  console.log(`🔑 Supabase Key: ${supabaseKey ? 'Configurado ✅' : 'NO CONFIGURADO ❌'}`);
  console.log(`⏰ Iniciado: ${new Date().toISOString()}`);
});

module.exports = { app, supabase };
