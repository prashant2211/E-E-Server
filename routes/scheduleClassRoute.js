const express       = require('express')
const router        = express.Router()

const scheduleClassController = require('../controller/scheduleClassController');
const authenticate       = require('../middleware/authenticate');

// router.get('/', authenticate, scheduleClassController.index)
router.get('/show', authenticate, scheduleClassController.getAll)
// router.get('/getClasses', authenticate, scheduleClassController.getAllClasses)
router.post('/store', authenticate, scheduleClassController.store)
// router.patch('/update', authenticate, scheduleClassController.update)
 router.post('/delete', authenticate, scheduleClassController.destroy)

module.exports = router