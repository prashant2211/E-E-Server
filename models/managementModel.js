const mongoose      = require('mongoose')
const { type }      = require('os')

const Schema        = mongoose.Schema

const managementSchema = new Schema({
    M_Id:{
        type: String,
        unique: true,
        required: true
    },
    Name : {
        type: String,
        required: true
    },
    Phone : {
        type: String,
        unique: true,
        required: true
    },
    Address : {
        type: String
    },
    Qualification:{
        type: String
    },
    Destination: {
        type: String
    },
    Email: {
        type: String,
        unique: true,
        required: true
    },
    Joining_Date: {
        type: Date
    },
    Age: {
        type: Number
    },
    Adhar: {
        type: String,
        unique: true,
        required: true
    },
    InstutionCode: {
        type: String,
        required: true,
        unique: true
    },
    
},
{timestamps:true}
)

managementSchema.index({ M_Id: 1, Phone: 1, Email: 1}, { unique: true });

const Class = mongoose.model('ManagementDetails',managementSchema)

module.exports = Class; 