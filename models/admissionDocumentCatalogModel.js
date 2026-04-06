const mongoose = require('mongoose')

const Schema = mongoose.Schema

const admissionDocumentCatalogSchema = new Schema(
  {
    InstutionCode: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    DocumentNames: {
      type: [String],
      default: [],
    },
  },
  { timestamps: true }
)

module.exports = mongoose.model('AdmissionDocumentCatalog', admissionDocumentCatalogSchema)
