const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const hostelRoomSchema = new Schema({
  InstutionCode: {
    type: String,
    required: true,
    index: true
  },
  Hostel_Name: {
    type: String,
    required: true
  },
  Room_Number: {
    type: String,
    required: true,
    index: true
  },
  Floor: Number,
  Room_Type: {
    type: String,
    enum: ['AC', 'Non-AC'],
    required: true
  },
  Capacity: {
    type: Number,
    required: true,
    default: 1
  },
  Occupied: {
    type: Number,
    default: 0
  },
  Available: {
    type: Number,
    default: 1
  },
  Amenities: [String],
  Sharing: {
    type: String,
    enum: ['Dormitory', 'Shared', 'Double', 'Single'],
    default: 'Shared'
  },
  For: {
    type: String,
    enum: ['Boys', 'Girls', 'Mixed'],
    default: 'Mixed'
  },
  Warden_User_Id: { type: Schema.Types.ObjectId, ref: 'User' },
  Warden_Name: String,
  Warden_Phone: String,
  Monthly_Rent: {
    type: Number,
    default: 0
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

const hostelAllocationSchema = new Schema({
  InstutionCode: {
    type: String,
    required: true,
    index: true
  },
  Registration_Number: {
    type: String,
    required: true,
    index: true
  },
  Room_Id: {
    type: Schema.Types.ObjectId,
    ref: 'HostelRoom',
    required: true,
    index: true
  },
  Bed_Number: {
    type: Number,
    required: true
  },
  Student_Name: String,
  Class: String,
  Section: String,
  Phone: String,
  Notes: String,
  Allocation_Date: {
    type: Date,
    default: Date.now
  },
  Release_Date: Date,
  Monthly_Fee: {
    type: Number,
    default: 0
  },
  Meal_Plan: {
    type: String,
    enum: ['Full Board', 'Half Board', 'No Meal'],
    default: 'Full Board'
  },
  Status: {
    type: String,
    enum: ['Active', 'Released'],
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

const hostelMaintenanceSchema = new Schema({
  InstutionCode: {
    type: String,
    required: true,
    index: true
  },
  Room_Id: {
    type: Schema.Types.ObjectId,
    ref: 'HostelRoom',
    required: true
  },
  Issue_Type: {
    type: String,
    required: true
  },
  Description: {
    type: String,
    required: true
  },
  Priority: {
    type: String,
    enum: ['High', 'Medium', 'Low'],
    default: 'Medium'
  },
  Reported_By: {
    type: String,
    required: true
  },
  Reported_Date: {
    type: Date,
    default: Date.now
  },
  Assigned_To: String,
  Status: {
    type: String,
    enum: ['Pending', 'In Progress', 'Completed'],
    default: 'Pending',
    index: true
  },
  Completed_Date: Date,
  Cost: Number,
  Remarks: String,
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
hostelRoomSchema.index({ InstutionCode: 1, Status: 1 });
hostelRoomSchema.index({ InstutionCode: 1, Hostel_Name: 1 });
hostelAllocationSchema.index({ InstutionCode: 1, Registration_Number: 1 });
hostelAllocationSchema.index({ InstutionCode: 1, Status: 1 });
hostelMaintenanceSchema.index({ InstutionCode: 1, Status: 1 });

const hostelBlockSchema = new Schema({
  InstutionCode: { type: String, required: true, index: true },
  Name: { type: String, required: true },
  For: { type: String, enum: ['Boys', 'Girls', 'Mixed'], default: 'Mixed' },
  Warden_User_Id: { type: Schema.Types.ObjectId, ref: 'User' },
  Warden_Name: String,
  Warden_Phone: String,
  Notes: String,
  Status: { type: Boolean, default: true },
}, { timestamps: true });

const hostelAttendanceSchema = new Schema({
  InstutionCode: { type: String, required: true, index: true },
  Date: { type: String, required: true, index: true },
  Registration_Number: { type: String, required: true },
  Student_Name: String,
  Hostel_Name: String,
  Room_Number: String,
  Status: { type: String, enum: ['Present', 'Absent', 'Leave', 'Outing'], default: 'Present' },
  Note: String,
}, { timestamps: true });

const hostelLeaveSchema = new Schema({
  InstutionCode: { type: String, required: true, index: true },
  Registration_Number: { type: String, required: true },
  Student_Name: String,
  From_Date: { type: String, required: true },
  To_Date: { type: String, required: true },
  Type: { type: String, enum: ['Leave', 'Outing'], default: 'Leave' },
  Reason: { type: String, required: true },
  Destination: String,
  Status: {
    type: String,
    enum: ['Pending', 'Approved', 'Rejected', 'Returned'],
    default: 'Pending',
    index: true,
  },
  Approved_By: String,
}, { timestamps: true });

const hostelVisitorSchema = new Schema({
  InstutionCode: { type: String, required: true, index: true },
  Visitor_Name: { type: String, required: true },
  Relation: String,
  Phone: String,
  Registration_Number: String,
  Student_Name: String,
  Purpose: String,
  In_Time: { type: Date, default: Date.now },
  Out_Time: Date,
  Id_Note: String,
}, { timestamps: true });

const hostelMenuSchema = new Schema({
  InstutionCode: { type: String, required: true, index: true },
  Date: { type: String, required: true },
  Breakfast: String,
  Lunch: String,
  Snacks: String,
  Dinner: String,
  Note: String,
}, { timestamps: true });

const hostelSettingsSchema = new Schema({
  InstutionCode: { type: String, required: true, unique: true },
  MessEnabled: { type: Boolean, default: true },
  VisitorsEnabled: { type: Boolean, default: true },
  LeaveEnabled: { type: Boolean, default: true },
  AttendanceEnabled: { type: Boolean, default: true },
  FeeNote: { type: String, default: '' },
  Amenities: { type: [String], default: [] },
}, { timestamps: true });

hostelAttendanceSchema.index({ InstutionCode: 1, Date: 1, Registration_Number: 1 }, { unique: true });
hostelMenuSchema.index({ InstutionCode: 1, Date: 1 }, { unique: true });

const WEEK_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const hostelWeeklyMenuSchema = new Schema({
  InstutionCode: { type: String, required: true, index: true },
  Day: { type: String, enum: WEEK_DAYS, required: true },
  Breakfast: String,
  Lunch: String,
  Snacks: String,
  Dinner: String,
  Note: String,
}, { timestamps: true });

hostelWeeklyMenuSchema.index({ InstutionCode: 1, Day: 1 }, { unique: true });

const hostelFeePaymentSchema = new Schema({
  InstutionCode: { type: String, required: true, index: true },
  Receipt_No: { type: String, required: true },
  Allocation_Id: { type: Schema.Types.ObjectId, ref: 'HostelAllocation', required: true, index: true },
  Registration_Number: { type: String, required: true, index: true },
  Student_Name: String,
  Class: String,
  Section: String,
  Hostel_Name: String,
  Room_Number: String,
  Bed_Number: Number,
  Months: [{
    Month: String,
    Label: String,
    Amount: Number,
  }],
  Amount: { type: Number, required: true },
  Payment_Mode: { type: String, enum: ['Cash', 'UPI', 'Bank', 'Cheque'], default: 'Cash' },
  Reference: String,
  Paid_On: { type: String, required: true },
  Note: String,
  Collected_By: String,
}, { timestamps: true });

hostelFeePaymentSchema.index({ InstutionCode: 1, Receipt_No: 1 }, { unique: true });
hostelBlockSchema.index({ InstutionCode: 1, Name: 1 }, { unique: true });

const HostelRoom = mongoose.model('HostelRoom', hostelRoomSchema);
const HostelAllocation = mongoose.model('HostelAllocation', hostelAllocationSchema);
const HostelMaintenance = mongoose.model('HostelMaintenance', hostelMaintenanceSchema);
const HostelBlock = mongoose.model('HostelBlock', hostelBlockSchema);
const HostelAttendance = mongoose.model('HostelAttendance', hostelAttendanceSchema);
const HostelLeave = mongoose.model('HostelLeave', hostelLeaveSchema);
const HostelVisitor = mongoose.model('HostelVisitor', hostelVisitorSchema);
const HostelMenu = mongoose.model('HostelMenu', hostelMenuSchema);
const HostelWeeklyMenu = mongoose.model('HostelWeeklyMenu', hostelWeeklyMenuSchema);
const HostelFeePayment = mongoose.model('HostelFeePayment', hostelFeePaymentSchema);
const HostelSettings = mongoose.model('HostelSettings', hostelSettingsSchema);

module.exports = {
  HostelRoom,
  HostelAllocation,
  HostelMaintenance,
  HostelBlock,
  HostelAttendance,
  HostelLeave,
  HostelVisitor,
  HostelMenu,
  HostelWeeklyMenu,
  HostelFeePayment,
  HostelSettings,
  WEEK_DAYS,
};

