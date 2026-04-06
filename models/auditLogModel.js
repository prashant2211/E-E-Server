const mongoose = require('mongoose')

const auditLogSchema = new mongoose.Schema(
  {
    InstutionCode: { type: String, index: true },
    UserId: { type: String, index: true },
    UserEmail: { type: String, index: true },
    UserType: { type: String, index: true },
    EventType: { type: String, default: 'ACTION' }, // ACTION | LOGIN
    Feature: { type: String, index: true },
    Operation: { type: String, index: true },
    Method: { type: String },
    Path: { type: String, index: true },
    Query: { type: mongoose.Schema.Types.Mixed, default: {} },
    Body: { type: mongoose.Schema.Types.Mixed, default: {} },
    StatusCode: { type: Number },
    Success: { type: Boolean, default: true },
    Browser: { type: String },
    UserAgent: { type: String },
    IpAddress: { type: String },
    Latitude: { type: Number },
    Longitude: { type: Number },
    ActionAt: { type: Date, default: Date.now, index: true },
    Meta: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
)

auditLogSchema.index({ InstutionCode: 1, ActionAt: -1 })
auditLogSchema.index({ UserEmail: 1, ActionAt: -1 })

module.exports = mongoose.model('AuditLog', auditLogSchema)

