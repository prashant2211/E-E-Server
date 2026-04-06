const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/authenticate');
const homeworkController = require('../controller/homeworkController');

// Homework Management
router.get('/get-all-homework', authenticate, homeworkController.getAllHomework);
router.post('/create-homework', authenticate, homeworkController.createHomework);
router.patch('/update-homework', authenticate, homeworkController.updateHomework);
router.delete('/delete-homework', authenticate, homeworkController.deleteHomework);

// Submission Management
router.post('/submit-homework', authenticate, homeworkController.submitHomework);
router.patch('/grade-homework', authenticate, homeworkController.gradeHomework);
router.get('/get-student-submissions', authenticate, homeworkController.getStudentSubmissions);
router.get('/get-homework-submissions', authenticate, homeworkController.getHomeworkSubmissions);

module.exports = router;

