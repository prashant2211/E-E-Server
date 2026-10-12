const express = require('express')
const router = express.Router()
const authenticate = require('../middleware/authenticate')
const admitCardController = require('../controller/admitCardController')

// Single student admit card
router.get('/student', authenticate, admitCardController.generateStudentAdmitCard)

// Class-wise admit cards
router.get('/class', authenticate, admitCardController.generateClassAdmitCards)

module.exports = router

