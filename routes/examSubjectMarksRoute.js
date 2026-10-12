const express = require('express')
const router = express.Router()
const examSubjectMarksController = require('../controller/examSubjectMarksController')
const authenticate = require('../middleware/authenticate')
const { requireDefaultAcademicYear } = require('../middleware/requireDefaultAcademicYear')

router.get('/get-all-subject-marks', authenticate, examSubjectMarksController.index)
router.get('/get-subject-marks', authenticate, examSubjectMarksController.show)
router.post('/save-subject-marks', authenticate, requireDefaultAcademicYear, examSubjectMarksController.store)
router.delete('/delete-subject-marks', authenticate, examSubjectMarksController.destroy)

module.exports = router

