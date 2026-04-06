const mongoose      = require('mongoose')
const { type } = require('os')

const Schema        = mongoose.Schema

const admissionInquarySchema = new Schema({
    InstutionId:{
        type: String
    },
    Phone_Number : {
        type: String,
    },
    Class_Name : {
        type: String
    },
    First_Name : {
        type: String
    },
    Last_Name : {
        type: String
    },
    Address:{
        type: String
    },
    State: {
        type: String
    },
    District: {
        type: String
    },
    Father_Name: {
        type: String
    },
    Other_Phone_Number: {
        type: String
    },
    Gender:{
        type: String
    },
    Date:{
        type: Date
    }
    
},
{timestamps:true}
)

const admissionInquaryModel = mongoose.model('AdmissionInquary',admissionInquarySchema)

module.exports = admissionInquaryModel; 