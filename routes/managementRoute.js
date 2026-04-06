const express       = require('express')
const router        = express.Router()

const managementController = require('../controller/managementController');
const authenticate       = require('../middleware/authenticate');

router.get('/get-all-mahagement', authenticate, managementController.index)
router.get('/get-management-info-byId', authenticate, managementController.show)
router.post('/register-management', authenticate, managementController.store)
router.patch('/update-management', authenticate, managementController.update)
router.delete('/delete-management', authenticate, managementController.destroy)

module.exports = router