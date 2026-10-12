const {
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
} = require('../models/hostelModel');
const { monthLabel, buildBoarderLedger, roundMoney } = require('../utils/hostelFeeLedger');
const studentModel = require('../models/studentModel');
const User = require('../models/User');
const { logger } = require('../utils/logger');
const { successResponse, errorResponse } = require('../utils/response');

const institutionOf = (req) => String(req.user?.InstutionCode || '').trim();

const isStudentUser = (req) => String(req.user?.UserType || '').trim() === 'Student';

const studentRegistrationOf = (req) => String(req.user?.MemberId || '').trim();

const todayKey = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

const todayWeekday = () => WEEK_DAYS[(new Date().getDay() + 6) % 7];

const menuFields = (body) => ({
  Breakfast: String(body.breakfast || '').trim(),
  Lunch: String(body.lunch || '').trim(),
  Snacks: String(body.snacks || '').trim(),
  Dinner: String(body.dinner || '').trim(),
  Note: String(body.note || '').trim(),
});

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const normalizeAmenities = (list) => {
  const seen = new Set();
  const names = [];
  (Array.isArray(list) ? list : []).forEach((item) => {
    const name = String(item || '').trim();
    if (!name) return;
    const key = name.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    names.push(name);
  });
  return names;
};

const resolveRoomCatalog = async (instutionCode, hostelName, amenities) => {
  const name = String(hostelName || '').trim();
  if (!name) return { error: 'Select a hostel added in Setup.' };

  const block = await HostelBlock.findOne({
    InstutionCode: instutionCode,
    Status: true,
    Name: new RegExp(`^${escapeRegex(name)}$`, 'i'),
  }).lean();
  if (!block) {
    return { error: 'This hostel is not registered. Add it under Setup first.' };
  }

  const settings = await HostelSettings.findOne({ InstutionCode: instutionCode }).lean();
  const allowed = normalizeAmenities(settings?.Amenities);
  const allowedByKey = new Map(allowed.map((item) => [item.toLowerCase(), item]));
  const chosen = normalizeAmenities(amenities);
  const unknown = chosen.filter((item) => !allowedByKey.has(item.toLowerCase()));
  if (unknown.length) {
    return {
      error: `These amenities are not in Setup: ${unknown.join(', ')}. Add them under Setup first.`,
    };
  }

  return {
    hostelName: block.Name,
    amenities: chosen.map((item) => allowedByKey.get(item.toLowerCase())),
  };
};

const refreshRoomOccupancy = async (roomId) => {
  if (!roomId) return;
  const room = await HostelRoom.findById(roomId);
  if (!room) return;
  const count = await HostelAllocation.countDocuments({ Room_Id: roomId, Status: 'Active' });
  room.Occupied = count;
  room.Available = Math.max(0, Number(room.Capacity || 0) - count);
  room.Updated_At = new Date();
  await room.save();
};

const resolveWarden = async (instutionCode, wardenUserId, { required = false } = {}) => {
  const id = String(wardenUserId || '').trim();
  if (!id) {
    if (required) return { error: 'Select a warden added in Setup.' };
    return { name: '', phone: '', userId: null };
  }
  const warden = await User.findOne({
    _id: id,
    InstutionCode: instutionCode,
    UserType: 'Warden',
  })
    .select('FirstName LastName Phone Active')
    .lean();
  if (!warden) return { error: 'Select a warden added in Setup.' };
  if (warden.Active === false) return { error: 'This warden is inactive. Choose an active warden.' };
  return {
    name: `${warden.FirstName || ''} ${warden.LastName || ''}`.trim(),
    phone: String(warden.Phone || '').trim(),
    userId: warden._id,
  };
};

