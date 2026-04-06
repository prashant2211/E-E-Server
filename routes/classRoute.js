const express       = require('express')
const router        = express.Router()

const ClassController = require('../controller/classController');
const authenticate       = require('../middleware/authenticate');

router.get('/', authenticate, ClassController.index)
router.get('/get-all-class', authenticate, ClassController.index)
router.get('/show', authenticate, ClassController.show)
router.post('/show', authenticate, ClassController.show)
router.get('/get-byid-class', authenticate, ClassController.show)
router.post('/get-byid-class', authenticate, ClassController.show)
router.get('/getClasses', authenticate, ClassController.getAllClasses)    
router.get('/getClasse-By-Name', authenticate, ClassController.getClassByName)   // addClassSubjectListDetails
router.post('/addClassSubjectDetails', authenticate, ClassController.addClassSubjectDetails)
router.post('/addClassSubjectListDetails', authenticate, ClassController.addClassSubjectListDetails)
router.get('/getSubjectDetails', authenticate, ClassController.getSubjectDetails)
router.post('/store', authenticate, ClassController.store)
router.post('/class-Register', authenticate, ClassController.store)
router.patch('/update', authenticate, ClassController.update)
router.delete('/delete', authenticate, ClassController.destroy) //deleteSubjectDetails
router.patch('/deleteSubjectDetails', authenticate, ClassController.deleteSubjectDetails)

router.get('/assigned-class-student', authenticate, ClassController.assignedClassStudent)

module.exports = router