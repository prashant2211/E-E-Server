const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/authenticate');
const reportsController = require('../controller/reportsController');

// Attendance Reports
router.get('/attendance-report', authenticate, reportsController.getAttendanceReport);
router.get('/student-attendance-report', authenticate, reportsController.getStudentAttendanceReport);

// Academic Reports
router.get('/academic-report', authenticate, reportsController.getAcademicReport);
router.get('/student-academic-report', authenticate, reportsController.getStudentAcademicReport);

// Fee Reports
router.get('/fee-collection-report', authenticate, reportsController.getFeeCollectionReport);

// Class Reports
router.get('/class-report', authenticate, reportsController.getClassReport);

// Statistics
router.get('/student-statistics', authenticate, reportsController.getStudentStatistics);
router.get('/dashboard-data', authenticate, reportsController.getDashboardData);

module.exports = router;

