const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const { authenticate, authorize } = require('../middlewares/auth');
const { sendToRole } = require('../services/socketService');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;

// Configure multer for media uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads/incidents');
    
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max per file
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|mp4|mov|avi/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = /image\/(jpeg|jpg|png)|video\/(mp4|quicktime|x-msvideo)/.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Seulement les images (JPG, PNG) et vidéos (MP4, MOV) sont autorisées'));
    }
  }
});

// Get all incidents
router.get('/', authenticate, async (req, res) => {
  try {
    const { Incident, User, Event } = require('../models');
    const {
      status,
      severity,
      type,
      eventId,
      startDate,
      endDate,
      page = 1,
      limit = 20
    } = req.query;

    const where = {};

    // Agents can only see their own incidents
    if (req.user.role === 'agent') {
      where.reportedBy = req.user.id;
    }

    if (status) where.status = status;
    if (severity) where.severity = severity;
    if (type) where.type = type;
    if (eventId) where.eventId = eventId;

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt[Op.gte] = new Date(startDate);
      if (endDate) where.createdAt[Op.lte] = new Date(endDate);
    }

    const { count, rows: incidents } = await Incident.findAndCountAll({
      where,
      include: [
        {
          model: User,
          as: 'reporter',
          attributes: ['id', 'firstName', 'lastName', 'employeeId', 'phone']
        },
        {
          model: User,
          as: 'assignee',
          attributes: ['id', 'firstName', 'lastName', 'employeeId']
        },
        {
          model: Event,
          as: 'event',
          attributes: ['id', 'name', 'location']
        }
      ],
      order: [
        ['severity', 'DESC'],
        ['createdAt', 'DESC']
      ],
      limit: parseInt(limit),
      offset: (parseInt(page) - 1) * parseInt(limit)
    });

    res.json({
      success: true,
      data: {
        incidents,
        pagination: {
          total: count,
          page: parseInt(page),
          totalPages: Math.ceil(count / parseInt(limit))
        }
      }
    });
  } catch (error) {
    console.error('Error fetching incidents:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Get incident by ID
router.get('/:id', authenticate, async (req, res) => {
  try {
    const { Incident, User, Event } = require('../models');

    const incident = await Incident.findByPk(req.params.id, {
      include: [
        {
          model: User,
          as: 'reporter',
          attributes: ['id', 'firstName', 'lastName', 'employeeId', 'phone', 'email']
        },
        {
          model: User,
          as: 'assignee',
          attributes: ['id', 'firstName', 'lastName', 'employeeId', 'phone']
        },
        {
          model: User,
          as: 'resolver',
          attributes: ['id', 'firstName', 'lastName']
        },
        {
          model: Event,
          as: 'event',
          attributes: ['id', 'name', 'location']
        }
      ]
    });

    if (!incident) {
      return res.status(404).json({ success: false, message: 'Incident non trouvé' });
    }

    res.json({ success: true, data: incident });
  } catch (error) {
    console.error('Error fetching incident:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Create incident (with media upload support)
router.post('/', authenticate, upload.array('media', 5), async (req, res) => {
  try {
    const { Incident, ActivityLog } = require('../models');

    // Process uploaded media files
    const mediaFiles = req.files ? req.files.map(file => ({
      filename: file.filename,
      originalName: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
      path: `/uploads/incidents/${file.filename}`
    })) : [];

    const incidentData = {
      ...req.body,
      reportedBy: req.user.id,
      // Store uploaded media in the 'photos' JSON column
      photos: mediaFiles.length > 0
        ? JSON.stringify(mediaFiles)
        : (req.body.photos || null)
    };
    // Remove fields not in the model to avoid Sequelize warnings
    delete incidentData.mediaFiles;

    const incident = await Incident.create(incidentData);

    // Log activity
    try {
      await ActivityLog.create({
        userId: req.user.id,
        action: 'INCIDENT_REPORTED',
        entityType: 'incident',
        entityId: incident.id,
        description: `Incident signalé: ${incident.title}`,
        newValues: {
          type: incident.type,
          severity: incident.severity,
          title: incident.title,
          mediaCount: mediaFiles.length
        }
      });
    } catch (logErr) {
      console.warn('ActivityLog warning (non-blocking):', logErr.message);
    }

    // Send real-time notification to admins and supervisors
    sendToRole('admin', 'incident:new', {
      id: incident.id,
      type: incident.type,
      severity: incident.severity,
      title: incident.title,
      description: incident.description,
      reportedBy: `${req.user.firstName || req.user.prenom} ${req.user.lastName || req.user.nom}`,
      timestamp: new Date(),
      mediaCount: mediaFiles.length
    });

    sendToRole('supervisor', 'incident:new', {
      id: incident.id,
      type: incident.type,
      severity: incident.severity,
      title: incident.title,
      description: incident.description,
      reportedBy: `${req.user.firstName || req.user.prenom} ${req.user.lastName || req.user.nom}`,
      timestamp: new Date(),
      mediaCount: mediaFiles.length
    });

    console.log(`🚨 NEW INCIDENT: ${incident.severity} - ${incident.title} (ID: ${incident.id}) by ${req.user.firstName || req.user.prenom} ${req.user.lastName || req.user.nom}, Media files: ${mediaFiles.length}`);

    res.status(201).json({
      success: true,
      message: 'Incident signalé avec succès',
      data: incident
    });
  } catch (error) {
    console.error('Error creating incident:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur', error: error.message });
  }
});

// Alias route for /report (same as POST /)
router.post('/report', authenticate, upload.array('media', 5), async (req, res) => {
  try {
    const { Incident, ActivityLog, Notification } = require('../models');

    const { description, severity, latitude, longitude, address, location, eventId } = req.body;

    // Process uploaded media files
    const mediaFiles = req.files ? req.files.map(file => ({
      filename: file.filename,
      originalName: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
      path: `/uploads/incidents/${file.filename}`
    })) : [];

    const incidentData = {
      title: description ? description.substring(0, 100) : 'Incident signalé',
      description: description,
      severity: severity || 'medium',
      type: 'other', // Type générique pour les signalements terrain
      latitude: latitude ? parseFloat(latitude) : null,
      longitude: longitude ? parseFloat(longitude) : null,
      location: location || address || null, // Priority: zone name (location) then GPS address (address)
      eventId: eventId || null,
      reportedBy: req.user.id,
      mediaFiles: mediaFiles.length > 0 ? JSON.stringify(mediaFiles) : null,
      status: 'reported'
    };

    const incident = await Incident.create(incidentData);

    // Log activity
    await ActivityLog.create({
      userId: req.user.id,
      action: 'INCIDENT_REPORTED',
      entityType: 'incident',
      resourceType: 'incident',
      resourceId: incident.id,
      details: {
        type: 'field_report',
        severity: incident.severity,
        mediaCount: mediaFiles.length,
        hasLocation: !!latitude && !!longitude
      }
    });

    // Send real-time notifications
    const reporterName = `${req.user.firstName || req.user.prenom} ${req.user.lastName || req.user.nom}`;
    
    console.log('🔔 Création notification pour incident...', {
      userId: req.user.id,
      incidentId: incident.id,
      severity: incident.severity
    });
    
    // Create notification for user's history (confirmation)
    try {
      await Notification.create({
        userId: req.user.id,
        type: 'system', // Utiliser 'system' au lieu de 'error'/'warning'/'info'
        title: '🚨 Incident signalé',
        message: `Votre incident "${incident.title}" a été enregistré et transmis aux responsables.`,
        channel: 'in_app',
        status: 'sent',
        metadata: JSON.stringify({
          actionType: 'incident_report',
          incidentId: incident.id,
          severity: incident.severity,
          location: incident.location
        })
      });
      console.log('✅ Notification créée pour historique incident');
    } catch (notifError) {
      console.error('⚠️ Erreur création notification incident:', notifError);
      // Ne pas bloquer la création d'incident si notification échoue
    }
    
    sendToRole('admin', 'incident:new', {
      id: incident.id,
      type: incident.type,
      severity: incident.severity,
      title: incident.title,
      description: incident.description,
      reportedBy: reporterName,
      location: incident.location,
      timestamp: new Date(),
      mediaCount: mediaFiles.length
    });

    sendToRole('responsable', 'incident:new', {
      id: incident.id,
      type: incident.type,
      severity: incident.severity,
      title: incident.title,
      description: incident.description,
      reportedBy: reporterName,
      location: incident.location,
      timestamp: new Date(),
      mediaCount: mediaFiles.length
    });

    console.log(`🚨 FIELD INCIDENT REPORT: ${incident.severity} by ${reporterName} (ID: ${incident.id}), Media: ${mediaFiles.length}`);

    res.status(201).json({
      success: true,
      message: 'Incident signalé avec succès. L\'admin et les responsables ont été notifiés.',
      incident: {
        id: incident.id,
        title: incident.title,
        description: incident.description,
        severity: incident.severity,
        status: incident.status,
        latitude: incident.latitude,
        longitude: incident.longitude,
        location: incident.location,
        mediaFiles: mediaFiles,
        reportedBy: reporterName,
        createdAt: incident.createdAt
      }
    });
  } catch (error) {
    console.error('Error reporting incident:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur lors du signalement de l\'incident',
      error: error.message 
    });
  }
});

// Update incident
router.put('/:id', authenticate, authorize(['admin', 'supervisor', 'responsable']), async (req, res) => {
  try {
    const { Incident, ActivityLog } = require('../models');

    const incident = await Incident.findByPk(req.params.id);
    if (!incident) {
      return res.status(404).json({ success: false, message: 'Incident non trouvé' });
    }

    const previousStatus = incident.status;
    await incident.update(req.body);

    // If status changed to resolved
    if (req.body.status === 'resolved' && previousStatus !== 'resolved') {
      await incident.update({
        resolvedAt: new Date(),
        resolvedBy: req.user.id
      });
    }

    // Log activity
    await ActivityLog.create({
      userId: req.user.id,
      action: 'INCIDENT_UPDATED',
      entityType: 'incident',
      resourceType: 'incident',
      resourceId: incident.id,
      details: {
        changes: req.body,
        previousStatus
      }
    });

    res.json({
      success: true,
      message: 'Incident mis à jour',
      data: incident
    });
  } catch (error) {
    console.error('Error updating incident:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Delete incident
router.delete('/:id', authenticate, authorize(['admin', 'supervisor']), async (req, res) => {
  try {
    const { Incident, ActivityLog } = require('../models');
    const incident = await Incident.findByPk(req.params.id);

    if (!incident) {
      return res.status(404).json({ success: false, message: 'Incident non trouvé' });
    }

    await incident.destroy(); // soft-delete (paranoid: true)

    try {
      await ActivityLog.create({
        userId: req.user.id,
        action: 'INCIDENT_DELETED',
        entityType: 'incident',
        entityId: req.params.id,
        description: `Incident supprimé: ${incident.title}`
      });
    } catch (logErr) {
      console.warn('ActivityLog warning:', logErr.message);
    }

    res.json({ success: true, message: 'Incident supprimé' });
  } catch (error) {
    console.error('Error deleting incident:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Get incident statistics
router.get('/stats/summary', authenticate, authorize(['admin', 'supervisor']), async (req, res) => {
  try {
    const { Incident } = require('../models');
    const { startDate, endDate } = req.query;

    const where = {};
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt[Op.gte] = new Date(startDate);
      if (endDate) where.createdAt[Op.lte] = new Date(endDate);
    }

    const [
      totalIncidents,
      byStatus,
      bySeverity,
      byType
    ] = await Promise.all([
      Incident.count({ where }),
      Incident.findAll({
        where,
        attributes: [
          'status',
          [require('sequelize').fn('COUNT', 'id'), 'count']
        ],
        group: ['status']
      }),
      Incident.findAll({
        where,
        attributes: [
          'severity',
          [require('sequelize').fn('COUNT', 'id'), 'count']
        ],
        group: ['severity']
      }),
      Incident.findAll({
        where,
        attributes: [
          'type',
          [require('sequelize').fn('COUNT', 'id'), 'count']
        ],
        group: ['type'],
        order: [[require('sequelize').fn('COUNT', 'id'), 'DESC']],
        limit: 10
      })
    ]);

    res.json({
      success: true,
      data: {
        total: totalIncidents,
        byStatus: byStatus.reduce((acc, item) => {
          acc[item.status] = parseInt(item.get('count'));
          return acc;
        }, {}),
        bySeverity: bySeverity.reduce((acc, item) => {
          acc[item.severity] = parseInt(item.get('count'));
          return acc;
        }, {}),
        byType: byType.map(item => ({
          type: item.type,
          count: parseInt(item.get('count'))
        }))
      }
    });
  } catch (error) {
    console.error('Error fetching incident stats:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

module.exports = router;
