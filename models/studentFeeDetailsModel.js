const mongoose      = require('mongoose')
const { type } = require('os')

const Schema        = mongoose.Schema

const studentFeeStructureSchema = new Schema({
    InstutionCode: {
        type: String,
        index: true,
    },
    Student_Name:{
        type: String
    },
    Class:{
        type: String
    },

    Student_RollNumber : {
        type: Number
    },
    Month : {
        type: String
    },
    Total_Pending_Fee : {
        type: Number
    },
    Tution_fee:{
        type: Number
    },
    Payment_status: {
        type: String
    },
    Lumsum_Amount: {
        type: Number
    },
    Payment_Date: {
        type: Date
    },
    Payment_Mode: {
        type: String
    }
    
},
{timestamps:true}
)

const Class = mongoose.model('FeeStructure',studentFeeStructureSchema)

module.exports = Class; 