const loadStudent = async (instutionCode, registrationNumber) =>
  studentModel
    .findOne({
      InstutionCode: instutionCode,
      Registration_Number: registrationNumber,
      Status: true,
    })
    .select('First_Name Last_Name Class Section Contact_Number Registration_Number')
    .lean();

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
    const instutionCode = institutionOf(req);
    const catalog = await resolveRoomCatalog(instutionCode, req.body.Hostel_Name, req.body.Amenities);
    if (catalog.error) return errorResponse(res, catalog.error, 400);

    const roomNumber = String(req.body.Room_Number || '').trim();
    if (!roomNumber) return errorResponse(res, 'Room number is required', 400);

    const capacity = Number(req.body.Capacity || 1);
    const warden = await resolveWarden(instutionCode, req.body.wardenUserId);
    if (warden.error) return errorResponse(res, warden.error, 400);
    const room = await HostelRoom.create({
      InstutionCode: instutionCode,
      Hostel_Name: catalog.hostelName,
      Room_Number: roomNumber,
      Floor: Number(req.body.Floor || 0),
      Room_Type: req.body.Room_Type,
      Sharing: req.body.Sharing,
      For: req.body.For,
      Capacity: capacity,
      Occupied: 0,
      Available: capacity,
      Amenities: catalog.amenities,
      Warden_User_Id: warden.userId,
      Warden_Name: warden.name,
      Warden_Phone: warden.phone,
      Monthly_Rent: Number(req.body.Monthly_Rent || 0),
      Status: true,
    });
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

    const instutionCode = institutionOf(req);
    const catalog = await resolveRoomCatalog(instutionCode, req.body.Hostel_Name, req.body.Amenities);
    if (catalog.error) return errorResponse(res, catalog.error, 400);

    const room = await HostelRoom.findOne({ _id: roomId, InstutionCode: instutionCode });
    if (!room) return errorResponse(res, 'Room not found', 404);

    const roomNumber = String(req.body.Room_Number || room.Room_Number || '').trim();
    if (!roomNumber) return errorResponse(res, 'Room number is required', 400);
    const capacity = Number(req.body.Capacity || room.Capacity || 1);
    const warden = await resolveWarden(instutionCode, req.body.wardenUserId);
    if (warden.error) return errorResponse(res, warden.error, 400);

    room.Hostel_Name = catalog.hostelName;
    room.Room_Number = roomNumber;
    room.Floor = Number(req.body.Floor || 0);
    room.Room_Type = req.body.Room_Type || room.Room_Type;
    room.Sharing = req.body.Sharing || room.Sharing;
    room.For = req.body.For || room.For;
    room.Capacity = capacity;
    room.Available = Math.max(0, capacity - Number(room.Occupied || 0));
    room.Amenities = catalog.amenities;
    room.Warden_User_Id = warden.userId;
    room.Warden_Name = warden.name;
    room.Warden_Phone = warden.phone;
    room.Monthly_Rent = Number(req.body.Monthly_Rent || 0);
    room.Updated_At = new Date();
    await room.save();

    return successResponse(res, room, 'Room updated successfully');
  } catch (error) {
    logger.error('Error updating room:', error);
    return errorResponse(res, 'Failed to update room', 500);
  }
};

const deleteRoom = async (req, res) => {
  try {
    const roomId = req.body.roomId || req.query.roomId;
    if (!roomId) return errorResponse(res, 'Please provide Room ID', 400);

    const activeAllocation = await HostelAllocation.findOne({
      InstutionCode: req.user.InstutionCode,
      Room_Id: roomId,
      Status: 'Active'
    }).lean();
    if (activeAllocation) {
      return errorResponse(res, 'Cannot delete room with active allocation', 400);
    }

    const room = await HostelRoom.findOneAndUpdate(
      { _id: roomId, InstutionCode: req.user.InstutionCode },
      { Status: false, Updated_At: new Date() },
      { new: true }
    );
    if (!room) return errorResponse(res, 'Room not found', 404);

    return successResponse(res, null, 'Room deleted successfully');
  } catch (error) {
    logger.error('Error deleting room:', error);
    return errorResponse(res, 'Failed to delete room', 500);
  }
};

