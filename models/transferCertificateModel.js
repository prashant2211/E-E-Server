const mongoose      = require('mongoose')
const { type } = require('os')

const Schema        = mongoose.Schema

const transfercertificateSchema = new Schema({
    InstutionId:{
        type: String
    },
    SchoolCode : {
        type: String,
    },
    RegistrationNumber : {
        type: String
    },
    TCNumber : {
        type: String
    },
    StudentName : {
        type: String
    },
    FatherName:{
        type: String
    },
    MotherName: {
        type: String
    },
    DOB: {
        type: String
    },
    Nationality: {
        type: String
    },
    Religions: {
        type: String
    },
    Category:{
        type: String
    },
    LastStudyClass:{
        type: String
    },
    PromotedToNextClass:{
        type: Boolean
    },
    DateOfAdmission:{
        type: String
    },
    DateofLeaving:{
        type: String
    },
    Reason:{
        type: String
    },
    WorkingDays:{
        type: String
    },
    AttendentDays:{
        type: String
    },
    Conduct:{
        type: String
    },
    CoCaricularActivity:{
        type: Boolean
    },
    Achievement:{
        type: String
    },
    Remarks:{
        type: String
    }
    
},
{timestamps:true}
)

const transferCertificateModel = mongoose.model('TransferCertificate',transfercertificateSchema)

module.exports = transferCertificateModel; 