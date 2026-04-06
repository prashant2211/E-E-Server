const { HostelRoom, HostelAllocation, HostelMaintenance } = require('../models/hostelModel');
const { logger } = require('../utils/logger');
const { successResponse, errorResponse, paginatedResponse } = require('../utils/response');
const { cache } = require('../utils/cache');

// Room Management
const getAllRooms = async (req, res) => {
  try {
    const hostelName = req.query.hostelName;
    let searchCondition = {
      InstutionCode: req.user.InstutionCode,
      Status: true
    };

    if (hostelName) {
      searchCondition.Hostel_Name = hostelName;
    }

    const rooms = await HostelRoom.find(searchCondition)
      .select('-__v')
      .sort({ Hostel_Name: 1, Floor: 1, Room_Number: 1 })
      .lean();

    return successResponse(res, rooms, 'Rooms retrieved successfully');
  } catch (error) {
    logger.error('Error fetching rooms:', error);
    return errorResponse(res, 'Failed to fetch rooms', 500);
  }
};

const addRoom = async (req, res) => {
  try {
    const roomData = {
      ...req.body,
      InstutionCode: req.user.InstutionCode,
      Available: req.body.Capacity || 1
    };

    const room = await HostelRoom.create(roomData);
    return successResponse(res, room, 'Room added successfully', 201);
  } catch (error) {
    logger.error('Error adding room:', error);
    return errorResponse(res, 'Failed to add room', 500);
  }
};

const updateRoom = async (req, res) => {
  try {
    const roomId = req.body.roomId || req.body._id;
    if (!roomId) return errorResponse(res, 'Please provide Room ID', 400);

    const room = await HostelRoom.findOneAndUpdate(
      { _id: roomId, InstutionCode: req.user.InstutionCode },
      req.body,
      { new: true }
    ).select('-__v');

    if (!room) return errorResponse(res, 'Room not found', 404);
    return successResponse(res, room, 'Room updated successfully');
  } catch (error) {
    logger.error('Error updating room:', error);
    return errorResponse(res, 'Failed to update room', 500);
  }
};

// Room Allocation
const allocateRoom = async (req, res) => {
  try {
    const { registrationNumber, roomId, bedNumber, mealPlan, monthlyFee } = req.body;

    if (!registrationNumber || !roomId || !bedNumber) {
      return errorResponse(res, 'Please provide registrationNumber, roomId, and bedNumber', 400);
    }

    // Check if already allocated
    const existing = await HostelAllocation.findOne({
      Registration_Number: registrationNumber,
      InstutionCode: req.user.InstutionCode,
      Status: 'Active'
    });

    if (existing) {
      return errorResponse(res, 'Student already has room allocated', 400);
    }

    // Check room availability
    const room = await HostelRoom.findById(roomId);
    if (!room || room.Available <= 0) {
      return errorResponse(res, 'Room not available', 400);
    }

    // Create allocation
    const allocation = await HostelAllocation.create({
      InstutionCode: req.user.InstutionCode,
      Registration_Number: registrationNumber,
      Room_Id: roomId,
      Bed_Number: bedNumber,
      Meal_Plan: mealPlan || 'Full Board',
      Monthly_Fee: monthlyFee || room.Monthly_Rent
    });

    // Update room availability
    room.Occupied += 1;
    room.Available -= 1;
    await room.save();

    return successResponse(res, allocation, 'Room allocated successfully', 201);
  } catch (error) {
    logger.error('Error allocating room:', error);
    return errorResponse(res, 'Failed to allocate room', 500);
  }
};

const releaseRoom = async (req, res) => {
  try {
    const { allocationId } = req.body;

    if (!allocationId) {
      return errorResponse(res, 'Please provide Allocation ID', 400);
    }

    const allocation = await HostelAllocation.findOne({
      _id: allocationId,
      InstutionCode: req.user.InstutionCode,
      Status: 'Active'
    });

    if (!allocation) {
      return errorResponse(res, 'Allocation not found', 404);
    }

    allocation.Status = 'Released';
    allocation.Release_Date = new Date();
    await allocation.save();

    // Update room availability
    const room = await HostelRoom.findById(allocation.Room_Id);
    if (room) {
      room.Occupied -= 1;
      room.Available += 1;
      await room.save();
    }

    return successResponse(res, allocation, 'Room released successfully');
  } catch (error) {
    logger.error('Error releasing room:', error);
    return errorResponse(res, 'Failed to release room', 500);
  }
};

