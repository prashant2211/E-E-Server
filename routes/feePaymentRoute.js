const express       = require('express')
const router        = express.Router()

const feePaymentController = require('../controller/feePaymentController')
const authenticate       = require('../middleware/authenticate')
const { requireDefaultAcademicYear } = require('../middleware/requireDefaultAcademicYear')

router.get('/get-payment', authenticate, feePaymentController.show)
router.post('/make-payment', authenticate, requireDefaultAcademicYear, feePaymentController.store)
router.post('/record-admission-fee', authenticate, feePaymentController.storeAdmissionFee)
router.get('/get-all-payment', authenticate, feePaymentController.showAllPayment)

// Analytics and reporting
router.get('/analytics/summary', authenticate, feePaymentController.getAnalyticsSummary)
router.get('/analytics/class-pending', authenticate, feePaymentController.getClassPendingList)
router.get('/analytics/student-summary', authenticate, feePaymentController.getStudentSummary)

module.exports = router