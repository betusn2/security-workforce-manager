const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const { authenticate, authorize } = require('../middlewares/auth');
const { uuidParam, validate, paginationQuery } = require('../middlewares/validator');

// All routes require authentication
router.use(authenticate);

// User routes
router.get('/my-notifications', notificationController.getMyNotifications);
router.get('/unread-count', notificationController.getUnreadCount);
router.put('/:id/read', uuidParam(), validate, notificationController.markAsRead);
router.put('/mark-all-read', notificationController.markAllAsRead);
router.delete('/:id', uuidParam(), validate, notificationController.deleteNotification);

// Mobile push token registration
router.post('/register-push-token', notificationController.registerPushToken);

// Admin routes
router.get('/', authorize('admin'), paginationQuery, validate, notificationController.getAllNotifications);
router.get('/stats', authorize('admin'), notificationController.getNotificationStats);
router.post('/send', authorize('admin', 'supervisor'), notificationController.sendNotification);
router.post('/broadcast', authorize('admin'), notificationController.broadcastNotification);

module.exports = router;
