const { Homework, HomeworkSubmission } = require('../models/homeworkModel');
const { logger } = require('../utils/logger');
const { successResponse, errorResponse, paginatedResponse } = require('../utils/response');
const { cache } = require('../utils/cache');

// Homework Management
const getAllHomework = async (req, res) => {
  try {
    const page = parseInt(req.query.PageNumber) || 1;
    const limit = parseInt(req.query.PageSize) || 10;
    const skip = (page - 1) * limit;
    const classFilter = req.query.class;
    const status = req.query.status;

    let searchCondition = {
      InstutionCode: req.user.InstutionCode
    };

    if (classFilter) {
      searchCondition.Class = classFilter;
    }

    if (status) {
      searchCondition.Status = status;
    }

    const [homework, totalCount] = await Promise.all([
      Homework.find(searchCondition)
        .populate('Teacher_Id', 'First_Name Last_Name')
        .select('-__v')
        .sort({ Due_Date: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Homework.countDocuments(searchCondition)
    ]);

    return paginatedResponse(res, homework, {
      page,
      pageSize: limit,
      total: totalCount
    }, 'Homework retrieved successfully');
  } catch (error) {
    logger.error('Error fetching homework:', error);
    return errorResponse(res, 'Failed to fetch homework', 500);
  }
};

const createHomework = async (req, res) => {
  try {
    const homework = await Homework.create({
      ...req.body,
      InstutionCode: req.user.InstutionCode,
      Assigned_By: req.user.FirstName + ' ' + req.user.LastName
    });

    return successResponse(res, homework, 'Homework created successfully', 201);
  } catch (error) {
    logger.error('Error creating homework:', error);
    return errorResponse(res, 'Failed to create homework', 500);
  }
};

const updateHomework = async (req, res) => {
  try {
    const homeworkId = req.body.homeworkId || req.body._id;
    if (!homeworkId) return errorResponse(res, 'Please provide Homework ID', 400);

    const homework = await Homework.findOneAndUpdate(
      { _id: homeworkId, InstutionCode: req.user.InstutionCode },
      req.body,
      { new: true }
    ).select('-__v');

    if (!homework) return errorResponse(res, 'Homework not found', 404);
    return successResponse(res, homework, 'Homework updated successfully');
  } catch (error) {
    logger.error('Error updating homework:', error);
    return errorResponse(res, 'Failed to update homework', 500);
  }
};

const deleteHomework = async (req, res) => {
  try {
    const homeworkId = req.body.homeworkId;
    if (!homeworkId) return errorResponse(res, 'Please provide Homework ID', 400);

    const homework = await Homework.findOneAndDelete({
      _id: homeworkId,
      InstutionCode: req.user.InstutionCode
    });

    if (!homework) return errorResponse(res, 'Homework not found', 404);
    return successResponse(res, null, 'Homework deleted successfully');
  } catch (error) {
    logger.error('Error deleting homework:', error);
    return errorResponse(res, 'Failed to delete homework', 500);
  }
};

// Submission Management
const submitHomework = async (req, res) => {
  try {
    const { homeworkId, registrationNumber, submittedContent, attachments } = req.body;

    if (!homeworkId || !registrationNumber) {
      return errorResponse(res, 'Please provide homeworkId and registrationNumber', 400);
    }

    // Check if already submitted
    const existing = await HomeworkSubmission.findOne({
      Homework_Id: homeworkId,
      Registration_Number: registrationNumber
    });

    if (existing) {
      return errorResponse(res, 'Homework already submitted', 400);
    }

    // Check if due date passed
    const homework = await Homework.findById(homeworkId);
    if (!homework) {
      return errorResponse(res, 'Homework not found', 404);
    }

    const isLate = new Date() > new Date(homework.Due_Date);
    const status = isLate ? 'Late' : 'Submitted';

    const submission = await HomeworkSubmission.create({
      InstutionCode: req.user.InstutionCode,
      Homework_Id: homeworkId,
      Registration_Number: registrationNumber,
      Submitted_Content: submittedContent,
      Attachments: attachments || [],
      Status: status
    });

    return successResponse(res, submission, 'Homework submitted successfully', 201);
  } catch (error) {
    logger.error('Error submitting homework:', error);
    return errorResponse(res, 'Failed to submit homework', 500);
  }
};

const gradeHomework = async (req, res) => {
  try {
    const { submissionId, marksObtained, feedback } = req.body;

    if (!submissionId || marksObtained === undefined) {
      return errorResponse(res, 'Please provide submissionId and marksObtained', 400);
    }

    const submission = await HomeworkSubmission.findOne({
      _id: submissionId,
      InstutionCode: req.user.InstutionCode
    });

    if (!submission) {
      return errorResponse(res, 'Submission not found', 404);
    }

    submission.Marks_Obtained = marksObtained;
    submission.Feedback = feedback;
    submission.Status = 'Graded';
    submission.Graded_By = req.user.FirstName + ' ' + req.user.LastName;
    submission.Graded_Date = new Date();
    await submission.save();

    return successResponse(res, submission, 'Homework graded successfully');
  } catch (error) {
    logger.error('Error grading homework:', error);
    return errorResponse(res, 'Failed to grade homework', 500);
  }
};

const getStudentSubmissions = async (req, res) => {
  try {
    const registrationNumber = req.query.registrationNumber;
    const homeworkId = req.query.homeworkId;

    if (!registrationNumber) {
      return errorResponse(res, 'Please provide Registration Number', 400);
    }

    let searchCondition = {
      InstutionCode: req.user.InstutionCode,
      Registration_Number: registrationNumber
    };

    if (homeworkId) {
      searchCondition.Homework_Id = homeworkId;
    }

    const submissions = await HomeworkSubmission.find(searchCondition)
      .populate('Homework_Id', 'Title Description Due_Date Total_Marks')
      .select('-__v')
      .sort({ Submission_Date: -1 })
      .lean();

    return successResponse(res, submissions, 'Submissions retrieved successfully');
  } catch (error) {
    logger.error('Error fetching submissions:', error);
    return errorResponse(res, 'Failed to fetch submissions', 500);
  }
};

const getHomeworkSubmissions = async (req, res) => {
  try {
    const homeworkId = req.query.homeworkId;
    const status = req.query.status;

    if (!homeworkId) {
      return errorResponse(res, 'Please provide Homework ID', 400);
    }

    let searchCondition = {
      InstutionCode: req.user.InstutionCode,
      Homework_Id: homeworkId
    };

    if (status) {
      searchCondition.Status = status;
    }

    const submissions = await HomeworkSubmission.find(searchCondition)
      .select('-__v')
      .sort({ Submission_Date: -1 })
      .lean();

    return successResponse(res, submissions, 'Submissions retrieved successfully');
  } catch (error) {
    logger.error('Error fetching submissions:', error);
    return errorResponse(res, 'Failed to fetch submissions', 500);
  }
};

module.exports = {
  getAllHomework,
  createHomework,
  updateHomework,
  deleteHomework,
  submitHomework,
  gradeHomework,
  getStudentSubmissions,
  getHomeworkSubmissions
};

