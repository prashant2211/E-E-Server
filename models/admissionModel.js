const mongoose      = require('mongoose')
const { type } = require('os')

const Schema        = mongoose.Schema

const admissionSchema = new Schema({
    InstutionCode: {
        type: String,
        required: true,
        index: true
    },
    Student_Name:{
        type: String
    },
    Phone_Number : {
        type: String,
        unique: true
    },
    Class_Name : {
        type: String
    },
    Privious_School_Name : {
        type: String
    },
    Address:{
        type: String
    },
    Previous_class: {
        type: String
    },
    Age: {
        type: Number
    },
    Father_Name: {
        type: String
    },
    School_visit_Day: {
        type: Date
    },
    Integrested_Subject: {
        type: Array
    },
    Day_Of_Registration: {
        type: Date
    },
    Status: {
        type: String,
        default: 'Pending'
    },
    /** Admission fee clearance — must be Received before approve/convert */
    AdmissionFeeStatus: {
        type: String,
        enum: ['Pending', 'Received'],
        default: 'Pending',
    },
    AdmissionFeePaidAt: {
        type: Date,
    },
    AdmissionFeePaymentRecordId: {
        type: String,
    },
    Admission_Date: {
        type: Date
    },
    Registration_Number: {
        type: String
    },
    IsConvertedToStudent: {
        type: Boolean,
        default: false
    },
    ConvertedStudentId: {
        type: String
    },
    ConvertedAt: {
        type: Date
    },
    // Additional Indian school admission fields
    Mother_Name: {
        type: String
    },
    Date_Of_Birth: {
        type: Date
    },
    Gender: {
        type: String,
        enum: ['Male', 'Female', 'Other']
    },
    Aadhar_Number: {
        type: String
    },
    State: {
        type: String
    },
    District: {
        type: String
    },
    Email: {
        type: String
    },
    Category: {
        type: String,
        enum: ['General', 'OBC', 'SC', 'ST', 'EWS', 'Other']
    },
    Blood_Group: {
        type: String
    },
    Emergency_Contact: {
        type: String
    },
    Documents_Submitted: {
        type: Array,
        default: []
    },
    AdmissionDocuments: {
        type: [
            {
                Name: { type: String },
                Key: { type: String },
                Url: { type: String },
                UploadedAt: { type: Date },
            },
        ],
        default: [],
    },
    /** Staff waived required document uploads at verify step (audit) */
    DocumentUploadWaived: {
        type: Boolean,
        default: false,
    },
    DocumentUploadWaivedAt: {
        type: Date,
    },
    
},
{timestamps:true}
)

const Class = mongoose.model('Admission',admissionSchema)

module.exports = Class; 