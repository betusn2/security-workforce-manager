const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authenticate, authorize } = require('../middlewares/auth');
const { userValidation, validate, uuidParam, paginationQuery } = require('../middlewares/validator');

// All routes require authentication
router.use(authenticate);

// Routes de vérification d'unicité en temps réel
router.get('/check-email', userController.checkEmailUnique);
router.get('/check-cin', userController.checkCinUnique);
router.get('/check-phone', userController.checkPhoneUnique);

// Search user by CIN (for check-in) - Accessible à tous les agents authentifiés
router.get('/search/cin/:cin', userController.searchByCin);

// Get all supervisors (supervisors and admins who can manage agents)
router.get('/supervisors', authorize('admin', 'supervisor'), userController.getSupervisors);

// Get all agents (for supervisors and admins)
router.get('/agents', authorize('admin', 'supervisor'), userController.getAgents);

// Get agents supervised by a specific supervisor
router.get('/supervised/:id?', authorize('admin', 'supervisor'), userController.getSupervisedAgents);

// Get user statistics
router.get('/stats/:id?', userController.getUserStats);

// Admin only routes
router.get('/', authorize('admin', 'supervisor'), paginationQuery, validate, userController.getUsers);
router.post('/', authorize('admin'), userValidation.create, validate, userController.createUser);

// Get, update, delete specific user
router.get('/:id', uuidParam(), validate, userController.getUserById);
router.put('/:id', authorize('admin', 'supervisor'), uuidParam(), userValidation.update, validate, userController.updateUser);
router.delete('/:id', authorize('admin'), uuidParam(), validate, userController.deleteUser);

// Admin only - reset password
router.post('/:id/reset-password', authorize('admin'), uuidParam(), validate, userController.resetPassword);

// Facial vector routes (for face recognition)
router.get('/:id/facial-vector', authorize('admin', 'supervisor'), uuidParam(), validate, userController.getFacialVector);
router.put('/:id/facial-vector', authorize('admin', 'supervisor'), uuidParam(), validate, userController.updateFacialVector);

module.exports = router;
