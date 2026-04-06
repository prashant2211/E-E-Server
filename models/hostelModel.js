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

const HostelRoom = mongoose.model('HostelRoom', hostelRoomSchema);
const HostelAllocation = mongoose.model('HostelAllocation', hostelAllocationSchema);
const HostelMaintenance = mongoose.model('HostelMaintenance', hostelMaintenanceSchema);

module.exports = {
  HostelRoom,
  HostelAllocation,
  HostelMaintenance
};

