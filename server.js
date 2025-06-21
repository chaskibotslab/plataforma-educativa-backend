// server.js - Servidor principal de la Plataforma Educativa Chaski
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
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Middleware de seguridad
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

// CORS configurado para desarrollo y producción
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? [process.env.FRONTEND_URL, 'https://chaskibots.com'] 
    : ['http://localhost:3000', 'http://localhost:5173'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Middleware para parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// ====== RUTAS PRINCIPALES ======

// Ruta de salud del sistema
app.get('/', (req, res) => {
  res.json({ 
    message: '🤖 Plataforma Educativa Chaski Bots - API funcionando', 
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    status: 'online',
    environment: process.env.NODE_ENV || 'development'
  });
});

// Health check completo
app.get('/api/health', async (req, res) => {
  try {
    // Probar conexión con Supabase
    const { data, error } = await supabase
      .from('instituciones')
      .select('count(*)')
      .limit(1);
    
    if (error) throw error;
    
    res.json({ 
      status: 'OK',
      database: 'Connected',
      supabase: 'Connected',
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    });
  } catch (error) {
    console.error('❌ Health check failed:', error);
    res.status(500).json({ 
      status: 'ERROR',
      database: 'Disconnected',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// ====== RUTAS DE AUTENTICACIÓN ======

// Registro de estudiantes
app.post('/api/auth/registro-estudiante', async (req, res) => {
  try {
    const { nombre, apellidos, email, password, codigo_institucion, grado } = req.body;

    // Validaciones básicas
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

    // Verificar si el email ya existe
    const { data: existingUser } = await supabase
      .from('usuarios')
      .select('id')
      .eq('email', email)
      .single();

    if (existingUser) {
      return res.status(400).json({ 
        error: 'El email ya está registrado' 
      });
    }

    // Generar código único de estudiante
    const codigo_estudiante = `EST${Date.now()}`;

    // Crear usuario (Supabase Auth manejará el hash de password)
    const { data: authUser, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          nombre,
          apellidos,
          rol: 'estudiante',
          grado,
          codigo_estudiante,
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

    res.status(201).json({
      message: 'Estudiante registrado exitosamente',
      user: {
        id: authUser.user.id,
        email: authUser.user.email,
        nombre,
        apellidos,
        rol: 'estudiante',
        grado,
        codigo_estudiante,
        institucion: institucion.nombre
      }
    });

  } catch (error) {
    console.error('❌ Error en registro:', error);
    res.status(500).json({ 
      error: 'Error interno del servidor' 
    });
  }
});

// Login de usuarios
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
      return res.status(401).json({ 
        error: 'Credenciales inválidas' 
      });
    }

    // Obtener datos adicionales del usuario
    const { data: userData, error: userError } = await supabase
      .from('usuarios')
      .select(`
        *,
        instituciones(nombre)
      `)
      .eq('email', email)
      .single();

    res.json({
      message: 'Login exitoso',
      session: authData.session,
      user: userData || authData.user
    });

  } catch (error) {
    console.error('❌ Error en login:', error);
    res.status(500).json({ 
      error: 'Error interno del servidor' 
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

    if (error) throw error;

    res.json({ niveles: data });
  } catch (error) {
    console.error('❌ Error obteniendo niveles:', error);
    res.status(500).json({ error: 'Error al obtener niveles' });
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

    if (error) throw error;

    res.json({ cursos: data });
  } catch (error) {
    console.error('❌ Error obteniendo cursos:', error);
    res.status(500).json({ error: 'Error al obtener cursos' });
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

    if (error) throw error;

    res.json({ lecciones: data });
  } catch (error) {
    console.error('❌ Error obteniendo lecciones:', error);
    res.status(500).json({ error: 'Error al obtener lecciones' });
  }
});

// Obtener instituciones (para códigos de acceso)
app.get('/api/instituciones', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('instituciones')
      .select('id, nombre, codigo_acceso')
      .eq('activo', true);

    if (error) throw error;

    res.json({ instituciones: data });
  } catch (error) {
    console.error('❌ Error obteniendo instituciones:', error);
    res.status(500).json({ error: 'Error al obtener instituciones' });
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
  console.log(`🔐 JWT Secret: ${process.env.JWT_SECRET ? 'Configurado ✅' : 'NO CONFIGURADO ❌'}`);
  console.log(`🗄️ Database: ${process.env.DATABASE_URL ? 'Configurado ✅' : 'NO CONFIGURADO ❌'}`);
  console.log(`⏰ Iniciado: ${new Date().toISOString()}`);
});

module.exports = { app, supabase };
