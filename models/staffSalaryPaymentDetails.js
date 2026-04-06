const mongoose      = require('mongoose')
const { type }      = require('os')

const Schema        = mongoose.Schema

const staffSalaryPaymentSchema = new Schema({
    Employee_Code:{     // teacher Code
        type: String,
        unique: true,
        required: true
    },
    Instution_Code:{  
        type: String
    },
    Instution_Name:{  
        type: String
    },
    Employee_Name : {      // Employee Name
        type: String
    },
    Month : {                  // Current Month
        type: String
    },
    Monthly_Salary:{           // pending amount if not there then it should be o
        type: Number
    },
    Total_Pending_Amount:{           // pending amount if not there then it should be o
        type: Number
    },
    Paid_Amount: {                  // delevered amount
        type: Number
    },
    Payment_Status: {                 // Sucess, pending or Fail
        type: String
    },
    Payment_Date: {                       // salary payment date
        type: Date
    },
    Payment_Mode: {                   // Online, Cash, Check
        type: String
    }
    
},
{timestamps:true}
)

const Class = mongoose.model('Staff_Salary_Payment',staffSalaryPaymentSchema)

module.exports = Class; 