const express       = require('express')
const router        = express.Router()

const transferCertificatecontroller = require('../controller/transferCertificatecontroller')
const authenticate       = require('../middleware/authenticate');

// router.get('/get-all-salary_details', transferCertificatecontroller.show)
router.post('/issue-TC', authenticate, transferCertificatecontroller.store)
// router.delete('/payment-delete', staffSalaryDetailsController.destroy)

module.exports = router