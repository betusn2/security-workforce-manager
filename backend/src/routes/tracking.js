const express = require('express');
const router = express.Router();
const trackingController = require('../controllers/trackingController');
const { authenticate, authorize } = require('../middlewares/auth');

// Toutes les routes necessitent une authentification
router.use(authenticate);

// POST /api/tracking/location - Enregistrer une position
router.post('/location', trackingController.recordLocation);

// POST /api/tracking/validate - Valider une position par rapport a un evenement
router.post('/validate', trackingController.validatePosition);

// GET /api/tracking/user/:userId/history - Historique des positions d'un utilisateur
router.get('/user/:userId/history', trackingController.getUserHistory);

// GET /api/tracking/event/:eventId/live - Positions en temps reel pour un evenement
router.get('/event/:eventId/live', authorize('admin', 'supervisor'), trackingController.getEventLivePositions);

// GET /api/tracking/all/live - Toutes les positions en temps reel (admin)
router.get('/all/live', authorize('admin'), trackingController.getAllLivePositions);

// NEW ROUTES - Suivi temps réel et alertes
// GET /api/tracking/realtime/:eventId - Positions temps réel pour un événement
router.get('/realtime/:eventId', authorize('admin', 'supervisor'), trackingController.getRealtimePositions);

// GET /api/tracking/alerts - Récupérer les alertes de tracking
router.get('/alerts', authorize('admin', 'supervisor'), trackingController.getTrackingAlerts);

// PATCH /api/tracking/alerts/:alertId/resolve - Résoudre une alerte
router.patch('/alerts/:alertId/resolve', authorize('admin', 'supervisor'), trackingController.resolveAlert);

// ✅ NOUVELLES ROUTES - Tracking GPS en temps réel (chaque seconde)
// POST /api/tracking/update-position - Mettre à jour position GPS (appelé chaque seconde)
router.post('/update-position', async (req, res) => {
  try {
    const { latitude, longitude, accuracy, batteryLevel, isMoving } = req.body;
    const gpsTrackingService = req.app.get('gpsTrackingService');

    if (!gpsTrackingService) {
      return res.status(500).json({
        success: false,
        message: 'Service de tracking GPS non disponible'
      });
    }

    const positionData = {
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
      accuracy: accuracy ? parseFloat(accuracy) : null,
      batteryLevel: batteryLevel ? parseInt(batteryLevel) : 100,
      isMoving: isMoving || false
    };

    await gpsTrackingService.updatePosition(req.user.id, positionData);

    res.json({
      success: true,
      message: 'Position mise à jour'
    });
  } catch (error) {
    console.error('❌ Erreur mise à jour position:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour de la position',
      error: error.message
    });
  }
});

// GET /api/tracking/active-agents/:eventId - Agents actuellement en tracking
router.get('/active-agents/:eventId', authorize('admin', 'supervisor'), async (req, res) => {
  try {
    const { eventId } = req.params;
    const gpsTrackingService = req.app.get('gpsTrackingService');

    if (!gpsTrackingService) {
      return res.status(500).json({
        success: false,
        message: 'Service de tracking GPS non disponible'
      });
    }

    const activeAgents = gpsTrackingService.getActiveAgents(eventId);

    res.json({
      success: true,
      data: activeAgents
    });
  } catch (error) {
    console.error('❌ Erreur récupération agents actifs:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des agents actifs',
      error: error.message
    });
  }
});

// GET /api/tracking/history/:userId/:eventId - Historique trajets d'un agent
router.get('/history/:userId/:eventId', async (req, res) => {
  try {
    const { userId, eventId } = req.params;
    const { startDate, endDate } = req.query;

    // Vérifier permissions (admin/supervisor/own data)
    if (req.user.role !== 'admin' && req.user.role !== 'supervisor' && req.user.id !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Accès refusé'
      });
    }

    // Query GeoTracking directly - no dependency on gpsTrackingService
    const { GeoTracking, User } = require('../models');
    const { Op } = require('sequelize');

    const where = { userId, eventId };
    if (startDate && endDate) {
      where.recordedAt = { [Op.between]: [new Date(startDate), new Date(endDate)] };
    }

    const history = await GeoTracking.findAll({
      where,
      order: [['recordedAt', 'ASC']],
      attributes: [
        'id', 'latitude', 'longitude', 'accuracy', 'speed', 'heading',
        'batteryLevel', 'batteryStatus', 'isWithinGeofence', 'distanceFromEvent',
        'recordedAt', 'isMoving', 'networkType', 'deviceType', 'isMockLocation'
      ],
      include: [{
        model: User,
        as: 'user',
        attributes: ['id', 'firstName', 'lastName', 'cin', 'employeeId'],
        required: false
      }]
    });

    console.log(`✅ Historique tracking: ${history.length} positions pour agent ${userId}`);

    res.json({
      success: true,
      data: history
    });
  } catch (error) {
    console.error('❌ Erreur récupération historique:', error.message);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération de l\'historique',
      error: error.message
    });
  }
});

module.exports = router;
