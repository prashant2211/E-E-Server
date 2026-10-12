const express       = require('express')
const router        = express.Router()

const userController = require('../controller/userController')
const authenticate       = require('../middleware/authenticate')
const { requireSuperAdmin } = require('../middleware/authorize')

router.get('/get-access', userController.givePermissionAccess);
router.post('/change-password', userController.resetUserPassword)
router.get('/super-admins', authenticate, requireSuperAdmin, userController.listSuperAdmins)
router.delete('/super-admins/:id', authenticate, requireSuperAdmin, userController.deleteSuperAdmin)
// router.delete('/delete-announcement', authenticate, announcementController.destroy)

module.exports = router  