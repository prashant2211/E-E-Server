const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/authenticate');
const transportController = require('../controller/transportController');

// Vehicle Management
router.get('/get-all-vehicles', authenticate, transportController.getAllVehicles);
router.post('/add-vehicle', authenticate, transportController.addVehicle);
router.patch('/update-vehicle', authenticate, transportController.updateVehicle);
router.delete('/delete-vehicle', authenticate, transportController.deleteVehicle);

// Driver Management
router.get('/get-all-drivers', authenticate, transportController.getAllDrivers);
router.post('/add-driver', authenticate, transportController.addDriver);

// Route Management
router.get('/get-all-routes', authenticate, transportController.getAllRoutes);
router.post('/add-route', authenticate, transportController.addRoute);

// Student Transport Assignment
router.post('/assign-transport', authenticate, transportController.assignStudentTransport);
router.get('/get-student-transport', authenticate, transportController.getStudentTransport);

module.exports = router;

