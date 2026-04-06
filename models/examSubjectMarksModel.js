const mongoose = require('mongoose')
const Schema = mongoose.Schema

const examSubjectMarksSchema = new Schema({
  InstutionCode: {
    type: String,
    required: true,
  },
  ClassCode: {
    type: String,
    required: true,
  },
  ClassName: {
    type: String,
    required: true,
  },
  SectionCode: {
    type: String,
    default: '',
  },
  SectionName: {
    type: String,
    default: '',
  },
  ExamType: {
    type: String,
    required: true, // e.g., Mid Term, Final, Unit Test
  },
  Subject: {
    type: String,
    required: true,
  },
  ExamDate: {
    type: Date,
  },
  MaxMarks: {
    type: Number,
    required: true,
  },
  Marks: {
    type: [{
      Student_Id: {
        type: String,
        required: true,
      },
      Student_Name: {
        type: String,
        required: true,
      },
      Obtained: {
        type: Number,
        required: true,
        default: 0,
      },
      Status: {
        type: String,
        enum: ['Pass', 'Fail', 'Absent'],
        default: 'Pass',
      },
    }],
    default: [],
  },
  CreatedBy: {
    type: String, // UserId / TeacherId
  },
  CreatedByName: {
    type: String,
  },
}, { timestamps: true })

// Indexes for efficient querying
examSubjectMarksSchema.index({ InstutionCode: 1, ClassCode: 1, SectionCode: 1, ExamType: 1, Subject: 1 }, { unique: true })
examSubjectMarksSchema.index({ InstutionCode: 1, ClassCode: 1, ExamType: 1 })
examSubjectMarksSchema.index({ InstutionCode: 1, ExamType: 1 })

const ExamSubjectMarks = mongoose.model('ExamSubjectMarks', examSubjectMarksSchema)

module.exports = ExamSubjectMarks

