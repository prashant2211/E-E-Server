const { Vehicle, Driver, TransportRoute, StudentTransport } = require('../models/transportModel');
const { logger } = require('../utils/logger');
const { successResponse, errorResponse, paginatedResponse } = require('../utils/response');
const { cache } = require('../utils/cache');

// Vehicle Management
const getAllVehicles = async (req, res) => {
  try {
    const page = parseInt(req.query.PageNumber) || 1;
    const limit = parseInt(req.query.PageSize) || 10;
    const skip = (page - 1) * limit;

    const [vehicles, totalCount] = await Promise.all([
      Vehicle.find({ InstutionCode: req.user.InstutionCode, Status: true })
        .populate('Driver_Id', 'First_Name Last_Name Contact_Number')
        .populate('Route_Id', 'Route_Name Route_Number')
        .select('-__v')
        .sort({ Vehicle_Number: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Vehicle.countDocuments({ InstutionCode: req.user.InstutionCode, Status: true })
    ]);

    return paginatedResponse(res, vehicles, { page, pageSize: limit, total: totalCount }, 'Vehicles retrieved successfully');
  } catch (error) {
    logger.error('Error fetching vehicles:', error);
    return errorResponse(res, 'Failed to fetch vehicles', 500);
  }
};

const addVehicle = async (req, res) => {
  try {
    const vehicle = await Vehicle.create({
      ...req.body,
      InstutionCode: req.user.InstutionCode
    });
    return successResponse(res, vehicle, 'Vehicle added successfully', 201);
  } catch (error) {
    logger.error('Error adding vehicle:', error);
    if (error.code === 11000) {
      return errorResponse(res, 'Vehicle with this number already exists', 400);
    }
    return errorResponse(res, 'Failed to add vehicle', 500);
  }
};

const updateVehicle = async (req, res) => {
  try {
    const vehicleId = req.body.vehicleId || req.body._id;
    if (!vehicleId) return errorResponse(res, 'Please provide Vehicle ID', 400);

    const vehicle = await Vehicle.findOneAndUpdate(
      { _id: vehicleId, InstutionCode: req.user.InstutionCode },
      req.body,
      { new: true }
    ).select('-__v');

    if (!vehicle) return errorResponse(res, 'Vehicle not found', 404);
    return successResponse(res, vehicle, 'Vehicle updated successfully');
  } catch (error) {
    logger.error('Error updating vehicle:', error);
    return errorResponse(res, 'Failed to update vehicle', 500);
  }
};

const deleteVehicle = async (req, res) => {
  try {
    const vehicleId = req.body.vehicleId;
    if (!vehicleId) return errorResponse(res, 'Please provide Vehicle ID', 400);

    const vehicle = await Vehicle.findOneAndUpdate(
      { _id: vehicleId, InstutionCode: req.user.InstutionCode },
      { Status: false },
      { new: true }
    );

    if (!vehicle) return errorResponse(res, 'Vehicle not found', 404);
    return successResponse(res, null, 'Vehicle deleted successfully');
  } catch (error) {
    logger.error('Error deleting vehicle:', error);
    return errorResponse(res, 'Failed to delete vehicle', 500);
  }
};

// Driver Management
const getAllDrivers = async (req, res) => {
  try {
    const drivers = await Driver.find({ InstutionCode: req.user.InstutionCode, Status: true })
      .select('-__v')
      .sort({ First_Name: 1 })
      .lean();
    return successResponse(res, drivers, 'Drivers retrieved successfully');
  } catch (error) {
    logger.error('Error fetching drivers:', error);
    return errorResponse(res, 'Failed to fetch drivers', 500);
  }
};

const addDriver = async (req, res) => {
  try {
    const driver = await Driver.create({
      ...req.body,
      InstutionCode: req.user.InstutionCode
    });
    return successResponse(res, driver, 'Driver added successfully', 201);
  } catch (error) {
    logger.error('Error adding driver:', error);
    if (error.code === 11000) {
      return errorResponse(res, 'Driver with this license number already exists', 400);
    }
    return errorResponse(res, 'Failed to add driver', 500);
  }
};

// Route Management
const getAllRoutes = async (req, res) => {
  try {
    const routes = await TransportRoute.find({ InstutionCode: req.user.InstutionCode, Status: true })
      .select('-__v')
      .sort({ Route_Name: 1 })
      .lean();
    return successResponse(res, routes, 'Routes retrieved successfully');
  } catch (error) {
    logger.error('Error fetching routes:', error);
    return errorResponse(res, 'Failed to fetch routes', 500);
  }
};

const addRoute = async (req, res) => {
  try {
    const route = await TransportRoute.create({
      ...req.body,
      InstutionCode: req.user.InstutionCode
    });
    return successResponse(res, route, 'Route added successfully', 201);
  } catch (error) {
    logger.error('Error adding route:', error);
    return errorResponse(res, 'Failed to add route', 500);
  }
};

// Student Transport Assignment
const assignStudentTransport = async (req, res) => {
  try {
    const { registrationNumber, routeId, vehicleId, stopName, fee } = req.body;

    if (!registrationNumber || !routeId) {
      return errorResponse(res, 'Please provide registrationNumber and routeId', 400);
    }

    // Check if already assigned
    const existing = await StudentTransport.findOne({
      Registration_Number: registrationNumber,
      InstutionCode: req.user.InstutionCode,
      Status: true
    });

    if (existing) {
      return errorResponse(res, 'Student already has transport assigned', 400);
    }

    const assignment = await StudentTransport.create({
      InstutionCode: req.user.InstutionCode,
      Registration_Number: registrationNumber,
      Route_Id: routeId,
      Vehicle_Id: vehicleId,
      Stop_Name: stopName,
      Fee: fee || 0
    });

    return successResponse(res, assignment, 'Transport assigned successfully', 201);
  } catch (error) {
    logger.error('Error assigning transport:', error);
    return errorResponse(res, 'Failed to assign transport', 500);
  }
};

const getStudentTransport = async (req, res) => {
  try {
    const registrationNumber = req.query.registrationNumber;

    if (!registrationNumber) {
      return errorResponse(res, 'Please provide Registration Number', 400);
    }

    const transport = await StudentTransport.findOne({
      Registration_Number: registrationNumber,
      InstutionCode: req.user.InstutionCode,
      Status: true
    })
      .populate('Route_Id', 'Route_Name Route_Number Stops')
      .populate('Vehicle_Id', 'Vehicle_Number Vehicle_Type Capacity')
      .select('-__v')
      .lean();

    if (!transport) {
      return errorResponse(res, 'Transport not assigned', 404);
    }

    return successResponse(res, transport, 'Transport details retrieved successfully');
  } catch (error) {
    logger.error('Error fetching transport:', error);
    return errorResponse(res, 'Failed to fetch transport', 500);
  }
};

module.exports = {
  getAllVehicles,
  addVehicle,
  updateVehicle,
  deleteVehicle,
  getAllDrivers,
  addDriver,
  getAllRoutes,
  addRoute,
  assignStudentTransport,
  getStudentTransport
};

