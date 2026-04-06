const mongoose      = require('mongoose')
const { type }      = require('os')

const Schema        = mongoose.Schema

const staffSalaryDetailsSchema = new Schema({
    Staff_Code:{
        type: String,
        unique: true,
        required: true
    },
    Staff_Name : {
        type: String
    },
    Designation : {
        type: String
    },
    DOJ : {
        type: String
    },
    Bank_Name : {
        type: String
    },
    Account_Number : {
        type: String,
        unique: true,
        required: true
    },
    IFSC_Code : {
        type: String
    },
    Branch_Name : {
        type: String
    },
    Pan_Number : {
        type: String,
        unique: true,
        required: true
    },
    PF_Number : {
        type: String
    },
    PF_UAN : {
        type: String,
        unique: true,
        required: true
    },
    PF_Amount : {
        type: Number,
        unique: true,
        required: true
    },
    PF_Employer : {
        type: Number
    },
    Insurance : {
        type: Number
    },
    Children_Education_Allowance : {    
        type: Number
    },
    Leave_Travel_Allowance: {
        type: Number
    },
    LOP_Days: {
        type: Number
    },
    Total_Working_Days: {
        type: Number
    },
    Basic: {
        type: Number
    },
    HRA: {
        type: Number
    },
    Other_Allowance: {
        type: Number
    },
    Bonus: {
        type: Number
    },
    Professional_Tax: {
        type: Number
    },
    TDS: {
        type: Number
    },
    Income_Tax: {
        type: Number
    },
    Salary_Arrears: {
        type: Number
    },
    Special_Allowance: {
        type: Number
    },
    Variable_Pay: {
        type: Number
    },
    CTC : {
        type: Number
    },
    Pending_Amount : {
        type: Number
    },
    Gross_Earning: {
        type: Number
    },
    Gross_Deduction: {
        type: Number
    },
 
},
{timestamps:true}
)


staffSalaryDetailsSchema.index({ Employee_Code: 1, Phone: 1, Account_Number: 1, PF_UAN: 1 }, { unique: true });

// Create the model
const salaryPaymentModel = mongoose.model('Staff_Salary_Details', staffSalaryDetailsSchema);

module.exports = salaryPaymentModel;