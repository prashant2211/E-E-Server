const express       = require('express')
const multer        = require('multer')
const router        = express.Router()

const feePaymentController = require('../controller/feePaymentController')
const authenticate       = require('../middleware/authenticate')
const { requireDefaultAcademicYear } = require('../middleware/requireDefaultAcademicYear')

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
})

router.get('/student-fee-due', authenticate, feePaymentController.getStudentFeeDue)
router.get('/get-payment', authenticate, feePaymentController.show)
router.post('/make-payment', authenticate, requireDefaultAcademicYear, feePaymentController.store)
router.post(
  '/generate-monthly-fees',
  authenticate,
  requireDefaultAcademicYear,
  feePaymentController.generateMonthlyFees
)
router.post('/record-admission-fee', authenticate, feePaymentController.storeAdmissionFee)
router.get('/get-all-payment', authenticate, feePaymentController.showAllPayment)

router.post(
  '/student-submit-payment',
  authenticate,
  requireDefaultAcademicYear,
  upload.single('proof'),
  feePaymentController.studentSubmitPayment
)
router.get('/pending-student-payments', authenticate, feePaymentController.listPendingStudentPayments)
router.post('/verify-student-payment', authenticate, feePaymentController.verifyStudentPayment)

// Analytics and reporting
router.get('/analytics/summary', authenticate, feePaymentController.getAnalyticsSummary)
router.get('/analytics/class-pending', authenticate, feePaymentController.getClassPendingList)
router.get('/analytics/student-summary', authenticate, feePaymentController.getStudentSummary)

module.exports = router