const express = require('express');
const router = express.Router();

const teacherDocumentManager = require('../controller/teacherDocumentManager');
const authenticate = require('../middleware/authenticate');
const multer = require('multer');

const storage = multer.memoryStorage();
const upload = multer({ storage });

    router.post('/upload_Teacher_Doc', authenticate, upload.any(), teacherDocumentManager.uploaddoc);
// router.post('/upload_Teacher_Doc', authenticate,teacherDocumentManager.uploaddoc)
//router.post('/raiseTicket', authenticate, supportTicket.store)
module.exports = router;
