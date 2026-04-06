
const express       = require('express')
const router        = express.Router()

const StudentMarksheetController = require('../controller/studentMarksheetController')
const authenticate       = require('../middleware/authenticate')
const { requireDefaultAcademicYear } = require('../middleware/requireDefaultAcademicYear')


router.get('/get-all-marksheet',authenticate, StudentMarksheetController.index)
router.get('/get-byid-marksheet', authenticate, StudentMarksheetController.show) 
router.get('/getMarksbyregNum', authenticate, StudentMarksheetController.getMarksbyregNum)
router.post('/add-marks', authenticate, requireDefaultAcademicYear, StudentMarksheetController.store)
router.post('/store-marks', authenticate, requireDefaultAcademicYear, StudentMarksheetController.addMarks)
router.patch('/update-marks', authenticate, StudentMarksheetController.update)
router.post('/publish-marks', authenticate, requireDefaultAcademicYear, StudentMarksheetController.publishMarks)
router.get('/get-marks', authenticate, StudentMarksheetController.getMarks)
router.get('/get-student-marks', authenticate, StudentMarksheetController.getStudentMarks)  // this route is for student app
router.post('/generate-marksheets', authenticate, requireDefaultAcademicYear, StudentMarksheetController.generateMarksheets)
router.delete('/delete', authenticate, StudentMarksheetController.destroy)  

module.exports = router 