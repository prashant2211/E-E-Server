const mongoose = require('mongoose')

const Schema = mongoose.Schema

// One document represents a student's enrollment for ONE academic year.
// This is the backbone for year-wise history of class/section, roll, etc.
const studentEnrollmentSchema = new Schema(
  {
    InstutionCode: {
      type: String,
      required: true,
      index: true,
    },
    StudentId: {
      type: String, // Registration_Number (stable across years)
      required: true,
      index: true,
    },
    StudentMongoId: {
      type: String, // _id of studentModel (string to avoid ObjectId coupling issues)
    },
    AcademicYearId: {
      type: String,
      required: true,
      index: true,
    },
    AcademicYearName: {
      type: String, // cached Year_Name like "2025-26"
    },
    ClassCode: {
      type: String,
      required: true,
    },
    ClassName: {
      type: String,
    },
    SectionCode: {
      type: String,
      default: '',
    },
    SectionName: {
      type: String,
      default: '',
    },
    RollNumber: {
      type: String,
      default: '',
    },
    Status: {
      type: String,
      enum: ['Active', 'Promoted', 'Transferred', 'Left', 'PassedOut'],
      default: 'Active',
    },
    PromotionFromEnrollmentId: {
      type: String, // previous year's enrollment _id (string)
    },
    Remarks: {
      type: String,
      default: '',
    },
  },
  { timestamps: true }
)

// One active enrollment per student per academic year
studentEnrollmentSchema.index(
  {
    InstutionCode: 1,
    StudentId: 1,
    AcademicYearId: 1,
  },
  { unique: true }
)

const StudentEnrollment = mongoose.model('StudentEnrollment', studentEnrollmentSchema)

module.exports = StudentEnrollment

