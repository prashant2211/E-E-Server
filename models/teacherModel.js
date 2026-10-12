const mongoose = require('mongoose');
const Schema = mongoose.Schema;


const teacherSchema = new Schema({
    Class_Name: {
       type: String,
       required: false
   },
   First_Name: {
       type: String,
       required: true
   },
   Last_Name: {
       type: String,
       required: true
   },
   Staff_Code: {
    type: String,
    required: true,
    unique: true
},
   Email: {
       type: String,
       required: false,
       unique: true
   },
   Specialised_Subject: {
       type: String,
       required: true
   },
   Contact_Number: {
       type: String,
       required: true
   },
   InstutionCode: {
    type: String,
    required: true
},
   Address: {
       type: String,
       required: true
   },
   Qualification: {
       type: String,
       required: true
   },
   joining_Date: {
       type: String,
       required: true
   },
   DOB: {
       type: String,
       required: true
   },
   Adhar: {
       type: String,
       required: true
   },
   Age: {
       type: Number,
       required: false
   },
   State: {
       type: String,
       required: true
   },
   District: {
       type: String,
       required: true
   },
   Experience: {
       type: String,
       required: true
   },
   Status: {
    type: Boolean,
    required: true
}
  
  
}, { timestamps: true });

// Compound index for Staff_Code, Contact_Number, and Email
teacherSchema.index({ Staff_Code: 1, Contact_Number: 1, Email: 1}, { unique: true });

// Unique index for Adhar
// NOTE: We define the index only here (and not in the field definition) to avoid duplicate schema index warnings
teacherSchema.index({ Adhar: 1 }, { unique: true });

const Teacher = mongoose.model('Teacher', teacherSchema);


module.exports = Teacher;