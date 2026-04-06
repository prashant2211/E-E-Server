const mongoose      = require('mongoose')
const { type } = require('os')

const Schema        = mongoose.Schema

const attendenceSchema = new Schema({
    Student_Id:{
        type: String
    },
    Student_Name:{
        type: String
    },
    Attendence : {     // [{"Total_Number_Of_Classes":"","Total_Attendence":"",""}]
        type: Array
    },
    Instution_Name : {
        type: String
    },
    Instution_Code : {
        type: String
    },
    
},
{timestamps:true}
)
attendenceSchema.index({ Class_Code: 1}, { unique: true });

const Class = mongoose.model('Class',attendenceSchema)

module.exports = Class; 