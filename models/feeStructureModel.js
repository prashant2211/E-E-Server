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
    /** One-time admission / registration fee for this class (optional section row) */
    AdmissionFee: {
      type: String,
      default: '0',
    },
    TransportFee: {
      type: String,
    },
    OtherFee: {
      type: String,
    },
    Total: {
      type: String,
    },
  },
  { timestamps: true }
)

feeStructureSchema.index({ InstutionId: 1, Class: 1, Section: 1 }, { unique: true })

const feePatmentModel = mongoose.model('feeStructure', feeStructureSchema)

module.exports = feePatmentModel;