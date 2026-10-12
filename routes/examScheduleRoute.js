const express = require('express')
const router = express.Router()

const examScheduleController = require('../controller/examScheduleController')
const authenticate = require('../middleware/authenticate')

// Get all exam schedules (with filters)
router.get('/get-all-exams', authenticate, examScheduleController.index)

// Get single exam schedule by ID
router.get('/get-exam', authenticate, examScheduleController.show)

// Create new exam schedule
router.post('/create-exam', authenticate, examScheduleController.store)

// Update exam schedule
router.patch('/update-exam', authenticate, examScheduleController.update)

// Delete exam schedule
router.delete('/delete-exam', authenticate, examScheduleController.destroy)

module.exports = router

