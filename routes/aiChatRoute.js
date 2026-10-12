const express = require('express')
const router = express.Router()
const authenticate = require('../middleware/authenticate')
const aiChatController = require('../controller/aiChatController')

// AI chat endpoint - students and other authenticated users can use
router.post('/message', authenticate, aiChatController.sendMessage)

module.exports = router


