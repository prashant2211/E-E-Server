const express = require('express');
const router = express.Router();
const timetableController = require('../controller/timetableController');
const authenticate = require('../middleware/authenticate');

// Get all timetables with pagination
router.get('/', authenticate, timetableController.index);

// Get timetable by class and section (for weekly view)
router.get('/by-class-section', authenticate, timetableController.getByClassSection);

// Get single timetable
router.get('/:id', authenticate, timetableController.show);

// Create timetable
router.post('/', authenticate, timetableController.store);

// Update timetable
router.put('/:id', authenticate, timetableController.update);
router.patch('/:id', authenticate, timetableController.update);

// Delete timetable
router.delete('/:id', authenticate, timetableController.destroy);

module.exports = router;

