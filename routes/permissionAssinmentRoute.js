const express       = require('express')
const router        = express.Router()

const permissionAssinment = require('../controller/permissionAssinment');
const authenticate       = require('../middleware/authenticate');

router.post('/create-permission', authenticate, permissionAssinment.createPermissionSet) 
router.get('/check-access', authenticate, permissionAssinment.permissionAccess)
router.get('/check-all-access', authenticate, permissionAssinment.getAllPermissions)
router.get('/get-permission', authenticate, permissionAssinment.checkPermissions)
router.post('/get-permission-json', authenticate, permissionAssinment.givePermissionAccess)
// router.patch('/update-permission', authenticate, permissionAssinment.updatePermissionSet)
// router.delete('/delete-permission', authenticate, permissionAssinment.deletePermissionSet)
module.exports = router

