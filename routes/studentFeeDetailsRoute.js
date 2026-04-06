const express       = require('express')
const router        = express.Router()

const feeDetailController = require('../controller/studentFeeDetailsController')
const authenticate       = require('../middleware/authenticate');

router.get('/get-all-student-fee', authenticate, feeDetailController.index)
router.get('/fee-get-byid', authenticate, feeDetailController.show)
router.post('/fee-Register', authenticate, feeDetailController.store)
router.patch('/update', authenticate, feeDetailController.update)
router.delete('/delete', authenticate, feeDetailController.destroy)

module.exports = router 