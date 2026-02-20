const express = require('express');
const router = express.Router();
const trackingController = require('../controllers/trackingController');
const { authenticate, authorize } = require('../middlewares/auth');

// Toutes les routes necessitent une authentification
router.use(authenticate);

// POST /api/tracking/location - Enregistrer une position
router.post('/location', trackingController.recordLocation);
// Alias /position utilisé par l'app mobile (background task)
router.post('/position', trackingController.recordLocation);

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

// DELETE /api/tracking/purge - Purger l'historique GPS (admin uniquement)
router.delete('/purge', authorize('admin'), async (req, res) => {
  try {
    const { eventId, userId, startDate, endDate, olderThanDays } = req.body;
    const { GeoTracking } = require('../models');
    const { Op } = require('sequelize');

    // Au moins un critère obligatoire
    if (!eventId && !userId && !olderThanDays && !startDate) {
      return res.status(400).json({
        success: false,
        message: 'Au moins un critère requis : eventId, userId, startDate, ou olderThanDays'
      });
    }

    const where = {};
    if (eventId)  where.eventId  = eventId;
    if (userId)   where.userId   = userId;

    if (olderThanDays) {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - parseInt(olderThanDays));
      where.recordedAt = { [Op.lt]: cutoff };
    } else if (startDate && endDate) {
      where.recordedAt = { [Op.between]: [new Date(startDate), new Date(endDate)] };
    } else if (startDate) {
      where.recordedAt = { [Op.gte]: new Date(startDate) };
    } else if (endDate) {
      where.recordedAt = { [Op.lte]: new Date(endDate) };
    }

    // Compter avant suppression
    const count = await GeoTracking.count({ where });

    if (count === 0) {
      return res.json({
        success: true,
        message: 'Aucun enregistrement trouvé avec ces critères',
        data: { deleted: 0 }
      });
    }

    await GeoTracking.destroy({ where });

    // Audit log
    try {
      const { ActivityLog } = require('../models');
      await ActivityLog.create({
        userId: req.user.id,
        action: 'DELETE',
        entityType: 'tracking',
        entityId: eventId || null,
        description: `Purge historique GPS: ${count} entrées supprimées${eventId ? ` (événement #${eventId})` : ''}${userId ? ` (agent #${userId})` : ''}${olderThanDays ? ` (>  ${olderThanDays} jours)` : ''}`,
        status: 'success',
        ipAddress: req.ip,
        newValues: JSON.stringify({ eventId, userId, olderThanDays, startDate, endDate, deleted: count })
      });
    } catch (_) {}

    res.json({
      success: true,
      message: `${count} enregistrement(s) GPS supprimé(s) avec succès`,
      data: { deleted: count }
    });
  } catch (error) {
    console.error('❌ Erreur purge historique GPS:', error.message);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la purge de l\'historique GPS',
      error: error.message
    });
  }
});

// GET /api/tracking/purge/count - Prévisualiser le nombre à supprimer (admin)
router.get('/purge/count', authorize('admin'), async (req, res) => {
  try {
    const { eventId, userId, startDate, endDate, olderThanDays } = req.query;
    const { GeoTracking } = require('../models');
    const { Op } = require('sequelize');

    const where = {};
    if (eventId)  where.eventId  = eventId;
    if (userId)   where.userId   = userId;

    if (olderThanDays) {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - parseInt(olderThanDays));
      where.recordedAt = { [Op.lt]: cutoff };
    } else if (startDate && endDate) {
      where.recordedAt = { [Op.between]: [new Date(startDate), new Date(endDate)] };
    } else if (startDate) {
      where.recordedAt = { [Op.gte]: new Date(startDate) };
    } else if (endDate) {
      where.recordedAt = { [Op.lte]: new Date(endDate) };
    }

    const count = await GeoTracking.count({ where });
    const total = await GeoTracking.count();

    res.json({ success: true, data: { count, total } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
