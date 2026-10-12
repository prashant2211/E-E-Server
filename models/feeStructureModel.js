const mongoose = require('mongoose')
const { type } = require('os')

const Schema = mongoose.Schema

const feeStructureSchema = new Schema(
  {
    InstutionId: {
      type: String,
      index: true,
    },
    // Class label (required)
    Class: {
      type: String,
      required: true,
    },
    // Optional Section label – when set, fee is specific to this section of the class
    Section: {
      type: String,
      default: '',
    },
    TutionFee: {
      type: String,
    },
    TutionFeeFrequency: {
      type: String,
      enum: ['monthly', 'yearly'],
      default: 'monthly',
    },
    LibraryFee: {
      type: String,
    },
    LibraryFeeFrequency: {
      type: String,
      enum: ['monthly', 'yearly'],
      default: 'monthly',
    },
    ActivityFee: {
      type: String,
    },
    ActivityFeeFrequency: {
      type: String,
      enum: ['monthly', 'yearly'],
      default: 'monthly',
    },
    ExamFee: {
      type: String,
    },
    ExamFeeFrequency: {
      type: String,
      enum: ['monthly', 'yearly'],
      default: 'yearly',
    },
    UniformFee: {
      type: String,
    },
    UniformFeeFrequency: {
      type: String,
      enum: ['monthly', 'yearly'],
      default: 'yearly',
    },
    ProspectusFee: {
      type: String,
    },
    ProspectusFeeFrequency: {
      type: String,
      enum: ['monthly', 'yearly'],
      default: 'yearly',
    },
    /** One-time admission / registration fee for this class (optional section row) */
    AdmissionFee: {
      type: String,
      default: '0',
    },
    AdmissionFeeFrequency: {
      type: String,
      enum: ['monthly', 'yearly'],
      default: 'yearly',
    },
    TransportFee: {
      type: String,
    },
    TransportFeeFrequency: {
      type: String,
      enum: ['monthly', 'yearly'],
      default: 'monthly',
    },
    OtherFee: {
      type: String,
    },
    OtherFeeFrequency: {
      type: String,
      enum: ['monthly', 'yearly'],
      default: 'monthly',
    },
    Total: {
      type: String,
    },
    /** Sum of fee heads billed monthly (excludes yearly one-time heads) */
    MonthlyTotal: {
      type: String,
      default: '0',
    },
    /** Sum of fee heads billed once per year */
    YearlyTotal: {
      type: String,
      default: '0',
    },
  },
  { timestamps: true }
)

feeStructureSchema.index({ InstutionId: 1, Class: 1, Section: 1 }, { unique: true })

const feePatmentModel = mongoose.model('feeStructure', feeStructureSchema)

module.exports = feePatmentModel;