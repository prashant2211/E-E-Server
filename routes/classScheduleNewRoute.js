const express = require('express')
const router = express.Router()

const classScheduleController = require('../controller/classScheduleNewController')
const authenticate = require('../middleware/authenticate')

// List schedules with filters
router.get('/', authenticate, classScheduleController.index)

// Get combined schedule (permanent + temporary) for a given class and date
router.get('/by-class-date', authenticate, classScheduleController.getByClassAndDate)

// Create new schedule (permanent or temporary)
router.post('/', authenticate, classScheduleController.store)

module.exports = router


