const express = require('express');
const router = express.Router();
const multer = require('multer');
const studentDocumentManager = require('../controller/StudentDocumentManager');
const authenticate = require('../middleware/authenticate');

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });



router.post('/upload-document', authenticate, upload.any(), studentDocumentManager.uploaddoc);

module.exports = router;