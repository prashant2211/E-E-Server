const mongoose      = require('mongoose')
const { type }      = require('os')

const Schema        = mongoose.Schema

const scheduleClass = new Schema({
    instutionId:{
        type: String
    },
    classes : {
        type: String
    },
    subject : {
        type: String
    },
    period : {
        type: String
    },
    date:{
        type: String
    },
    time: {
        type: String
    },
    teacherName: {
        type: String
    },
    teacherId: {
        type: String
    },
   
    
    
},
{timestamps:true}
)

// scheduleClass.index({ MemberCode: 1}, { unique: true });

const scheduleClasses = mongoose.model('scheduleClass',scheduleClass)

module.exports = scheduleClasses; 