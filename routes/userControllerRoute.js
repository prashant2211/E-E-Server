const express       = require('express')
const router        = express.Router()

const userController = require('../controller/userController')
const authenticate       = require('../middleware/authenticate')

router.get('/get-access', userController.givePermissionAccess);
router.post('/change-password', userController.resetUserPassword)
// router.delete('/delete-announcement', authenticate, announcementController.destroy)

module.exports = router  