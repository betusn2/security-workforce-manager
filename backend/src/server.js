require('dotenv').config({ path: '../.env' });

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const { createServer } = require('http');
// ✅ Socket.IO - Migration vers Socket.IO pour temps réel
const { Server } = require('socket.io');

const routes = require('./routes');
const db = require('./models');
const { cleanupDatabaseIndexes } = require('./utils/databaseCleanup');
const { startScheduler } = require('./scheduler');
const socketIOService = require('./services/socketIOService');
const { initScheduledBackupService } = require('./services/scheduledBackupService');
const { initSocketBroadcast } = require('./utils/socketBroadcast');

// Liste des permissions par défaut
const DEFAULT_PERMISSIONS = [
  // Dashboard
  { code: 'dashboard.view', name: 'Voir le tableau de bord', module: 'dashboard', action: 'view' },
  { code: 'dashboard.stats', name: 'Voir les statistiques', module: 'dashboard', action: 'view' },
  // Users
  { code: 'users.view', name: 'Voir les utilisateurs', module: 'users', action: 'view' },
  { code: 'users.create', name: 'Créer des utilisateurs', module: 'users', action: 'create' },
  { code: 'users.update', name: 'Modifier des utilisateurs', module: 'users', action: 'update' },
  { code: 'users.delete', name: 'Supprimer des utilisateurs', module: 'users', action: 'delete' },
  { code: 'users.manage_permissions', name: 'Gérer les permissions', module: 'users', action: 'manage' },
  // Events
  { code: 'events.view', name: 'Voir les événements', module: 'events', action: 'view' },
  { code: 'events.create', name: 'Créer des événements', module: 'events', action: 'create' },
  { code: 'events.update', name: 'Modifier des événements', module: 'events', action: 'update' },
  { code: 'events.delete', name: 'Supprimer des événements', module: 'events', action: 'delete' },
  // Assignments
  { code: 'assignments.view', name: 'Voir les affectations', module: 'assignments', action: 'view' },
  { code: 'assignments.create', name: 'Créer des affectations', module: 'assignments', action: 'create' },
  { code: 'assignments.update', name: 'Modifier des affectations', module: 'assignments', action: 'update' },
  { code: 'assignments.delete', name: 'Supprimer des affectations', module: 'assignments', action: 'delete' },
  // Attendance
  { code: 'attendance.view', name: 'Voir les pointages', module: 'attendance', action: 'view' },
  { code: 'attendance.view_own', name: 'Voir ses propres pointages', module: 'attendance', action: 'view' },
  { code: 'attendance.create', name: 'Créer des pointages', module: 'attendance', action: 'create' },
  { code: 'attendance.update', name: 'Modifier des pointages', module: 'attendance', action: 'update' },
  { code: 'attendance.checkin', name: 'Pointer (check-in/out)', module: 'attendance', action: 'create' },
  // Reports
  { code: 'reports.view', name: 'Voir les rapports', module: 'reports', action: 'view' },
  { code: 'reports.export', name: 'Exporter les rapports', module: 'reports', action: 'export' },
  { code: 'reports.advanced', name: 'Rapports avancés', module: 'reports', action: 'view' },
  // Incidents
  { code: 'incidents.view', name: 'Voir les incidents', module: 'incidents', action: 'view' },
  { code: 'incidents.create', name: 'Signaler des incidents', module: 'incidents', action: 'create' },
  { code: 'incidents.update', name: 'Modifier des incidents', module: 'incidents', action: 'update' },
  { code: 'incidents.resolve', name: 'Résoudre des incidents', module: 'incidents', action: 'update' },
  { code: 'incidents.delete', name: 'Supprimer des incidents', module: 'incidents', action: 'delete' },
  // Notifications
  { code: 'notifications.view', name: 'Voir les notifications', module: 'notifications', action: 'view' },
  { code: 'notifications.send', name: 'Envoyer des notifications', module: 'notifications', action: 'create' },
  { code: 'notifications.broadcast', name: 'Diffuser des notifications', module: 'notifications', action: 'create' },
  // Messages
  { code: 'messages.view', name: 'Voir les messages', module: 'messages', action: 'view' },
  { code: 'messages.send', name: 'Envoyer des messages', module: 'messages', action: 'create' },
  { code: 'messages.broadcast', name: 'Diffuser des messages', module: 'messages', action: 'create' },
  // Tracking
  { code: 'tracking.view', name: 'Voir la géolocalisation', module: 'tracking', action: 'view' },
  { code: 'tracking.view_agents', name: 'Voir position des agents', module: 'tracking', action: 'view' },
  { code: 'tracking.history', name: 'Voir historique positions', module: 'tracking', action: 'view' },
  // SOS
  { code: 'sos.trigger', name: 'Déclencher une alerte SOS', module: 'sos', action: 'create' },
  { code: 'sos.view', name: 'Voir les alertes SOS', module: 'sos', action: 'view' },
  { code: 'sos.respond', name: 'Répondre aux alertes SOS', module: 'sos', action: 'update' },
  // Badges
  { code: 'badges.view', name: 'Voir les badges', module: 'badges', action: 'view' },
  { code: 'badges.award', name: 'Attribuer des badges', module: 'badges', action: 'create' },
  { code: 'badges.manage', name: 'Gérer les badges', module: 'badges', action: 'manage' },
  // Documents
  { code: 'documents.view', name: 'Voir les documents', module: 'documents', action: 'view' },
  { code: 'documents.upload', name: 'Uploader des documents', module: 'documents', action: 'create' },
  { code: 'documents.verify', name: 'Vérifier des documents', module: 'documents', action: 'update' },
  { code: 'documents.delete', name: 'Supprimer des documents', module: 'documents', action: 'delete' },
  // Zones
  { code: 'zones.view', name: 'Voir les zones', module: 'zones', action: 'view' },
  { code: 'zones.create', name: 'Créer des zones', module: 'zones', action: 'create' },
  { code: 'zones.update', name: 'Modifier des zones', module: 'zones', action: 'update' },
  { code: 'zones.delete', name: 'Supprimer des zones', module: 'zones', action: 'delete' },
  { code: 'zones.assign', name: 'Affecter aux zones', module: 'zones', action: 'manage' },
  // Admin
  { code: 'admin.access', name: 'Accéder à l\'espace admin', module: 'admin', action: 'view' },
  { code: 'admin.settings', name: 'Modifier les paramètres', module: 'admin', action: 'manage' },
  { code: 'admin.logs', name: 'Voir les logs d\'activité', module: 'admin', action: 'view' },
  { code: 'admin.permissions', name: 'Gérer les permissions', module: 'admin', action: 'manage' }
];

