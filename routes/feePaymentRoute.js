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
router.get('/advance-fee-quote', authenticate, feePaymentController.getAdvanceFeeQuote)
router.get('/advance-fee-records', authenticate, feePaymentController.listAdvanceFeeRecords)
router.post(
  '/collect-advance-fee',
  authenticate,
  requireDefaultAcademicYear,
  feePaymentController.collectAdvanceFee
)
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
router.get(
  '/analytics/summary',
  authenticate,
  (req, res, next) => {
    res.set({
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      Pragma: 'no-cache',
      Expires: '0',
    })
    next()
  },
  feePaymentController.getAnalyticsSummary
)
router.get('/analytics/class-pending', authenticate, feePaymentController.getClassPendingList)
router.get('/analytics/class-export', authenticate, feePaymentController.getClassFeeExportData)
router.get('/analytics/student-summary', authenticate, feePaymentController.getStudentSummary)
router.get('/demand-slip', authenticate, feePaymentController.getFeeDemandSlips)
router.post('/demand-slips', authenticate, feePaymentController.getFeeDemandSlips)

module.exports = router