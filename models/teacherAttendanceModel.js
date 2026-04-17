const mongoose = require('mongoose')

const Schema = mongoose.Schema

const teacherAttendanceSchema = new Schema(
  {
    InstutionCode: { type: String, index: true, required: true },
    TeacherMemberId: { type: String, index: true, required: true },
    TeacherUserId: { type: String, index: true, default: '' },
    TeacherName: { type: String, required: true },
    TeacherUserType: { type: String, default: 'Teacher' },

    // YYYY-MM-DD (institution timezone day key)
    AttendanceDate: { type: String, index: true, required: true },
    PunchInAt: { type: Date, required: true },

    RequestedDayType: {
      type: String,
      enum: ['Full Day', 'Half Day'],
      default: 'Full Day',
    },
    RequestedHalf: {
      type: String,
      enum: ['', '1st Half', '2nd Half'],
      default: '',
    },

    RequestStatus: {
      type: String,
      enum: ['Pending', 'Approved', 'Rejected'],
      default: 'Pending',
      index: true,
    },
    FinalAttendanceStatus: {
      type: String,
      enum: ['Pending', 'Present', 'Absent'],
      default: 'Pending',
      index: true,
    },
    ApprovedDayType: {
      type: String,
      enum: ['', 'Full Day', 'Half Day'],
      default: '',
    },
    ApprovedHalf: {
      type: String,
      enum: ['', '1st Half', '2nd Half'],
      default: '',
    },

    TeacherRemark: { type: String, default: '' },
    AdminRemark: { type: String, default: '' },
    ApprovedByMemberId: { type: String, default: '' },
    ApprovedByName: { type: String, default: '' },
    ApprovedAt: { type: Date, default: null },
  },
  { timestamps: true }
)

teacherAttendanceSchema.index(
  { InstutionCode: 1, TeacherMemberId: 1, AttendanceDate: 1 },
  { unique: true, name: 'unique_teacher_attendance_per_day' }
)

module.exports = mongoose.model('TeacherAttendance', teacherAttendanceSchema)