// Permissions par rôle
const DEFAULT_ROLE_PERMISSIONS = {
  admin: [
    'dashboard.view', 'dashboard.stats',
    'users.view', 'users.create', 'users.update', 'users.delete', 'users.manage_permissions',
    'events.view', 'events.create', 'events.update', 'events.delete',
    'assignments.view', 'assignments.create', 'assignments.update', 'assignments.delete',
    'attendance.view', 'attendance.view_own', 'attendance.create', 'attendance.update', 'attendance.checkin',
    'reports.view', 'reports.export', 'reports.advanced',
    'incidents.view', 'incidents.create', 'incidents.update', 'incidents.resolve', 'incidents.delete',
    'notifications.view', 'notifications.send', 'notifications.broadcast',
    'messages.view', 'messages.send', 'messages.broadcast',
    'tracking.view', 'tracking.view_agents', 'tracking.history',
    'sos.trigger', 'sos.view', 'sos.respond',
    'badges.view', 'badges.award', 'badges.manage',
    'documents.view', 'documents.upload', 'documents.verify', 'documents.delete',
    'zones.view', 'zones.create', 'zones.update', 'zones.delete', 'zones.assign',
    'admin.access', 'admin.settings', 'admin.logs', 'admin.permissions'
  ],
  supervisor: [
    'dashboard.view', 'dashboard.stats',
    'users.view',
    'events.view', 'events.create', 'events.update',
    'assignments.view', 'assignments.create', 'assignments.update',
    'attendance.view', 'attendance.view_own', 'attendance.update', 'attendance.checkin',
    'reports.view', 'reports.export',
    'incidents.view', 'incidents.create', 'incidents.update', 'incidents.resolve',
    'notifications.view', 'notifications.send',
    'messages.view', 'messages.send', 'messages.broadcast',
    'tracking.view', 'tracking.view_agents', 'tracking.history',
    'sos.trigger', 'sos.view', 'sos.respond',
    'badges.view', 'badges.award',
    'documents.view', 'documents.upload', 'documents.verify'
  ],
  agent: [
    'dashboard.view',
    'events.view',
    'assignments.view',
    'attendance.view_own', 'attendance.checkin',
    'incidents.view', 'incidents.create',
    'notifications.view',
    'messages.view', 'messages.send',
    'tracking.view',
    'sos.trigger',
    'badges.view',
    'documents.view', 'documents.upload'
  ],
  user: [
    'dashboard.view',
    'notifications.view',
    'messages.view', 'messages.send'
  ]
};

