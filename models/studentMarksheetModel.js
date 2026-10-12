const mongoose      = require('mongoose')
const { type } = require('os')

const Schema        = mongoose.Schema

const studentMarksheetSchema = new Schema({
    Student_Id : {
        type: String,
        required: true,
    }, 
    Class: {
        type: String,
        required: true 
    },
    Instution_Id: {
        type: String,
        required: true
    },
    // Link to academic-year enrollment for full history
    EnrollmentId: {
        type: String,
        index: true
    },
    AcademicYearId: {
        type: String,
        index: true
    },
    Total_Marks: {
        type: Number,
        required: true
    },
    Obtained_Marks: {
        type: Number,
        required: true
    },
    Student_Name: {
        type: String,
        required: true
    },
    Marks : {
        type: Array,
        required: true
    },
    Result : {
        type: String,
        required: true
    },
    Percentage:{
        type: String,
        required: true
    },
    Grade:{
        type: String,
        required: true
    },
    CGPA:{
        type: Number,
        required: true
    },
    Remark: {
        type: String
    },
    Publish: {
        type: Boolean,
        required: true
    },
    Year: {
        type: String,
        required: true
    },
    Exam_type: {
        type: String,
        required: true
    }
    
},
{timestamps:true}
)

const Class = mongoose.model('studentMarksheet',studentMarksheetSchema)

module.exports = Class; 