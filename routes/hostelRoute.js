const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/authenticate');
const hostelController = require('../controller/hostelController');

// Room Management
router.get('/get-all-rooms', authenticate, hostelController.getAllRooms);
router.post('/add-room', authenticate, hostelController.addRoom);
router.patch('/update-room', authenticate, hostelController.updateRoom);
router.delete('/delete-room', authenticate, hostelController.deleteRoom);

// Room Allocation
router.post('/allocate-room', authenticate, hostelController.allocateRoom);
router.post('/release-room', authenticate, hostelController.releaseRoom);
router.get('/get-student-allocation', authenticate, hostelController.getStudentAllocation);
router.get('/get-all-allocations', authenticate, hostelController.getAllAllocations);

// Maintenance Management
router.post('/create-maintenance', authenticate, hostelController.createMaintenanceRequest);
router.get('/get-all-maintenance', authenticate, hostelController.getAllMaintenanceRequests);
router.patch('/update-maintenance', authenticate, hostelController.updateMaintenanceStatus);

router.get('/overview', authenticate, hostelController.getOverview);
router.get('/settings', authenticate, hostelController.getSettings);
router.patch('/settings', authenticate, hostelController.saveSettings);
router.get('/wardens', authenticate, hostelController.getWardens);
router.get('/blocks', authenticate, hostelController.getBlocks);
router.post('/blocks', authenticate, hostelController.saveBlock);
router.get('/attendance', authenticate, hostelController.getAttendance);
router.post('/attendance', authenticate, hostelController.saveAttendance);
router.get('/leaves', authenticate, hostelController.getLeaves);
router.post('/leaves', authenticate, hostelController.requestLeave);
router.patch('/leaves', authenticate, hostelController.updateLeave);
router.get('/visitors', authenticate, hostelController.getVisitors);
router.post('/visitors', authenticate, hostelController.saveVisitor);
router.patch('/visitors/checkout', authenticate, hostelController.checkoutVisitor);
router.get('/menu', authenticate, hostelController.getMenu);
router.post('/menu', authenticate, hostelController.saveMenu);
router.get('/weekly-menu', authenticate, hostelController.listWeeklyMenus);
router.post('/weekly-menu', authenticate, hostelController.saveWeeklyMenu);
router.delete('/weekly-menu', authenticate, hostelController.deleteWeeklyMenu);
router.get('/fees', authenticate, hostelController.getFeeLedger);
router.post('/fees', authenticate, hostelController.collectHostelFee);
router.get('/my-stay', authenticate, hostelController.getMyStay);

module.exports = router;