// Fonction d'initialisation des permissions
const initializeDefaultPermissions = async () => {
  try {
    // Vérifier si les permissions existent déjà
    const permissionCount = await db.Permission.count();
    if (permissionCount > 0) {
      console.log('✅ Permissions already initialized.');
      return;
    }

    console.log('🔧 Initializing default permissions...');

    // Créer toutes les permissions
    for (const perm of DEFAULT_PERMISSIONS) {
      await db.Permission.findOrCreate({
        where: { code: perm.code },
        defaults: perm
      });
    }

    // Créer les permissions par rôle
    for (const [role, permCodes] of Object.entries(DEFAULT_ROLE_PERMISSIONS)) {
      for (const code of permCodes) {
        const permission = await db.Permission.findOne({ where: { code } });
        if (permission) {
          await db.RolePermission.findOrCreate({
            where: { role, permissionId: permission.id },
            defaults: {
              role,
              permissionId: permission.id,
              isActive: true
            }
          });
        }
      }
    }

    console.log('✅ Default permissions initialized successfully.');
  } catch (error) {
    console.error('❌ Error initializing permissions:', error.message);
  }
};

const app = express();
const httpServer = createServer(app);

// ✅ Socket.IO Configuration
const io = new Server(httpServer, {
  cors: {
    origin: [
      'https://security-guard-web.onrender.com',
      'https://security-guard-frontend.onrender.com',
      'https://security-guard-web.vercel.app',
      process.env.FRONTEND_URL || process.env.WEB_URL || 'http://localhost:3000',
      process.env.MOBILE_URL || 'exp://localhost:19000',
      'http://localhost:8081',
      /\.onrender\.com$/,
      /\.vercel\.app$/
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization']
  },
  path: '/socket.io/',
  transports: ['websocket', 'polling'],
  allowEIO3: true,
  pingTimeout: 60000,
  pingInterval: 25000,
  connectTimeout: 60000,
  maxHttpBufferSize: 1e8,
  allowUpgrades: true,
  perMessageDeflate: false
});

// Make io accessible to routes and services
app.set('io', io);

// ✅ Trust proxy (requis pour Render.com et express-rate-limit)
app.set('trust proxy', 1);

// ✅ CORS Configuration pour Socket.IO
// DOIT être le PREMIER middleware
app.use((req, res, next) => {
  // Si c'est une requête Socket.IO, bypass les middlewares Express
  if (req.path && req.path.startsWith('/socket.io/')) {
    console.log('🔌 Socket.IO request detected, bypass middlewares');
    return next();
  }
  next();
});

// Security middleware (DÉSACTIVÉ TEMPORAIREMENT POUR DEBUG WEBSOCKET)
/* app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }, // Permet l'accès cross-origin aux ressources
  crossOriginEmbedderPolicy: false, // Désactive COEP qui peut bloquer les images
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "http://localhost:3000", "http://localhost:5000"], // Autorise les images
      connectSrc: [
        "'self'", 
        "http://localhost:3000", 
        "http://localhost:5000",
        "ws://localhost:5000",  // ✅ WebSocket HTTP
        "wss://localhost:5000"  // ✅ WebSocket HTTPS
      ],
    },
  },
})); */
app.use(cors({
  origin: [
    'https://security-guard-web.onrender.com',
    'https://security-guard-frontend.onrender.com',
    process.env.FRONTEND_URL || process.env.WEB_URL || 'http://localhost:3000',
    process.env.MOBILE_URL || 'exp://localhost:19000',
    'http://localhost:8081'
  ],
  credentials: true
}));

// Rate limiting - Désactivé en développement
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 1000 : 10000, // 1000 en prod, 10000 en dev
  message: {
    success: false,
    message: 'Trop de requêtes, veuillez réessayer plus tard.'
  },
  skip: () => process.env.NODE_ENV !== 'production' // Désactivé en développement
});
app.use('/api/', limiter);

