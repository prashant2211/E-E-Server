const express       = require('express')
const router        = express.Router()
const TeacherController = require('../controller/teacherController')
const authenticate       = require('../middleware/authenticate')


router.get('/get-all-Teacher',authenticate,TeacherController.index)
router.get('/get-Teacher-name-list',authenticate,TeacherController.getTeacher)  //getTeacherByIdName
router.get('/getTeacherProfile',authenticate,TeacherController.getTeacherProfile)
router.get('/available-teacher-users',authenticate,TeacherController.getAvailableTeacherUsers)
router.get('/:id',authenticate, TeacherController.show)
router.post('/teacher-Register',authenticate, TeacherController.store)
router.patch('/update',authenticate, TeacherController.update)
router.patch('/deactive-teacher', authenticate, TeacherController.remove)
router.delete('/delete',authenticate, TeacherController.destroy)

module.exports = router