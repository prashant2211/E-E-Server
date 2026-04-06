const express       = require('express')
const router        = express.Router()

const staffJobApplyController = require('../controller/staffJobApplyController')
const authenticate       = require('../middleware/authenticate');

router.get('/get-all-form', authenticate, staffJobApplyController.index)
router.get('/form-getby-Id', authenticate, staffJobApplyController.show)
router.post('/form-register', authenticate, staffJobApplyController.store)
router.patch('/form-update', authenticate, staffJobApplyController.update)
router.delete('/form-delete', authenticate, staffJobApplyController.destroy)

module.exports = router