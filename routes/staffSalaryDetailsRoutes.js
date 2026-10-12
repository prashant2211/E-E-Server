const express       = require('express')
const router        = express.Router()

const staffSalaryDetailsController = require('../controller/staffSalaryDetailsController')
const authenticate       = require('../middleware/authenticate');

router.get('/get-all-salary_details', staffSalaryDetailsController.show)
router.post('/salary-store-details', staffSalaryDetailsController.store)
// router.delete('/payment-delete', staffSalaryDetailsController.destroy)

module.exports = router