// Room Allocation
const allocateRoom = async (req, res) => {
  try {
    const instutionCode = institutionOf(req);
    const registrationNumber = String(req.body.registrationNumber || '').trim();
    const roomId = req.body.roomId;
    const bedNumber = Number(req.body.bedNumber);

    if (!registrationNumber || !roomId || !bedNumber) {
      return errorResponse(res, 'Please provide registrationNumber, roomId, and bedNumber', 400);
    }

    const student = await loadStudent(instutionCode, registrationNumber);
    if (!student) {
      return errorResponse(res, 'Student not found in this school.', 404);
    }

    const existing = await HostelAllocation.findOne({
      Registration_Number: registrationNumber,
      InstutionCode: instutionCode,
      Status: 'Active',
    });
    if (existing) {
      return errorResponse(
        res,
        `This student already has Bed ${existing.Bed_Number}. Vacate that bed before allotting another.`,
        400
      );
    }

    const room = await HostelRoom.findOne({ _id: roomId, InstutionCode: instutionCode, Status: true });
    if (!room) return errorResponse(res, 'Room not found', 404);

    const activeCount = await HostelAllocation.countDocuments({ Room_Id: room._id, Status: 'Active' });
    if (activeCount >= Number(room.Capacity || 0)) {
      return errorResponse(res, 'This room is full.', 400);
    }
    if (bedNumber < 1 || bedNumber > Number(room.Capacity || 0)) {
      return errorResponse(res, `Bed number must be between 1 and ${room.Capacity}.`, 400);
    }

    const bedTaken = await HostelAllocation.findOne({
      InstutionCode: instutionCode,
      Room_Id: room._id,
      Bed_Number: bedNumber,
      Status: 'Active',
    }).lean();
    if (bedTaken) return errorResponse(res, 'That bed is already occupied.', 400);

    const allocation = await HostelAllocation.create({
      InstutionCode: instutionCode,
      Registration_Number: registrationNumber,
      Student_Name: `${student.First_Name || ''} ${student.Last_Name || ''}`.trim(),
      Class: student.Class || '',
      Section: student.Section || '',
      Phone: student.Contact_Number || '',
      Room_Id: room._id,
      Bed_Number: bedNumber,
      Meal_Plan: req.body.mealPlan || 'Full Board',
      Monthly_Fee: req.body.monthlyFee != null ? Number(req.body.monthlyFee) : room.Monthly_Rent,
      Notes: String(req.body.notes || '').trim(),
    });

    await refreshRoomOccupancy(room._id);
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

    await refreshRoomOccupancy(allocation.Room_Id);

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

const getAllAllocations = async (req, res) => {
  try {
    const status = req.query.status;
    const searchCondition = {
      InstutionCode: req.user.InstutionCode
    };
    if (status) searchCondition.Status = status;

    const allocations = await HostelAllocation.find(searchCondition)
      .populate('Room_Id', 'Hostel_Name Room_Number Room_Type Floor Monthly_Rent')
      .select('-__v')
      .sort({ createdAt: -1 })
      .lean();

    return successResponse(res, allocations, 'Allocations retrieved successfully');
  } catch (error) {
    logger.error('Error fetching allocations:', error);
    return errorResponse(res, 'Failed to fetch allocations', 500);
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

const defaultSettings = () => ({
  MessEnabled: true,
  VisitorsEnabled: true,
  LeaveEnabled: true,
  AttendanceEnabled: true,
  FeeNote: '',
  Amenities: [],
});

const getSettings = async (req, res) => {
  try {
    const instutionCode = institutionOf(req);
    const doc = await HostelSettings.findOne({ InstutionCode: instutionCode }).lean();
    return successResponse(res, doc || { InstutionCode: instutionCode, ...defaultSettings() }, 'Hostel settings');
  } catch (error) {
    logger.error('Error fetching hostel settings:', error);
    return errorResponse(res, 'Failed to fetch hostel settings', 500);
  }
};

const saveSettings = async (req, res) => {
  try {
    if (isStudentUser(req)) return errorResponse(res, 'Only school staff can change hostel setup.', 403);
    const instutionCode = institutionOf(req);
    const existing = await HostelSettings.findOne({ InstutionCode: instutionCode }).lean();
    const amenities = req.body.Amenities === undefined
      ? normalizeAmenities(existing?.Amenities)
      : normalizeAmenities(req.body.Amenities);
    const doc = await HostelSettings.findOneAndUpdate(
      { InstutionCode: instutionCode },
      {
        InstutionCode: instutionCode,
        MessEnabled: req.body.MessEnabled !== false,
        VisitorsEnabled: req.body.VisitorsEnabled !== false,
        LeaveEnabled: req.body.LeaveEnabled !== false,
        AttendanceEnabled: req.body.AttendanceEnabled !== false,
        FeeNote: String(req.body.FeeNote || '').trim(),
        Amenities: amenities,
      },
      { new: true, upsert: true }
    ).lean();
    return successResponse(res, doc, 'Hostel setup saved');
  } catch (error) {
    logger.error('Error saving hostel settings:', error);
    return errorResponse(res, 'Failed to save hostel setup', 500);
  }
};

const getWardens = async (req, res) => {
  try {
    const wardens = await User.find({
      InstutionCode: institutionOf(req),
      UserType: 'Warden',
    })
      .select('FirstName LastName Phone Email UserName MemberId Address Adhar Active')
      .sort({ FirstName: 1, LastName: 1 })
      .lean();
    const rows = wardens.map((warden) => ({ ...warden, Active: warden.Active !== false }));
    return successResponse(res, rows, 'Wardens retrieved');
  } catch (error) {
    logger.error('Error fetching wardens:', error);
    return errorResponse(res, 'Failed to fetch wardens', 500);
  }
};

const getBlocks = async (req, res) => {
  try {
    const blocks = await HostelBlock.find({ InstutionCode: institutionOf(req), Status: true })
      .sort({ Name: 1 })
      .lean();
    return successResponse(res, blocks, 'Hostels retrieved');
  } catch (error) {
    return errorResponse(res, 'Failed to fetch hostels', 500);
  }
};

const saveBlock = async (req, res) => {
  try {
    const instutionCode = institutionOf(req);
    const name = String(req.body.Name || '').trim();
    if (!name) return errorResponse(res, 'Hostel name is required', 400);
    const warden = await resolveWarden(instutionCode, req.body.wardenUserId, { required: true });
    if (warden.error) return errorResponse(res, warden.error, 400);
    const payload = {
      InstutionCode: instutionCode,
      Name: name,
      For: ['Boys', 'Girls', 'Mixed'].includes(req.body.For) ? req.body.For : 'Mixed',
      Warden_User_Id: warden.userId,
      Warden_Name: warden.name,
      Warden_Phone: warden.phone,
      Notes: String(req.body.Notes || '').trim(),
      Status: true,
    };
    let previousName = '';
    if (req.body.blockId) {
      const existing = await HostelBlock.findOne({
        _id: req.body.blockId,
        InstutionCode: instutionCode,
      }).select('Name');
      if (!existing) return errorResponse(res, 'Hostel not found', 404);
      previousName = existing.Name;
    }
    const block = req.body.blockId
      ? await HostelBlock.findOneAndUpdate(
          { _id: req.body.blockId, InstutionCode: instutionCode },
          payload,
          { new: true }
        )
      : await HostelBlock.create(payload);
    if (!block) return errorResponse(res, 'Hostel not found', 404);
    if (previousName && previousName !== name) {
      await HostelRoom.updateMany(
        { InstutionCode: instutionCode, Hostel_Name: previousName },
        { Hostel_Name: name }
      );
    }
    return successResponse(res, block, 'Hostel saved');
  } catch (error) {
    if (error.code === 11000) return errorResponse(res, 'A hostel with this name already exists.', 400);
    return errorResponse(res, 'Failed to save hostel', 500);
  }
};

const getOverview = async (req, res) => {
  try {
    const instutionCode = institutionOf(req);
    const date = String(req.query.date || todayKey());
    const [rooms, activeAllocations, pendingComplaints, todayAbsent, openLeaves, visitorsInside] = await Promise.all([
      HostelRoom.find({ InstutionCode: instutionCode, Status: true }).select('Capacity Occupied Available').lean(),
      HostelAllocation.countDocuments({ InstutionCode: instutionCode, Status: 'Active' }),
      HostelMaintenance.countDocuments({ InstutionCode: instutionCode, Status: { $in: ['Pending', 'In Progress'] } }),
      HostelAttendance.countDocuments({ InstutionCode: instutionCode, Date: date, Status: { $in: ['Absent', 'Leave', 'Outing'] } }),
      HostelLeave.countDocuments({
        InstutionCode: instutionCode,
        Status: 'Approved',
        From_Date: { $lte: date },
        To_Date: { $gte: date },
      }),
      HostelVisitor.countDocuments({ InstutionCode: instutionCode, Out_Time: null }),
    ]);
    const beds = rooms.reduce((sum, room) => sum + Number(room.Capacity || 0), 0);
    const occupied = rooms.reduce((sum, room) => sum + Number(room.Occupied || 0), 0);
    return successResponse(res, {
      rooms: rooms.length,
      beds,
      occupied,
      free: Math.max(0, beds - occupied),
      students: activeAllocations,
      pendingComplaints,
      todayAbsent,
      openLeaves,
      visitorsInside,
      date,
    }, 'Hostel overview');
  } catch (error) {
    logger.error('Error building hostel overview:', error);
    return errorResponse(res, 'Failed to load hostel overview', 500);
  }
};

const getAttendance = async (req, res) => {
  try {
    const date = String(req.query.date || todayKey());
    const rows = await HostelAttendance.find({ InstutionCode: institutionOf(req), Date: date }).lean();
    return successResponse(res, rows, 'Hostel attendance');
  } catch (error) {
    return errorResponse(res, 'Failed to load attendance', 500);
  }
};

const saveAttendance = async (req, res) => {
  try {
    const instutionCode = institutionOf(req);
    const date = String(req.body.date || todayKey());
    const marks = Array.isArray(req.body.marks) ? req.body.marks : [];
    if (!marks.length) return errorResponse(res, 'Add at least one student mark.', 400);
    const ops = marks
      .map((mark) => {
        const registration = String(mark.registrationNumber || '').trim();
        if (!registration) return null;
        return {
          updateOne: {
            filter: { InstutionCode: instutionCode, Date: date, Registration_Number: registration },
            update: {
              $set: {
                Student_Name: String(mark.studentName || '').trim(),
                Hostel_Name: String(mark.hostelName || '').trim(),
                Room_Number: String(mark.roomNumber || '').trim(),
                Status: ['Present', 'Absent', 'Leave', 'Outing'].includes(mark.status) ? mark.status : 'Present',
                Note: String(mark.note || '').trim(),
              },
            },
            upsert: true,
          },
        };
      })
      .filter(Boolean);
    if (ops.length) await HostelAttendance.bulkWrite(ops);
    const rows = await HostelAttendance.find({ InstutionCode: instutionCode, Date: date }).lean();
    return successResponse(res, rows, 'Night roll saved');
  } catch (error) {
    logger.error('Error saving hostel attendance:', error);
    return errorResponse(res, 'Failed to save night roll', 500);
  }
};

const getLeaves = async (req, res) => {
  try {
    const instutionCode = institutionOf(req);
    const filter = { InstutionCode: instutionCode };
    if (isStudentUser(req)) filter.Registration_Number = studentRegistrationOf(req);
    const rows = await HostelLeave.find(filter).sort({ createdAt: -1 }).limit(200).lean();
    return successResponse(res, rows, 'Hostel leaves');
  } catch (error) {
    return errorResponse(res, 'Failed to load leaves', 500);
  }
};

const requestLeave = async (req, res) => {
  try {
    const instutionCode = institutionOf(req);
    const registrationNumber = isStudentUser(req)
      ? studentRegistrationOf(req)
      : String(req.body.registrationNumber || '').trim();
    if (!registrationNumber || !req.body.fromDate || !req.body.toDate || !req.body.reason) {
      return errorResponse(res, 'Student, dates, and reason are required.', 400);
    }
    const student = await loadStudent(instutionCode, registrationNumber);
    const leave = await HostelLeave.create({
      InstutionCode: instutionCode,
      Registration_Number: registrationNumber,
      Student_Name: student
        ? `${student.First_Name || ''} ${student.Last_Name || ''}`.trim()
        : String(req.body.studentName || '').trim(),
      From_Date: String(req.body.fromDate),
      To_Date: String(req.body.toDate),
      Type: req.body.type === 'Outing' ? 'Outing' : 'Leave',
      Reason: String(req.body.reason).trim(),
      Destination: String(req.body.destination || '').trim(),
      Status: isStudentUser(req) ? 'Pending' : (req.body.status || 'Approved'),
      Approved_By: isStudentUser(req) ? '' : String(req.user?.FirstName || req.user?.UserName || 'Office'),
    });
    return successResponse(res, leave, 'Leave saved', 201);
  } catch (error) {
    return errorResponse(res, 'Failed to save leave', 500);
  }
};

const updateLeave = async (req, res) => {
  try {
    if (isStudentUser(req)) return errorResponse(res, 'Only school staff can approve leave.', 403);
    const status = req.body.status;
    if (!['Pending', 'Approved', 'Rejected', 'Returned'].includes(status)) {
      return errorResponse(res, 'Invalid leave status', 400);
    }
    const leave = await HostelLeave.findOneAndUpdate(
      { _id: req.body.leaveId, InstutionCode: institutionOf(req) },
      { Status: status, Approved_By: String(req.user?.FirstName || req.user?.UserName || 'Office') },
      { new: true }
    );
    if (!leave) return errorResponse(res, 'Leave not found', 404);
    return successResponse(res, leave, 'Leave updated');
  } catch (error) {
    return errorResponse(res, 'Failed to update leave', 500);
  }
};

const getVisitors = async (req, res) => {
  try {
    const rows = await HostelVisitor.find({ InstutionCode: institutionOf(req) })
      .sort({ In_Time: -1 })
      .limit(200)
      .lean();
    return successResponse(res, rows, 'Visitors');
  } catch (error) {
    return errorResponse(res, 'Failed to load visitors', 500);
  }
};

const saveVisitor = async (req, res) => {
  try {
    const name = String(req.body.visitorName || '').trim();
    if (!name) return errorResponse(res, 'Visitor name is required', 400);
    const visitor = await HostelVisitor.create({
      InstutionCode: institutionOf(req),
      Visitor_Name: name,
      Relation: String(req.body.relation || '').trim(),
      Phone: String(req.body.phone || '').trim(),
      Registration_Number: String(req.body.registrationNumber || '').trim(),
      Student_Name: String(req.body.studentName || '').trim(),
      Purpose: String(req.body.purpose || '').trim(),
      Id_Note: String(req.body.idNote || '').trim(),
      In_Time: new Date(),
    });
    return successResponse(res, visitor, 'Visitor checked in', 201);
  } catch (error) {
    return errorResponse(res, 'Failed to save visitor', 500);
  }
};

const checkoutVisitor = async (req, res) => {
  try {
    const visitor = await HostelVisitor.findOneAndUpdate(
      { _id: req.body.visitorId, InstutionCode: institutionOf(req) },
      { Out_Time: new Date() },
      { new: true }
    );
    if (!visitor) return errorResponse(res, 'Visitor not found', 404);
    return successResponse(res, visitor, 'Visitor checked out');
  } catch (error) {
    return errorResponse(res, 'Failed to check out visitor', 500);
  }
};

const getMenu = async (req, res) => {
  try {
    const date = String(req.query.date || todayKey());
    const menu = await HostelMenu.findOne({ InstutionCode: institutionOf(req), Date: date }).lean();
    return successResponse(res, menu || { Date: date, Breakfast: '', Lunch: '', Snacks: '', Dinner: '', Note: '' }, 'Mess menu');
  } catch (error) {
    return errorResponse(res, 'Failed to load menu', 500);
  }
};

const listWeeklyMenus = async (req, res) => {
  try {
    const rows = await HostelWeeklyMenu.find({ InstutionCode: institutionOf(req) }).lean();
    const order = new Map(WEEK_DAYS.map((day, index) => [day, index]));
    rows.sort((a, b) => (order.get(a.Day) ?? 7) - (order.get(b.Day) ?? 7));
    return successResponse(res, rows, 'Weekly mess menu');
  } catch (error) {
    return errorResponse(res, 'Failed to load weekly menu', 500);
  }
};

const saveWeeklyMenu = async (req, res) => {
  try {
    if (isStudentUser(req)) return errorResponse(res, 'Only school staff can update the mess menu.', 403);
    const day = String(req.body.day || '').trim();
    if (!WEEK_DAYS.includes(day)) return errorResponse(res, 'Choose a day from Monday to Sunday.', 400);
    const instutionCode = institutionOf(req);
    const fields = { InstutionCode: instutionCode, Day: day, ...menuFields(req.body) };
    const menuId = String(req.body.menuId || '').trim();
    const clash = await HostelWeeklyMenu.findOne({
      InstutionCode: instutionCode,
      Day: day,
      ...(menuId ? { _id: { $ne: menuId } } : {}),
    }).lean();
    if (clash) return errorResponse(res, `${day} already has a menu. Edit that row instead.`, 400);
    const menu = menuId
      ? await HostelWeeklyMenu.findOneAndUpdate(
        { _id: menuId, InstutionCode: instutionCode },
        fields,
        { new: true }
      )
      : await HostelWeeklyMenu.create(fields);
    if (!menu) return errorResponse(res, 'Menu not found', 404);
    return successResponse(res, menu, 'Weekly menu saved', menuId ? 200 : 201);
  } catch (error) {
    return errorResponse(res, 'Failed to save weekly menu', 500);
  }
};

const deleteWeeklyMenu = async (req, res) => {
  try {
    if (isStudentUser(req)) return errorResponse(res, 'Only school staff can update the mess menu.', 403);
    const menu = await HostelWeeklyMenu.findOneAndDelete({
      _id: req.body.menuId,
      InstutionCode: institutionOf(req),
    });
    if (!menu) return errorResponse(res, 'Menu not found', 404);
    return successResponse(res, menu, 'Menu deleted');
  } catch (error) {
    return errorResponse(res, 'Failed to delete menu', 500);
  }
};

const saveMenu = async (req, res) => {
  try {
    if (isStudentUser(req)) return errorResponse(res, 'Only school staff can update the mess menu.', 403);
    const date = String(req.body.date || todayKey());
    const menu = await HostelMenu.findOneAndUpdate(
      { InstutionCode: institutionOf(req), Date: date },
      {
        InstutionCode: institutionOf(req),
        Date: date,
        Breakfast: String(req.body.breakfast || '').trim(),
        Lunch: String(req.body.lunch || '').trim(),
        Snacks: String(req.body.snacks || '').trim(),
        Dinner: String(req.body.dinner || '').trim(),
        Note: String(req.body.note || '').trim(),
      },
      { new: true, upsert: true }
    );
    return successResponse(res, menu, 'Mess menu saved');
  } catch (error) {
    return errorResponse(res, 'Failed to save menu', 500);
  }
};

const feePaymentsFor = (instutionCode, allocationIds) => HostelFeePayment.find({
  InstutionCode: instutionCode,
  ...(allocationIds ? { Allocation_Id: { $in: allocationIds } } : {}),
}).sort({ Paid_On: -1, createdAt: -1 }).lean();

const getFeeLedger = async (req, res) => {
  try {
    const instutionCode = institutionOf(req);
    const allocations = await HostelAllocation.find({ InstutionCode: instutionCode })
      .populate('Room_Id')
      .sort({ Status: 1, Student_Name: 1 })
      .lean();
    const payments = await feePaymentsFor(instutionCode);
    const byAllocation = new Map();
    payments.forEach((payment) => {
      const key = String(payment.Allocation_Id);
      if (!byAllocation.has(key)) byAllocation.set(key, []);
      byAllocation.get(key).push(payment);
    });
    const boarders = allocations.map((allocation) => buildBoarderLedger(
      allocation,
      byAllocation.get(String(allocation._id)) || []
    ));
    return successResponse(res, {
      boarders,
      payments: payments.slice(0, 200).map(publicPayment),
    }, 'Hostel fees');
  } catch (error) {
    logger.error('Error loading hostel fees:', error);
    return errorResponse(res, 'Failed to load hostel fees', 500);
  }
};

const publicPayment = (payment) => ({
  _id: payment._id,
  receiptNo: payment.Receipt_No,
  allocationId: payment.Allocation_Id,
  registrationNumber: payment.Registration_Number,
  studentName: payment.Student_Name,
  className: payment.Class,
  section: payment.Section,
  hostelName: payment.Hostel_Name,
  roomNumber: payment.Room_Number,
  bedNumber: payment.Bed_Number,
  months: payment.Months || [],
  amount: payment.Amount,
  paymentMode: payment.Payment_Mode,
  reference: payment.Reference || '',
  paidOn: payment.Paid_On,
  note: payment.Note || '',
  collectedBy: payment.Collected_By || '',
});

const collectHostelFee = async (req, res) => {
  try {
    if (isStudentUser(req)) return errorResponse(res, 'Only school staff can collect hostel fees.', 403);
    const instutionCode = institutionOf(req);
    const allocation = await HostelAllocation.findOne({
      _id: req.body.allocationId,
      InstutionCode: instutionCode,
    }).populate('Room_Id');
    if (!allocation) return errorResponse(res, 'Boarder not found', 404);
    const mode = String(req.body.paymentMode || 'Cash');
    if (!['Cash', 'UPI', 'Bank', 'Cheque'].includes(mode)) {
      return errorResponse(res, 'Choose a valid payment mode.', 400);
    }
    const paidOn = String(req.body.paidOn || todayKey());
    if (!/^\d{4}-\d{2}-\d{2}$/.test(paidOn)) return errorResponse(res, 'Payment date is required.', 400);
    const requested = Array.isArray(req.body.lines) ? req.body.lines : [];
    const payments = await feePaymentsFor(instutionCode, [allocation._id]);
    const ledger = buildBoarderLedger(allocation, payments);
    const remaining = new Map(ledger.months.map((row) => [row.month, row.balance]));
    const lines = [];
    requested.forEach((line) => {
      const month = String(line.month || '');
      const amount = roundMoney(line.amount);
      if (!month || amount <= 0) return;
      const due = remaining.get(month);
      if (due == null) return;
      if (amount - due > 0.001) return;
      lines.push({ Month: month, Label: monthLabel(month), Amount: amount });
    });
    if (!lines.length) return errorResponse(res, 'Enter an amount for at least one due month.', 400);
    const over = requested.some((line) => {
      const amount = roundMoney(line.amount);
      if (amount <= 0) return false;
      const due = remaining.get(String(line.month || ''));
      return due == null || amount - due > 0.001;
    });
    if (over) return errorResponse(res, 'Amount is higher than the balance for a selected month.', 400);
    const amount = roundMoney(lines.reduce((sum, line) => sum + line.Amount, 0));
    const room = allocation.Room_Id || {};
    const collectedBy = [req.user?.FirstName, req.user?.LastName].filter(Boolean).join(' ').trim()
      || req.user?.UserName
      || 'Office';
    let payment = null;
    for (let attempt = 0; attempt < 3 && !payment; attempt += 1) {
      const count = await HostelFeePayment.countDocuments({ InstutionCode: instutionCode });
      const receiptNo = `HST-${String(count + 1 + attempt).padStart(4, '0')}`;
      try {
        payment = await HostelFeePayment.create({
          InstutionCode: instutionCode,
          Receipt_No: receiptNo,
          Allocation_Id: allocation._id,
          Registration_Number: allocation.Registration_Number,
          Student_Name: allocation.Student_Name,
          Class: allocation.Class,
          Section: allocation.Section,
          Hostel_Name: room.Hostel_Name || '',
          Room_Number: room.Room_Number || '',
          Bed_Number: allocation.Bed_Number,
          Months: lines,
          Amount: amount,
          Payment_Mode: mode,
          Reference: String(req.body.reference || '').trim(),
          Paid_On: paidOn,
          Note: String(req.body.note || '').trim(),
          Collected_By: collectedBy,
        });
      } catch (error) {
        if (error?.code !== 11000) throw error;
      }
    }
    if (!payment) return errorResponse(res, 'Could not create the receipt. Try again.', 500);
    return successResponse(res, publicPayment(payment), 'Hostel fee collected', 201);
  } catch (error) {
    logger.error('Error collecting hostel fee:', error);
    return errorResponse(res, 'Failed to collect hostel fee', 500);
  }
};

const getMyStay = async (req, res) => {
  try {
    const instutionCode = institutionOf(req);
    const registrationNumber = isStudentUser(req)
      ? studentRegistrationOf(req)
      : String(req.query.registrationNumber || '').trim();
    if (!registrationNumber) return errorResponse(res, 'Registration number is required', 400);
    const allocation = await HostelAllocation.findOne({
      InstutionCode: instutionCode,
      Registration_Number: registrationNumber,
      Status: 'Active',
    })
      .populate('Room_Id')
      .lean();
    const block = allocation?.Room_Id?.Hostel_Name
      ? await HostelBlock.findOne({ InstutionCode: instutionCode, Name: allocation.Room_Id.Hostel_Name, Status: true }).lean()
      : null;
    const settings = (await HostelSettings.findOne({ InstutionCode: instutionCode }).lean()) || defaultSettings();
    const weekday = todayWeekday();
    const weekly = await HostelWeeklyMenu.findOne({ InstutionCode: instutionCode, Day: weekday }).lean();
    const menu = weekly || await HostelMenu.findOne({ InstutionCode: instutionCode, Date: todayKey() }).lean();
    let fee = null;
    if (allocation) {
      const payments = await feePaymentsFor(instutionCode, [allocation._id]);
      const ledger = buildBoarderLedger(allocation, payments);
      fee = {
        ...ledger,
        payments: payments.slice(0, 12).map(publicPayment),
      };
    }
    return successResponse(res, { allocation, block, settings, menu, fee, date: todayKey(), weekday }, 'Hostel stay');
  } catch (error) {
    return errorResponse(res, 'Failed to load hostel stay', 500);
  }
};

module.exports = {
  getAllRooms,
  addRoom,
  updateRoom,
  deleteRoom,
  allocateRoom,
  releaseRoom,
  getStudentAllocation,
  getAllAllocations,
  createMaintenanceRequest,
  getAllMaintenanceRequests,
  updateMaintenanceStatus,
  getSettings,
  saveSettings,
  getWardens,
  getBlocks,
  saveBlock,
  getOverview,
  getAttendance,
  saveAttendance,
  getLeaves,
  requestLeave,
  updateLeave,
  getVisitors,
  saveVisitor,
  checkoutVisitor,
  getMenu,
  saveMenu,
  listWeeklyMenus,
  saveWeeklyMenu,
  deleteWeeklyMenu,
  getFeeLedger,
  collectHostelFee,
  getMyStay,
};

