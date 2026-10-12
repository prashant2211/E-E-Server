const mongoose      = require('mongoose')
const { type } = require('os')

const Schema        = mongoose.Schema

const announcementSchema = new Schema(
  {
    InstutionId: {
      type: String,
      required: true,
    },
    // Main announcement text (optional if file-only announcement)
    Announcement: {
      type: String,
      default: '',
    },
    Subject: {
      type: String,
      required: true,
    },
    Date: {
      type: String,
      required: true,
    },
    // Target audience: All, Student, Parent, Teacher, Admin
    UserType: {
      type: String,
      default: 'All',
    },
    // Type of announcement: text, file, or both
    AnnouncementType: {
      type: String,
      enum: ['text', 'file', 'text+file'],
      default: 'text',
    },
    // Optional file metadata for PDF / image notifications
    FileId: {
      type: String,
    },
    FileName: {
      type: String,
    },
    FileMimeType: {
      type: String,
    },
    FileUrl: {
      type: String,
    },
    FileThumbnail: {
      type: String,
    },
  },
  { timestamps: true }
)

const announcementModel = mongoose.model('Announcement',announcementSchema)

module.exports = announcementModel; 