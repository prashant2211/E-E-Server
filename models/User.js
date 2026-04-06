
const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const  userSchema= new Schema({
  FirstName: {
    type: String,
    required: true
  } ,
  LastName: {
    type: String,
    required: true
  } ,
  Email: {
    type: String,
    require: true,
    unique: true
  },
  Phone:{
    type: String,
    required: true
  },
  Password:{
    type: String,
    require: true
  },
  UserName:{
    type: String,
    require: true
  },
  InstutionCode:{             // here we can store instution code
    type: String,
    require: true
  },
  UserType: {          // we can define type of user
    type: String,
    required: true
  },
  PermissionSet: {     // here we can assing permission level, we can assing multiple permission set using comma seperated
    type: String,
  },
  MemberId: {         // this field is used for storing employee Id or Student Id
    type: String,
    required: true
  },
  InstutionName: {         // this field is used for storing Instution Name
    type: String,
    required: true
  },
  Verified: {         // this field is used for storing employee Id or Student Id
    type: Boolean,
    required: true,
    default: false
  },
  Department: {
    type: String,
  },
  Designation: {
    type: String,
  },
  JoiningDate: {
    type: Date,
  },
  Address: {
    type: String,
  },
  EmergencyContact: {
    type: String,
  },
  EmergencyPhone: {
    type: String,
  },
  Adhar: {
    type: String,
    required: false,
    sparse: true,  // Allows multiple null/undefined values
    unique: true   // Unique only for non-null values
  },
  Avatar: {
    type: String,
  },

},{timestamps: true});

userSchema.index({ Email: 1, Phone: 1, UserName: 1,  MemberId: 1}, { unique: true });

const User  = mongoose.model('User', userSchema );
module.exports =  User; 