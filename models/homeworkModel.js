const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const homeworkSchema = new Schema({
  InstutionCode: {
    type: String,
    required: true,
    index: true
  },
  Title: {
    type: String,
    required: true
  },
  Description: {
    type: String,
    required: true
  },
  Class: {
    type: String,
    required: true,
    index: true
  },
  Subject: {
    type: String,
    required: true
  },
  Assigned_By: {
    type: String,
    required: true
  },
  Teacher_Id: {
    type: Schema.Types.ObjectId,
    ref: 'Teacher'
  },
  Assigned_Date: {
    type: Date,
    default: Date.now
  },
  Due_Date: {
    type: Date,
    required: true,
    index: true
  },
  Total_Marks: {
    type: Number,
    default: 100
  },
  Attachments: [{
    File_Name: String,
    File_URL: String,
    S3_Key: String,
    File_Type: String,
    File_Size: Number
  }],
  Status: {
    type: String,
    enum: ['Active', 'Completed', 'Cancelled'],
    default: 'Active',
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

const homeworkSubmissionSchema = new Schema({
  InstutionCode: {
    type: String,
    required: true,
    index: true
  },
  Homework_Id: {
    type: Schema.Types.ObjectId,
    ref: 'Homework',
    required: true,
    index: true
  },
  Registration_Number: {
    type: String,
    required: true,
    index: true
  },
  Submission_Date: {
    type: Date,
    default: Date.now
  },
  Submitted_Content: String,
  Attachments: [{
    File_Name: String,
    File_URL: String,
    S3_Key: String,
    File_Type: String,
    File_Size: Number
  }],
  Marks_Obtained: Number,
  Feedback: String,
  Status: {
    type: String,
    enum: ['Submitted', 'Graded', 'Late', 'Missing'],
    default: 'Submitted',
    index: true
  },
  Graded_By: String,
  Graded_Date: Date,
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
homeworkSchema.index({ InstutionCode: 1, Class: 1, Status: 1 });
homeworkSchema.index({ InstutionCode: 1, Due_Date: 1 });
homeworkSchema.index({ InstutionCode: 1, Teacher_Id: 1 });
homeworkSubmissionSchema.index({ InstutionCode: 1, Homework_Id: 1 });
homeworkSubmissionSchema.index({ InstutionCode: 1, Registration_Number: 1 });
homeworkSubmissionSchema.index({ InstutionCode: 1, Status: 1 });

const Homework = mongoose.model('Homework', homeworkSchema);
const HomeworkSubmission = mongoose.model('HomeworkSubmission', homeworkSubmissionSchema);

module.exports = {
  Homework,
  HomeworkSubmission
};

