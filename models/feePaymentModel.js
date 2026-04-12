const mongoose = require('mongoose')
const { type } = require('os')

const Schema = mongoose.Schema

const feePaymentSchema = new Schema(
  {
    InstutionId: {
      type: String,
      index: true,
    },
    StudentId: {
      type: String, // Registration Number (or provisional ADM- id for applicants)
      index: true,
    },
    /** When set, this row is an admission application fee (no student record yet) */
    AdmissionMongoId: {
      type: String,
      index: true,
    },
    StudentName: {
      type: String,
    },
    Class: {
      type: String,
    },
    // Core fee breakup for this transaction (mostly informational – base comes from feeStructure)
    TutionFee: {
      type: String,
    },
    LibraryFee: {
      type: String,
    },
    ActivityFee: {
      type: String,
    },
    ExamFee: {
      type: String,
    },
    UniformFee: {
      type: String,
    },
    ProspectusFee: {
      type: String,
    },
    TransportFee: {
      type: String,
    },
    OtherFee: {
      type: String,
    },
    // Amounts
    PaidAmount: {
      type: String, // store as string but treat as number in logic
    },
    PendingAmount: {
      type: String, // student's outstanding amount AFTER this transaction
    },
    ScholarshipAmount: {
      type: String, // scholarship/discount applied in this transaction
      default: '0',
    },
    ConcessionAmount: {
      type: String, // settlement / special concession applied
      default: '0',
    },
    // Period and fee categorisation
    Month: {
      type: String, // e.g. "2026-01"
    },
    AcademicYear: {
      type: String, // e.g. "2025-26"
    },
    FeeType: {
      type: String, // e.g. Monthly, Admission, Transport, Other
    },
    // Payment meta
    PaymentMode: {
      type: String, // Cash, UPI, BankTransfer, Cheque, QR
    },
    PaymentReference: {
      type: String, // UPI ref, transaction ID, cheque no, etc.
    },
    Date: {
      type: String,
    },
    Time: {
      type: String,
    },
    Status: {
      type: String, // Success, Pending, Failed
    },
    /** Student-initiated UPI/online payments awaiting staff verification */
    VerificationStatus: {
      type: String,
      default: '',
      index: true,
    },
    StudentSubmittedPayment: {
      type: Boolean,
      default: false,
      index: true,
    },
    ProofImageKey: {
      type: String,
      default: '',
    },
    ProofImageUrl: {
      type: String,
      default: '',
    },
    VerifiedAt: {
      type: Date,
    },
    VerifiedByName: {
      type: String,
      default: '',
    },
    VerifiedByMemberId: {
      type: String,
      default: '',
    },
    RejectionReason: {
      type: String,
      default: '',
    },
  },
  { timestamps: true }
)

const feePatmentModel = mongoose.model('feePayment', feePaymentSchema)

module.exports = feePatmentModel;