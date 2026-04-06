
const express       = require('express')
const router        = express.Router()
const multer        = require('multer')

const StudentController = require('../controller/studentController')
const authenticate       = require('../middleware/authenticate')

const storage = multer.memoryStorage()
const upload = multer({ storage })


router.get('/get-all-student',authenticate, StudentController.index)
router.get('/get-byid-student', authenticate, StudentController.show)
router.get('/get-all-student-list', authenticate, StudentController.getAllStudent)    //getStudentProfile      get student list call via mobile app
router.post('/student-Register', authenticate, StudentController.store)
router.get('/getStudent', authenticate, StudentController.getStudentByRegisterationNumber)
router.get('/getStudentProfile', authenticate, StudentController.getStudentProfile)
router.patch('/update', authenticate, StudentController.update)
router.patch('/deactivate-student', authenticate, authenticate, StudentController.remove)
router.delete('/delete', authenticate, StudentController.destroy)
router.post('/send-credentials', authenticate, StudentController.sendCredentials)
router.post(
  '/upload-photo',
  authenticate,
  upload.single('photo'),
  StudentController.uploadStudentPhoto
)

router.post(
  '/upload-document',
  authenticate,
  upload.single('document'),
  StudentController.uploadStudentDocument
)

router.post(
  '/delete-document',
  authenticate,
  StudentController.deleteStudentDocument
)

module.exports = router 