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

app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? [process.env.FRONTEND_URL, 'https://chaskibots.com'] 
    : ['http://localhost:3000', 'http://localhost:5173'],
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

// ====== REGISTRO SIMPLIFICADO ======

// Registro básico de estudiantes
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
