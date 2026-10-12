const express       = require('express')
const router        = express.Router()

const adminissionController = require('../controller/admissionInquaryController')
const authenticate       = require('../middleware/authenticate')

router.get('/get-all-admission-info', authenticate, adminissionController.getEnquiriesRec)
 router.get('/get-admission-inquery', authenticate, adminissionController.index)
router.post('/add-Enquary', adminissionController.store)
// router.patch('/update-admission-info', authenticate, adminissionController.update)
// router.delete('/deleteadmission-info', authenticate, adminissionController.destroy)

module.exports = router