const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const academicYearSchema = new Schema({
  InstutionCode: {
    type: String,
    required: true,
    index: true
  },
  Year_Name: {
    type: String,
    required: true
  },
  Start_Date: {
    type: Date,
    required: true
  },
  End_Date: {
    type: Date,
    required: true
  },
  Terms: [{
    Term_Name: String,
    Start_Date: Date,
    End_Date: Date,
    Status: {
      type: String,
      enum: ['Upcoming', 'Active', 'Completed'],
      default: 'Upcoming'
    }
  }],
  Is_Current: {
    type: Boolean,
    default: false,
    index: true
  },
  Status: {
    type: Boolean,
    default: true,
    index: true
  },
  Created_At: {
    type: Date,
    default: Date.now
  },
  Updated_At: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

const systemSettingsSchema = new Schema({
  InstutionCode: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  School_Name: String,
  School_Logo: String,
  Contact_Email: String,
  Contact_Phone: String,
  Address: String,
  Timezone: {
    type: String,
    default: 'Asia/Kolkata'
  },
  Currency: {
    type: String,
    default: 'INR'
  },
  Date_Format: {
    type: String,
    default: 'DD/MM/YYYY'
  },
  Features: {
    Library: { type: Boolean, default: true },
    Transport: { type: Boolean, default: true },
    Hostel: { type: Boolean, default: true },
    SMS_Notifications: { type: Boolean, default: false },
    Email_Notifications: { type: Boolean, default: true },
    Online_Payment: { type: Boolean, default: false }
  },
  Settings: Schema.Types.Mixed,
  Created_At: {
    type: Date,
    default: Date.now
  },
  Updated_At: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes
academicYearSchema.index({ InstutionCode: 1, Is_Current: 1 });
academicYearSchema.index({ InstutionCode: 1, Status: 1 });

const AcademicYear = mongoose.model('AcademicYear', academicYearSchema);
const SystemSettings = mongoose.model('SystemSettings', systemSettingsSchema);

module.exports = {
  AcademicYear,
  SystemSettings
};

