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
router.patch('/update-driver', authenticate, transportController.updateDriver);
router.delete('/delete-driver', authenticate, transportController.deleteDriver);

// Route Management
router.get('/get-all-routes', authenticate, transportController.getAllRoutes);
router.post('/add-route', authenticate, transportController.addRoute);
router.patch('/update-route', authenticate, transportController.updateRoute);
router.delete('/delete-route', authenticate, transportController.deleteRoute);

// Student Transport Assignment
router.post('/assign-transport', authenticate, transportController.assignStudentTransport);
router.get('/get-student-transport', authenticate, transportController.getStudentTransport);
router.get('/get-all-student-transport', authenticate, transportController.getAllStudentTransport);
router.patch('/update-student-transport', authenticate, transportController.updateStudentTransport);
router.delete('/remove-student-transport', authenticate, transportController.removeStudentTransport);

module.exports = router;

