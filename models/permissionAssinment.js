const mongoose      = require('mongoose')
const { type }      = require('os')

const Schema        = mongoose.Schema

const permissionAssinment = new Schema({
    admissions:{
        type: String
    },
    classes : {
        type: String
    },
    feestructures : {
        type: String
    },
    instutions : {
        type: String
    },
    managementdetails:{
        type: String
    },
    staff_salaries: {
        type: String
    },
    staff_salary_details: {
        type: String
    },
    staff_salary_payments: {
        type: String
    },
    staffjobforms: {
        type: String
    },
    students: {
        type: String
    },
    teachers: {
        type: String
    },
    users: {
        type: String
    },
    assinment_Date: {  
        type: String
    },
    assined_by: {
        type: String
    },
    MemberCode: {
        type: String,
        unique: true,
    }, 
    Assigned_user: {
        type: String
    }, 
    
    
},
{timestamps:true}
)

// permissionAssinment.index({ MemberCode: 1}, { unique: true });

const permissionSet = mongoose.model('PermissionAssinment',permissionAssinment)

module.exports = permissionSet; 