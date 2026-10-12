const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const timetableSchema = new Schema({
    InstutionCode: {
        type: String,
        required: true,
        index: true
    },
    ClassCode: {
        type: String,
        required: true,
        index: true
    },
    ClassName: {
        type: String,
        required: true
    },
    SectionCode: {
        type: String,
        required: false,
        index: true
    },
    SectionName: {
        type: String,
        required: false
    },
    Day: {
        type: String,
        required: true,
        enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
        index: true
    },
    Period: {
        type: Number,
        required: true,
        min: 1,
        max: 12
    },
    StartTime: {
        type: String,
        required: true
    },
    EndTime: {
        type: String,
        required: true
    },
    Subject: {
        type: String,
        required: true
    },
    Teacher_Code: {
        type: String,
        required: false
    },
    Teacher_Name: {
        type: String,
        required: false
    },
    Teacher_Id: {
        type: Schema.Types.ObjectId,
        ref: 'Teacher',
        required: false
    },
    Room: {
        type: String,
        required: false
    },
    Session: {
        type: String,
        required: true
    },
    Status: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

// Compound index to prevent duplicate periods for same class/section/day
timetableSchema.index({ 
    InstutionCode: 1, 
    ClassCode: 1, 
    SectionCode: 1, 
    Day: 1, 
    Period: 1 
}, { unique: true });

// Index for efficient queries
timetableSchema.index({ InstutionCode: 1, ClassCode: 1, SectionCode: 1, Day: 1 });

const Timetable = mongoose.model('Timetable', timetableSchema);

module.exports = Timetable;

