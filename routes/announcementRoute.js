const express = require('express')
const router = express.Router()
const multer = require('multer')

const announcementController = require('../controller/NotificationAndAnouncement')
const authenticate = require('../middleware/authenticate')

const storage = multer.memoryStorage()
const upload = multer({ storage: storage })

// Get announcements for current institution / user
router.get('/get-announcement', authenticate, announcementController.show)

// Create announcement (supports optional attachment upload)
router.post(
  '/add-announcement',
  authenticate,
  upload.any(), // Expect optional file under any field name (e.g., "file")
  announcementController.store
)

// Delete announcement
router.delete('/delete-announcement', authenticate, announcementController.destroy)

module.exports = router