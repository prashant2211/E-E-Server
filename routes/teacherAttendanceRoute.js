const express = require('express')
const router = express.Router()
const authenticate = require('../middleware/authenticate')
const teacherAttendanceController = require('../controller/teacherAttendanceController')

// Teacher app endpoints
router.post('/punch-in', authenticate, teacherAttendanceController.markTeacherAttendance)
router.get('/my-history', authenticate, teacherAttendanceController.getMyTeacherAttendanceHistory)
router.get('/my-summary', authenticate, teacherAttendanceController.getMyTeacherAttendanceSummary)

// Admin approval endpoints
router.get('/admin/requests', authenticate, teacherAttendanceController.listTeacherAttendanceRequests)
router.patch(
  '/admin/requests/:id/decision',
  authenticate,
  teacherAttendanceController.decideTeacherAttendanceRequest
)
router.get(
  '/admin/teacher-history',
  authenticate,
  teacherAttendanceController.getTeacherAttendanceHistoryForAdmin
)

module.exports = router
