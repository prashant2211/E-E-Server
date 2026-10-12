const express = require('express');
const router = express.Router();
const multer = require('multer');
const authenticate = require('../middleware/authenticate');
const homeworkController = require('../controller/homeworkController');
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

// Homework Management
router.get('/get-all-homework', authenticate, homeworkController.getAllHomework);
router.post('/create-homework', authenticate, homeworkController.createHomework);
router.patch('/update-homework', authenticate, homeworkController.updateHomework);
router.delete('/delete-homework', authenticate, homeworkController.deleteHomework);
router.post(
  '/upload-homework-attachment',
  authenticate,
  upload.single('file'),
  homeworkController.uploadHomeworkAttachment
);
router.post(
  '/upload-submission-attachment',
  authenticate,
  upload.single('file'),
  homeworkController.uploadSubmissionAttachment
);

// Submission Management
router.post('/submit-homework', authenticate, homeworkController.submitHomework);
router.patch('/grade-homework', authenticate, homeworkController.gradeHomework);
router.get('/get-student-submissions', authenticate, homeworkController.getStudentSubmissions);
router.get('/get-homework-submissions', authenticate, homeworkController.getHomeworkSubmissions);

module.exports = router;

