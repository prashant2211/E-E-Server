const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/authenticate');
const hostelController = require('../controller/hostelController');

// Room Management
router.get('/get-all-rooms', authenticate, hostelController.getAllRooms);
router.post('/add-room', authenticate, hostelController.addRoom);
router.patch('/update-room', authenticate, hostelController.updateRoom);

// Room Allocation
router.post('/allocate-room', authenticate, hostelController.allocateRoom);
router.post('/release-room', authenticate, hostelController.releaseRoom);
router.get('/get-student-allocation', authenticate, hostelController.getStudentAllocation);

// Maintenance Management
router.post('/create-maintenance', authenticate, hostelController.createMaintenanceRequest);
router.get('/get-all-maintenance', authenticate, hostelController.getAllMaintenanceRequests);
router.patch('/update-maintenance', authenticate, hostelController.updateMaintenanceStatus);

module.exports = router;

