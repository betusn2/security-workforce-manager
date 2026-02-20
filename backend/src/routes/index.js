const express = require('express');
const router = express.Router();

// Import route modules
const authRoutes = require('./auth');
const userRoutes = require('./users');
const eventRoutes = require('./events');
const assignmentRoutes = require('./assignments');
const attendanceRoutes = require('./attendance');
const notificationRoutes = require('./notifications');
const reportRoutes = require('./reports');
const incidentRoutes = require('./incidents');
const badgeRoutes = require('./badges');
const documentRoutes = require('./documents');

// V2 Routes - Systeme Intelligent
const trackingRoutes = require('./tracking');
const messageRoutes = require('./messages');
const quickAddRoutes = require('./quickAdd');
const sosRoutes = require('./sos');

// V3 Routes - Permissions System
const permissionRoutes = require('./permissions');

// V4 Routes - Zone System
const zoneRoutes = require('./zones');

// V5 Routes - Supervisor Management
const supervisorRoutes = require('./supervisor');

// V6 Routes - Maintenance System
const maintenanceRoutes = require('./maintenance');

// V7 Routes - Creation History System
const creationHistoryRoutes = require('./creationHistory');

// V8 Routes - API Documentation
const apiDocumentationRoutes = require('./apiDocumentation');

// Additional Routes - Advanced Features
const analyticsRoutes = require('./analyticsRoutes');
const faceRecognitionRoutes = require('./faceRecognitionRoutes');
const databaseBackupRoutes = require('./databaseBackup');
const adminNotificationsRoutes = require('./adminNotifications');
const auditRoutes = require('./audit');
const mapRoutes = require('./mapRoutes');
const whatsappRoutes = require('./whatsappRoutes');
const diagnosticRoutes = require('./diagnostic');
const attendanceDuplicateRoutes = require('./attendanceDuplicateRoutes');

// Mount routes
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/events', eventRoutes);
router.use('/assignments', assignmentRoutes);
router.use('/attendance', attendanceRoutes);
router.use('/notifications', notificationRoutes);
router.use('/reports', reportRoutes);
router.use('/incidents', incidentRoutes);
router.use('/badges', badgeRoutes);
router.use('/documents', documentRoutes);

// V2 Routes
router.use('/tracking', trackingRoutes);
router.use('/messages', messageRoutes);
router.use('/quick-add', quickAddRoutes);
router.use('/sos', sosRoutes);

// V3 Routes
router.use('/permissions', permissionRoutes);

// V4 Routes
router.use('/zones', zoneRoutes);

// V5 Routes
router.use('/supervisor', supervisorRoutes);

// V6 Routes
router.use('/maintenance', maintenanceRoutes);

// V7 Routes
router.use('/creation-history', creationHistoryRoutes);

// V8 Routes
router.use('/api-docs', apiDocumentationRoutes);

// Additional Routes - Advanced Features
router.use('/analytics', analyticsRoutes);
router.use('/face-recognition', faceRecognitionRoutes);
router.use('/database-backup', databaseBackupRoutes);
router.use('/admin/database', databaseBackupRoutes); // alias utilisé par le frontend
router.use('/admin-notifications', adminNotificationsRoutes);
router.use('/audit', auditRoutes);
router.use('/map', mapRoutes);
router.use('/whatsapp', whatsappRoutes);
router.use('/diagnostic', diagnosticRoutes);
router.use('/attendance-duplicate', attendanceDuplicateRoutes);

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'API Security Guard Management is running',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

module.exports = router;
