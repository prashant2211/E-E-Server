const mongoose      = require('mongoose')
const { type } = require('os')

const Schema        = mongoose.Schema

const attendenceRecordSchema = new Schema({
    Class_Code:{
        type: String
    },
    Attendence : {
        type: Array
    },
    Subject : {
        type: String
    },
    Subject_Teacher : {
        type: String
    },
    InstutionId:{
        type: String
    },
    Date: {
        type: String
    },
    Time: {
        type: String
    },
    // Academic-year aware fields (optional for backward compatibility)
    AcademicYearId: {
        type: String,
        index: true
    },
    AcademicYearName: {
        type: String
    }
},
{timestamps:true}
)
//attendenceRecordSchema.index({ Class_Code: 1}, { unique: true });

const attendence = mongoose.model('AttendenceRecord',attendenceRecordSchema)

module.exports = attendence; 