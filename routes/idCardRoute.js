const express = require('express')
const router = express.Router()

const idCardController = require('../controller/idCardController')
const authenticate = require('../middleware/authenticate')

// Generate ID card for a single student
router.get('/generate', authenticate, idCardController.generateIdCard)

// Generate ID cards for multiple students (bulk)
router.post('/generate-bulk', authenticate, idCardController.generateBulkIdCards)

module.exports = router

