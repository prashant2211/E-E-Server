const express       = require('express')
const router        = express.Router()

const attendenceRecordController = require('../controller/attendenceRecordController')
const authenticate       = require('../middleware/authenticate')  
const { requireDefaultAcademicYear } = require('../middleware/requireDefaultAcademicYear')

router.get('/get-all-attendence-info', authenticate, attendenceRecordController.index)
router.get('/get-attendence', authenticate, attendenceRecordController.show)
router.post(
  '/attendence-record',
  authenticate,
  requireDefaultAcademicYear,
  attendenceRecordController.store
)
router.get('/studentData', authenticate, attendenceRecordController.getAllStudent)
router.get('/student-attendance', authenticate, attendenceRecordController.getStudentAttendance)

// Analytics
router.get('/analytics/overview', authenticate, attendenceRecordController.getAttendanceOverview)
router.get('/analytics/student-summary', authenticate, attendenceRecordController.getStudentAttendanceSummary)

module.exports = router