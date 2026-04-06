const express       = require('express')
const router        = express.Router()

const holidaysController = require('../controller/holidaysController')
const authenticate       = require('../middleware/authenticate')

router.get('/get-holidays', authenticate, holidaysController.show)
router.post('/add-holidays', authenticate, holidaysController.store)
// router.delete('/delete-announcement', authenticate, announcementController.destroy)

module.exports = router