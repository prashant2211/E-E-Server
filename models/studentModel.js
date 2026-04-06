const mongoose      = require('mongoose')
const { type } = require('os')

const Schema        = mongoose.Schema

const studentSchema = new Schema({
    Class:{
        type: String
    },
    Class_Code:{
        type: String
    },
    Section: {
        type: String
    },
    SectionCode: {
        type: String
    },
    InstutionCode: {
        type: String,
        required: true
    },
    Email: {
        type: String,
        required: true
    },
    Father_Name: {
        type: String
    },
    Mother_Name: {
        type: String
    },
    Contact_Number: {
        type: String
    },
    Secondary_Contact: {
        type: String
    },
    Address: {
        type: String
    },
    Performace_Update: {
        type: String
    },
    Exctracaricular_Activity: {
        type: Number
    },
    Attended_Classes: {   // 
        type: Number
    },
    Total_Classes: {
        type: Number
    },
    Password: {
        type: String
    },
    Registration_Number: {
        type: String,
        unique: true,
        required: true
    },
    State: {
        type: String,
        required: true
    },
    District: {
        type: String,
        required: true
    },
    Last_Name: {
        type: String,
        required: true
    },
    First_Name: {
        type: String,
        required: true
    },
    Adhar: {
        type: String,
        required: true,
        unique: true
    },
    DOB: {
        type: String,
        required: true
    },
    Gender: {
        type: String,
        
    },
     OutstandingAmount: {
        type: String,
        required: true
    },
    // Optional student photo stored in S3
    PhotoUrl: {
        type: String,
    },
    PhotoKey: {
        type: String,
    },
    PhotoMimeType: {
        type: String,
    },

    // Optional ID documents stored in S3
    // Aadhar front and back
    AdharFrontDocUrl: {
        type: String,
    },
    AdharFrontDocKey: {
        type: String,
    },
    AdharFrontDocMimeType: {
        type: String,
    },
    AdharBackDocUrl: {
        type: String,
    },
    AdharBackDocKey: {
        type: String,
    },
    AdharBackDocMimeType: {
        type: String,
    },

    PanDocUrl: {
        type: String,
    },
    PanDocKey: {
        type: String,
    },
    PanDocMimeType: {
        type: String,
    },

    OtherDocs: [
        {
            Name: { type: String },
            Url: { type: String },
            Key: { type: String },
            MimeType: { type: String },
            UploadedAt: { type: Date, default: Date.now }
        }
    ],
    
   Status: {
    type: Boolean,
    required: true
   }
},
{ timestamps: true }
);

// studentSchema.index({Adhar: 1}, { unique: true });

const Student = mongoose.model('Student',studentSchema)

module.exports = Student; 