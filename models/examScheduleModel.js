const mongoose = require('mongoose')
const Schema = mongoose.Schema

const examScheduleSchema = new Schema({
    InstutionCode: {
        type: String,
        required: true
    },
    ClassCode: {
        type: String,
        required: true
    },
    ClassName: {
        type: String,
        required: true
    },
    SectionCode: {
        type: String,
        default: ''
    },
    SectionName: {
        type: String,
        default: ''
    },
    ExamName: {
        type: String,
        required: true
    },
    ExamType: {
        type: String,
        required: true
        // e.g., "Mid Term", "Final", "Unit Test", "Quiz"
    },
    Subject: {
        type: String,
        required: true
    },
    ExamDate: {
        type: Date,
        required: true
    },
    StartTime: {
        type: String,
        required: true
        // Format: "10:00 AM" or "HH:MM"
    },
    EndTime: {
        type: String,
        required: true
        // Format: "01:00 PM" or "HH:MM"
    },
    Duration: {
        type: String,
        default: ''
        // e.g., "3 hours", "2 hours 30 minutes"
    },
    MaxMarks: {
        type: Number,
        required: true
    },
    Venue: {
        type: String,
        required: true
        // e.g., "Hall A", "Classroom 101"
    },
    Status: {
        type: String,
        enum: ['Upcoming', 'Ongoing', 'Completed', 'Cancelled'],
        default: 'Upcoming'
    },
    Instructions: {
        type: String,
        default: ''
    },
    TeacherName: {
        type: String,
        default: ''
    },
    TeacherId: {
        type: String,
        default: ''
    }
},
{ timestamps: true }
)

// Indexes for better query performance
examScheduleSchema.index({ InstutionCode: 1, ExamDate: 1 })
examScheduleSchema.index({ InstutionCode: 1, ClassCode: 1 })
examScheduleSchema.index({ InstutionCode: 1, Status: 1 })

const ExamSchedule = mongoose.model('ExamSchedule', examScheduleSchema)

module.exports = ExamSchedule

