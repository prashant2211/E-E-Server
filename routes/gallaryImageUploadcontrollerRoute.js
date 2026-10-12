const express = require('express');
const router = express.Router();
const multer = require('multer');
const gallaryImageUploadController = require('../controller/gallaryImageUploadController');
const authenticate = require('../middleware/authenticate');

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

router.post('/upload-image', authenticate, upload.any(), gallaryImageUploadController.uploadImage);
router.get('/get-image', upload.any(), gallaryImageUploadController.listImagesInFolder);

module.exports = router;