const express       = require('express')
const router        = express.Router()

const adminissionController = require('../controller/admissionController')
const authenticate       = require('../middleware/authenticate')

router.get('/get-Chat', authenticate, adminissionController.index)
router.get('/post-chat', authenticate, adminissionController.show)
router.post('/delete-chat', authenticate, adminissionController.store)

module.exports = router