// Auth endpoints have stricter rate limiting (disabled in development)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 100 : 1000, // 100 en prod, 1000 en dev
  message: {
    success: false,
    message: 'Trop de tentatives de connexion, veuillez réessayer plus tard.'
  },
  skip: () => process.env.NODE_ENV !== 'production' // Désactivé en développement
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/login-cin', authLimiter);
app.use('/api/auth/register', authLimiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging
if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Static files (for uploaded photos) avec CORS amélioré pour le frontend
app.use('/uploads', (req, res, next) => {
  // Définir les headers CORS explicitement
  res.header('Access-Control-Allow-Origin', 'http://localhost:3000');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Cross-Origin-Resource-Policy', 'cross-origin');
  
  // Pour les requêtes OPTIONS (preflight)
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
    return;
  }
  
  next();
}, cors({
  origin: [
    process.env.WEB_URL || 'http://localhost:3000',
    process.env.MOBILE_URL || 'exp://localhost:19000',
    'http://localhost:8081'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin']
}), express.static('uploads', {
  setHeaders: (res, path, stat) => {
    // Headers additionnels pour les fichiers statiques
    res.set('Cross-Origin-Resource-Policy', 'cross-origin');
    res.set('Cache-Control', 'public, max-age=31536000'); // Cache pour 1 an
  }
}));

// Diagnostic routes (no auth required)
const diagnostic = require('./routes/diagnostic');
app.use('/diagnostic', diagnostic);

// Admin routes pour notifications avancées
const adminNotifications = require('./routes/adminNotifications');
app.use('/api/admin/notifications', adminNotifications);

// Admin routes pour audit trail
const auditRoutes = require('./routes/audit');
app.use('/api/audit', auditRoutes);

// Admin routes pour sauvegarde/restauration base de données
const databaseBackup = require('./routes/databaseBackup');
app.use('/api/admin/database', databaseBackup);

// API routes
app.use('/api', routes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Security Guard Management API',
    version: '1.0.0',
    documentation: '/api/health'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route non trouvée'
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);

  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Erreur interne du serveur',
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  });
});

// Database connection and server start
const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    // Wait for database creation if needed
    if (db.initPromise) {
      await db.initPromise;
    }

    // Test database connection
    await db.sequelize.authenticate();
    console.log('✅ Database connection established successfully.');

    // Clean up excessive indexes
    await cleanupDatabaseIndexes(db.sequelize);

    // Run enriched tracking migration
    console.log('🔄 Running enriched tracking migration...');
    try {
      const runMigration = require('./migrations/add-enriched-tracking-columns');
      await runMigration();
      console.log('✅ Enriched tracking migration completed.');
    } catch (error) {
      if (error.message && error.message.includes('already exists')) {
        console.log('ℹ️ Migration already applied, skipping.');
      } else {
        console.error('⚠️ Migration error (continuing):', error.message);
      }
    }

    // Sync database (create tables if they don't exist)
    if (process.env.NODE_ENV !== 'production' || process.env.FORCE_DB_SYNC === 'true') {
      await db.sequelize.sync({ alter: false });
      console.log('✅ Database synchronized.');

      // Create default admin user if no users exist
      const userCount = await db.User.count();
      if (userCount === 0) {
        await db.User.create({
          employeeId: 'ADMIN001',
          firstName: 'Admin',
          lastName: 'System',
          email: 'admin@securityguard.com',
          password: 'Admin@123',
          phone: '+33600000000',
          role: 'admin',
          status: 'active'
        });
        console.log('✅ Default admin user created (email: admin@securityguard.com, password: Admin@123)');
      }

      // Initialize default permissions if none exist
      await initializeDefaultPermissions();
      
      // Start scheduler for automatic tasks (will be updated with io instance later)
      // Note: io instance will be passed after server starts listening
      startScheduler();
      
      // Initialize scheduled backup service
      initScheduledBackupService();
    }

    // Start API server
    httpServer.listen(PORT, () => {
      
      console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   🔐 Security Guard Management API                        ║
║                                                           ║
║   Server running on port ${PORT}                             ║
║   Environment: ${process.env.NODE_ENV || 'development'}                           ║
║                                                           ║
║   API URL: http://localhost:${PORT}/api                      ║
║   Health: http://localhost:${PORT}/api/health                ║
║   Socket.IO: http://localhost:${PORT}/socket.io/             ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
      `);
      
      // ✅ Initialize Socket.IO Service AFTER server listening
      socketIOService.initialize(io);
      console.log('✅ Socket.IO Service initialized');
      
      // ✅ Initialize Socket Broadcast for real-time updates
      initSocketBroadcast(io);
      console.log('✅ Socket Broadcast initialized - Real-time updates enabled');
      
      // ✅ Initialize GPS Tracking Service for real-time agent tracking
      const GPSTrackingService = require('./services/gpsTrackingService');
      const gpsTrackingService = new GPSTrackingService(io);
      gpsTrackingService.cleanup(); // Nettoyer les anciens tracking (pas besoin d'await, cleanup est synchrone)
      app.set('gpsTrackingService', gpsTrackingService);
      console.log('✅ GPS Tracking Service initialized - Real-time agent tracking enabled');
      
      // ✅ Redémarrer le scheduler avec l'instance Socket.IO pour la vérification des fenêtres de temps
      startScheduler(io);
      console.log('✅ Scheduler mis à jour avec Socket.IO pour la gestion automatique des fenêtres de temps');
    });
  } catch (error) {
    console.error('❌ Unable to start server:', error);
    process.exit(1);
  }
};

startServer();

// ✅ Socket.IO enabled - export app and io
module.exports = { app, io };
