const express = require('express');
const router = express.Router();
const attendanceController = require('../controllers/attendanceController');
const { authenticate, authorize } = require('../middlewares/auth');
const { attendanceValidation, validate, uuidParam, paginationQuery } = require('../middlewares/validator');

// All routes require authentication
router.use(authenticate);

// Get device info (IP address)
router.get('/device-info/current', attendanceController.getDeviceInfo);

// Agent routes
router.post('/check-in', attendanceValidation.checkIn, validate, attendanceController.checkIn);
router.post('/check-out/:id', uuidParam(), attendanceValidation.checkOut, validate, attendanceController.checkOut);
router.get('/my-attendance', attendanceController.getMyAttendance);
router.get('/my-history', attendanceController.getMyHistory);
router.get('/my-stats', attendanceController.getMyStats);
router.get('/today-status', attendanceController.getTodayStatus);
router.get('/stats', attendanceController.getAttendanceStats);
router.post('/update-location', attendanceController.updateLocation);

// Get attendance records
router.get('/', paginationQuery, validate, attendanceController.getAttendances);
router.get('/:id', uuidParam(), validate, attendanceController.getAttendanceById);

// Admin/Supervisor routes
router.put('/:id', authorize('admin', 'supervisor'), uuidParam(), validate, attendanceController.updateAttendance);
router.post('/mark-absent', authorize('admin', 'supervisor'), attendanceController.markAbsent);

module.exports = router;
