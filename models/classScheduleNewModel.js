const mongoose = require('mongoose')

const Schema = mongoose.Schema

// New class scheduling model supporting permanent and temporary schedules
const classScheduleSchema = new Schema(
  {
    InstutionCode: {
      type: String,
      required: true,
      index: true,
    },
    ClassCode: {
      type: String,
      required: true,
      index: true,
    },
    ClassName: {
      type: String,
      required: true,
    },
    SectionCode: {
      type: String,
      default: '',
      index: true,
    },
    SectionName: {
      type: String,
      default: '',
    },
    // PERMANENT = weekly recurring timetable entry
    // TEMPORARY = one-day special schedule for a specific date
    ScheduleType: {
      type: String,
      enum: ['PERMANENT', 'TEMPORARY'],
      required: true,
    },
    // For permanent schedules, use Day (Monday..Sunday)
    Day: {
      type: String,
      enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
      required: function () {
        return this.ScheduleType === 'PERMANENT'
      },
    },
    // For temporary schedules, use a specific calendar date
    ScheduleDate: {
      type: Date,
      required: function () {
        return this.ScheduleType === 'TEMPORARY'
      },
    },
    Period: {
      type: Number,
      required: true,
      min: 1,
      max: 12,
    },
    StartTime: {
      type: String,
      required: true,
    },
    EndTime: {
      type: String,
      required: true,
    },
    Subject: {
      type: String,
      required: true,
    },
    Teacher_Code: {
      type: String,
      default: '',
    },
    Teacher_Name: {
      type: String,
      default: '',
    },
    Teacher_Id: {
      type: Schema.Types.ObjectId,
      ref: 'Teacher',
      default: null,
    },
    Room: {
      type: String,
      default: '',
    },
    Session: {
      type: String,
      required: true,
    },
    Status: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
)

// Allow at most one schedule per period for a given type/day or date
classScheduleSchema.index(
  {
    InstutionCode: 1,
    ClassCode: 1,
    SectionCode: 1,
    ScheduleType: 1,
    Day: 1,
    ScheduleDate: 1,
    Period: 1,
  },
  { unique: true }
)

const ClassSchedule = mongoose.model('ClassScheduleNew', classScheduleSchema)

module.exports = ClassSchedule


