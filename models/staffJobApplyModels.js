const mongoose      = require('mongoose')
const { type }      = require('os')

const Schema        = mongoose.Schema

const staffJobForm = new Schema({
    Staff_Name:{
        type: String
    },
    Phone : {
        type: String,
        unique: true,
        required: true
    },
    Qualification : {
        type: String
    },
    Address : {
        type: String
    },
    Privious_Experience:{
        type: Array
    },
    Number_of_years_Experiance: {
        type: Number
    },
    Specilised_Subject: {
        type: String
    },
    Confortable_Subject: {
        type: Array
    },
    Apply_Date: {
        type: String
    },
    School_Visit_Date: {
        type: Date
    },
    Status: {
        type: String
    },
    Joining_Date: {
        type: Date
    },
    Demo_Date: {  
        type: Date
    },
    DOB: {
        type: Date
    },
    Password: {
        type: String
    }
    
    
},
{timestamps:true}
)

// staffJobForm.index({ Phone: 1}, { unique: true });

const Class = mongoose.model('StaffJobForm',staffJobForm)

module.exports = Class; 