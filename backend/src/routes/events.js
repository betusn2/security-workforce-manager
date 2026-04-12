const express = require('express');
const router = express.Router();
const eventController = require('../controllers/eventController');
const phaseController = require('../controllers/phaseController');
const { authenticate, authorize } = require('../middlewares/auth');
const { eventValidation, validate, uuidParam, paginationQuery } = require('../middlewares/validator');

// All routes require authentication
router.use(authenticate);

// Routes spécifiques (DOIVENT être AVANT /:id pour éviter les conflits)
router.get('/my-events', eventController.getMyEvents);
router.get('/today', eventController.getTodayEvents);

// Get events with filters
router.get('/', paginationQuery, validate, eventController.getEvents);

// Routes avec ID - Les routes spécifiques AVANT la route générique /:id
router.get('/:id/notification-stats', uuidParam(), validate, eventController.getEventNotificationStats);
router.get('/:id/stats', uuidParam(), validate, eventController.getEventStats);
router.get('/:id/chronology', uuidParam(), validate, eventController.getEventChronology);

// ── Phase management routes (responsable) ──────────────────────────────────
router.get('/:id/phases', uuidParam(), validate, phaseController.getPhaseStatus);
router.post('/:id/phases/:phase/confirm', authorize('admin', 'supervisor'), uuidParam(), validate, phaseController.confirmPhase);
router.post('/:id/phases/setup/zones', authorize('admin', 'supervisor'), uuidParam(), validate, phaseController.confirmSetupZones);
router.get('/:id/supervised-agents', uuidParam(), validate, phaseController.getSupervisedAgents);

// Get event by ID (DOIT être APRÈS toutes les autres routes /:id/*)
router.get('/:id', uuidParam(), validate, eventController.getEventById);

// Admin/Supervisor routes
router.post('/', authorize('admin', 'supervisor'), eventValidation.create, validate, eventController.createEvent);
router.put('/:id', authorize('admin', 'supervisor'), uuidParam(), eventValidation.update, validate, eventController.updateEvent);
router.delete('/:id', authorize('admin'), uuidParam(), validate, eventController.deleteEvent);

module.exports = router;
