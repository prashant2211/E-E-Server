const express       = require('express')
const router        = express.Router()

const staffSalaryDetailsController = require('../controller/staffSalaryPaymentDetailsController')
const authenticate       = require('../middleware/authenticate');

// router.get('/get-all-salary_payment_details', staffSalaryDetailsController.show)
router.post('/pay_salary', staffSalaryDetailsController.store)
// router.delete('/payment-delete', staffSalaryDetailsController.destroy)

module.exports = router