const getStudentAllocation = async (req, res) => {
  try {
    const registrationNumber = req.query.registrationNumber;

    if (!registrationNumber) {
      return errorResponse(res, 'Please provide Registration Number', 400);
    }

    const allocation = await HostelAllocation.findOne({
      Registration_Number: registrationNumber,
      InstutionCode: req.user.InstutionCode,
      Status: 'Active'
    })
      .populate('Room_Id', 'Hostel_Name Room_Number Room_Type Floor Amenities')
      .select('-__v')
      .lean();

    if (!allocation) {
      return errorResponse(res, 'No allocation found', 404);
    }

    return successResponse(res, allocation, 'Allocation retrieved successfully');
  } catch (error) {
    logger.error('Error fetching allocation:', error);
    return errorResponse(res, 'Failed to fetch allocation', 500);
  }
};

// Maintenance Management
const createMaintenanceRequest = async (req, res) => {
  try {
    const { roomId, issueType, description, priority } = req.body;

    if (!roomId || !issueType || !description) {
      return errorResponse(res, 'Please provide roomId, issueType, and description', 400);
    }

    const maintenance = await HostelMaintenance.create({
      InstutionCode: req.user.InstutionCode,
      Room_Id: roomId,
      Issue_Type: issueType,
      Description: description,
      Priority: priority || 'Medium',
      Reported_By: req.user.FirstName + ' ' + req.user.LastName
    });

    return successResponse(res, maintenance, 'Maintenance request created successfully', 201);
  } catch (error) {
    logger.error('Error creating maintenance request:', error);
    return errorResponse(res, 'Failed to create maintenance request', 500);
  }
};

const getAllMaintenanceRequests = async (req, res) => {
  try {
    const status = req.query.status;
    let searchCondition = {
      InstutionCode: req.user.InstutionCode
    };

    if (status) {
      searchCondition.Status = status;
    }

    const requests = await HostelMaintenance.find(searchCondition)
      .populate('Room_Id', 'Hostel_Name Room_Number')
      .select('-__v')
      .sort({ Reported_Date: -1 })
      .lean();

    return successResponse(res, requests, 'Maintenance requests retrieved successfully');
  } catch (error) {
    logger.error('Error fetching maintenance requests:', error);
    return errorResponse(res, 'Failed to fetch maintenance requests', 500);
  }
};

const updateMaintenanceStatus = async (req, res) => {
  try {
    const { maintenanceId, status, assignedTo, cost, remarks } = req.body;

    if (!maintenanceId || !status) {
      return errorResponse(res, 'Please provide maintenanceId and status', 400);
    }

    const updateData = { Status: status };
    if (assignedTo) updateData.Assigned_To = assignedTo;
    if (cost) updateData.Cost = cost;
    if (remarks) updateData.Remarks = remarks;
    if (status === 'Completed') updateData.Completed_Date = new Date();

    const maintenance = await HostelMaintenance.findOneAndUpdate(
      { _id: maintenanceId, InstutionCode: req.user.InstutionCode },
      updateData,
      { new: true }
    ).select('-__v');

    if (!maintenance) {
      return errorResponse(res, 'Maintenance request not found', 404);
    }

    return successResponse(res, maintenance, 'Maintenance status updated successfully');
  } catch (error) {
    logger.error('Error updating maintenance:', error);
    return errorResponse(res, 'Failed to update maintenance', 500);
  }
};

module.exports = {
  getAllRooms,
  addRoom,
  updateRoom,
  allocateRoom,
  releaseRoom,
  getStudentAllocation,
  createMaintenanceRequest,
  getAllMaintenanceRequests,
  updateMaintenanceStatus
};

