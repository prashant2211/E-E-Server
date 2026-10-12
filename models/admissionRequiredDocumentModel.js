const mongoose = require('mongoose')

const Schema = mongoose.Schema

const admissionRequiredDocumentSchema = new Schema(
  {
    InstutionCode: {
      type: String,
      required: true,
      index: true,
    },
    Class_Name: {
      type: String,
      required: true,
      index: true,
    },
    Documents: {
      type: [String],
      default: [],
    },
  },
  { timestamps: true }
)

admissionRequiredDocumentSchema.index(
  { InstutionCode: 1, Class_Name: 1 },
  { unique: true }
)

module.exports = mongoose.model(
  'AdmissionRequiredDocument',
  admissionRequiredDocumentSchema
)
