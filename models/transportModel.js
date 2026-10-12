const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const vehicleSchema = new Schema({
  InstutionCode: {
    type: String,
    required: true,
    index: true
  },
  Vehicle_Number: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  Vehicle_Type: {
    type: String,
    enum: ['Bus', 'Van', 'Car'],
    required: true
  },
  Capacity: {
    type: Number,
    required: true
  },
  Make: String,
  Model: String,
  Year: Number,
  Color: String,
  Registration_Date: Date,
  Insurance_Expiry: Date,
  Permit_Expiry: Date,
  Driver_Id: {
    type: Schema.Types.ObjectId,
    ref: 'Driver'
  },
  Route_Id: {
    type: Schema.Types.ObjectId,
    ref: 'TransportRoute'
  },
  Status: {
    type: Boolean,
    default: true,
    index: true
  },
  GPS_Tracking: {
    type: Boolean,
    default: false
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

const driverSchema = new Schema({
  InstutionCode: {
    type: String,
    required: true,
    index: true
  },
  First_Name: {
    type: String,
    required: true
  },
  Last_Name: {
    type: String,
    required: true
  },
  Contact_Number: {
    type: String,
    required: true
  },
  License_Number: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  License_Expiry: {
    type: Date,
    required: true
  },
  Address: String,
  Emergency_Contact: String,
  Experience: Number,
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

const transportRouteSchema = new Schema({
  InstutionCode: {
    type: String,
    required: true,
    index: true
  },
  Route_Name: {
    type: String,
    required: true
  },
  Route_Number: {
    type: String,
    required: true,
    index: true
  },
  Start_Location: {
    type: String,
    required: true
  },
  End_Location: {
    type: String,
    required: true
  },
  Stops: [{
    Stop_Name: String,
    Stop_Order: Number,
    Arrival_Time: String,
    Latitude: Number,
    Longitude: Number
  }],
  Distance: Number,
  Estimated_Time: String,
  Fee: {
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

const studentTransportSchema = new Schema({
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
  Route_Id: {
    type: Schema.Types.ObjectId,
    ref: 'TransportRoute',
    required: true
  },
  Vehicle_Id: {
    type: Schema.Types.ObjectId,
    ref: 'Vehicle'
  },
  Stop_Name: String,
  Fee: {
    type: Number,
    default: 0
  },
  Start_Date: {
    type: Date,
    default: Date.now
  },
  End_Date: Date,
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

// Indexes
vehicleSchema.index({ InstutionCode: 1, Status: 1 });
driverSchema.index({ InstutionCode: 1, Status: 1 });
transportRouteSchema.index({ InstutionCode: 1, Status: 1 });
studentTransportSchema.index({ InstutionCode: 1, Registration_Number: 1 });
studentTransportSchema.index({ InstutionCode: 1, Status: 1 });

const Vehicle = mongoose.model('Vehicle', vehicleSchema);
const Driver = mongoose.model('Driver', driverSchema);
const TransportRoute = mongoose.model('TransportRoute', transportRouteSchema);
const StudentTransport = mongoose.model('StudentTransport', studentTransportSchema);

module.exports = {
  Vehicle,
  Driver,
  TransportRoute,
  StudentTransport
};

