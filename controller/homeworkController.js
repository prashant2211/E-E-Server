const { Homework, HomeworkSubmission } = require('../models/homeworkModel');
const { logger } = require('../utils/logger');
const { successResponse, errorResponse, paginatedResponse } = require('../utils/response');
const { cache } = require('../utils/cache');
const AWS = require('aws-sdk');
const mongoose = require('mongoose');

const ACCESS_KEY = process.env.ACCESS_KEY;
const SECRET_ACCESS_KEY = process.env.SECRET_ACCESS_KEY;
const BUCKET_NAME = process.env.BUCKET_NAME;
const AWS_REGION = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'ap-southeast-2';

const s3 = new AWS.S3({
  accessKeyId: ACCESS_KEY,
  secretAccessKey: SECRET_ACCESS_KEY,
  region: AWS_REGION,
});

const safeSegment = (input, fallback = 'default') => {
  const cleaned = String(input || '')
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9_\-]/g, '')
    .slice(0, 80);
  return cleaned || fallback;
};

const parseAttachments = (attachments) => {
  if (!attachments) return [];
  if (Array.isArray(attachments)) return attachments;
  if (typeof attachments === 'string') {
    try {
      const parsed = JSON.parse(attachments);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
};

const uploadToS3 = async (buffer, key, contentType) => {
  if (!BUCKET_NAME || !ACCESS_KEY || !SECRET_ACCESS_KEY) {
    throw new Error('S3 configuration missing (ACCESS_KEY, SECRET_ACCESS_KEY, BUCKET_NAME)');
  }
  return s3
    .upload({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: contentType || 'application/octet-stream',
    })
    .promise();
};

const deleteFromS3 = async (key) => {
  if (!key || !BUCKET_NAME || !ACCESS_KEY || !SECRET_ACCESS_KEY) return;
  try {
    await s3
      .deleteObject({
        Bucket: BUCKET_NAME,
        Key: key,
      })
      .promise();
  } catch (error) {
    logger.warn(`Failed to delete S3 object "${key}": ${error.message}`);
  }
};

const resolveAttachmentKey = (attachment = {}) => {
  if (attachment.S3_Key) return attachment.S3_Key;
  if (attachment.Key) return attachment.Key;
  const rawUrl = String(attachment.File_URL || '').trim();
  if (!rawUrl) return null;
  try {
    const parsed = new URL(rawUrl);
    const keyFromPath = decodeURIComponent((parsed.pathname || '').replace(/^\/+/, ''));
    return keyFromPath || null;
  } catch {
    return null;
  }
};

const withSignedAttachmentUrls = async (items = []) => {
  if (!Array.isArray(items) || !BUCKET_NAME || !ACCESS_KEY || !SECRET_ACCESS_KEY) return items;
  return Promise.all(
    items.map(async (item) => {
      const cloned = { ...item };
      const list = Array.isArray(cloned.Attachments) ? cloned.Attachments : [];
      cloned.Attachments = await Promise.all(
        list.map(async (att) => {
          const key = resolveAttachmentKey(att);
          if (!key) return att;
          try {
            const signed = await s3.getSignedUrlPromise('getObject', {
              Bucket: BUCKET_NAME,
              Key: key,
              Expires: 60 * 60, // 1 hour
            });
            return {
              ...att,
              S3_Key: key,
              Signed_URL: signed,
            };
          } catch {
            return {
              ...att,
              S3_Key: key,
            };
          }
        })
      );
      return cloned;
    })
  );
};

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
    const homeworkWithSignedUrls = await withSignedAttachmentUrls(homework);

    return paginatedResponse(res, homeworkWithSignedUrls, {
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
    const attachments = parseAttachments(req.body.Attachments);
    const teacherIdRaw = req.body.Teacher_Id || req.body.teacherId;
    const teacherId = mongoose.Types.ObjectId.isValid(teacherIdRaw) ? teacherIdRaw : undefined;
    const homework = await Homework.create({
      Title: req.body.Title || req.body.title,
      Description: req.body.Description || req.body.description,
      Class: req.body.Class || req.body.class,
      Subject: req.body.Subject || req.body.subject,
      Due_Date: req.body.Due_Date || req.body.dueDate || req.body.due_date,
      Total_Marks: req.body.Total_Marks || req.body.totalMarks || 100,
      ...(teacherId ? { Teacher_Id: teacherId } : {}),
      Status: req.body.Status || req.body.status || 'Active',
      Attachments: attachments,
      InstutionCode: req.user.InstutionCode,
      Assigned_By: [req.user.FirstName, req.user.LastName].filter(Boolean).join(' ').trim() || req.user.UserName || 'Teacher'
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
    const attachments = parseAttachments(req.body.Attachments);
    const existingHomework = await Homework.findOne({
      _id: homeworkId,
      InstutionCode: req.user.InstutionCode,
    }).lean();
    if (!existingHomework) return errorResponse(res, 'Homework not found', 404);

    const teacherIdRaw = req.body.Teacher_Id || req.body.teacherId;
    const teacherId = mongoose.Types.ObjectId.isValid(teacherIdRaw) ? teacherIdRaw : undefined;
    const updatePayload = {
      ...req.body,
      ...(req.body.Title || req.body.title ? { Title: req.body.Title || req.body.title } : {}),
      ...(req.body.Description || req.body.description ? { Description: req.body.Description || req.body.description } : {}),
      ...(req.body.Class || req.body.class ? { Class: req.body.Class || req.body.class } : {}),
      ...(req.body.Subject || req.body.subject ? { Subject: req.body.Subject || req.body.subject } : {}),
      ...(req.body.Due_Date || req.body.dueDate ? { Due_Date: req.body.Due_Date || req.body.dueDate } : {}),
      ...(req.body.Total_Marks || req.body.totalMarks ? { Total_Marks: req.body.Total_Marks || req.body.totalMarks } : {}),
      ...(req.body.Status || req.body.status ? { Status: req.body.Status || req.body.status } : {}),
      ...(teacherId ? { Teacher_Id: teacherId } : {}),
      ...(attachments.length > 0 || req.body.Attachments ? { Attachments: attachments } : {}),
      Updated_At: new Date(),
    };
    delete updatePayload.homeworkId;
    delete updatePayload._id;
    delete updatePayload.title;
    delete updatePayload.description;
    delete updatePayload.class;
    delete updatePayload.subject;
    delete updatePayload.dueDate;
    delete updatePayload.totalMarks;
    delete updatePayload.status;
    delete updatePayload.teacherId;

    const previousAttachments = Array.isArray(existingHomework.Attachments)
      ? existingHomework.Attachments
      : [];
    const nextAttachments =
      attachments.length > 0 || req.body.Attachments
        ? attachments
        : previousAttachments;
    const previousKeys = previousAttachments
      .map((a) => resolveAttachmentKey(a))
      .filter(Boolean);
    const nextKeys = nextAttachments
      .map((a) => resolveAttachmentKey(a))
      .filter(Boolean);
    const removedKeys = previousKeys.filter((key) => !nextKeys.includes(key));

    const homework = await Homework.findOneAndUpdate(
      { _id: homeworkId, InstutionCode: req.user.InstutionCode },
      updatePayload,
      { new: true }
    ).select('-__v');

    if (removedKeys.length > 0) {
      await Promise.all(removedKeys.map((key) => deleteFromS3(key)));
    }
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
    const homework = await Homework.findOne({
      _id: homeworkId,
      InstutionCode: req.user.InstutionCode
    }).lean();

    if (!homework) return errorResponse(res, 'Homework not found', 404);

    const homeworkAttachmentKeys = (Array.isArray(homework.Attachments) ? homework.Attachments : [])
      .map((a) => resolveAttachmentKey(a))
      .filter(Boolean);
    const submissionRecords = await HomeworkSubmission.find({
      InstutionCode: req.user.InstutionCode,
      Homework_Id: homeworkId,
    }).lean();
    const submissionAttachmentKeys = submissionRecords.flatMap((s) =>
      (Array.isArray(s.Attachments) ? s.Attachments : [])
        .map((a) => resolveAttachmentKey(a))
        .filter(Boolean)
    );
    const allKeys = Array.from(new Set([...homeworkAttachmentKeys, ...submissionAttachmentKeys]));

    if (allKeys.length > 0) {
      await Promise.all(allKeys.map((key) => deleteFromS3(key)));
    }

    await HomeworkSubmission.deleteMany({
      InstutionCode: req.user.InstutionCode,
      Homework_Id: homeworkId,
    });
    await Homework.findOneAndDelete({
      _id: homeworkId,
      InstutionCode: req.user.InstutionCode
    });
    return successResponse(res, null, 'Homework deleted successfully');
  } catch (error) {
    logger.error('Error deleting homework:', error);
    return errorResponse(res, 'Failed to delete homework', 500);
  }
};

const uploadHomeworkAttachment = async (req, res) => {
  try {
    if (!req.file) return errorResponse(res, 'Please upload a file', 400);
    const classCode = safeSegment(req.body.classCode || req.body.Class || req.body.class, 'General');
    const instutionCode = safeSegment(req.user?.InstutionCode, 'SYSTEM');
    const timestamp = Date.now();
    const originalName = req.file.originalname || 'attachment';
    const safeName = safeSegment(originalName.replace(/\.[^/.]+$/, ''), 'file');
    const ext = (originalName.match(/\.[^/.]+$/) || [''])[0];
    const key = `${instutionCode}/Homework/${classCode}/assignments/${timestamp}-${safeName}${ext}`;
    const uploaded = await uploadToS3(req.file.buffer, key, req.file.mimetype);
    const displayFileName = `${instutionCode}_${classCode}_${originalName}`;

    return successResponse(
      res,
      {
        File_Name: displayFileName,
        File_URL: uploaded.Location,
        S3_Key: uploaded.Key,
        File_Type: req.file.mimetype,
        File_Size: req.file.size,
      },
      'Homework attachment uploaded successfully',
      201
    );
  } catch (error) {
    logger.error('Error uploading homework attachment:', error);
    return errorResponse(res, error.message || 'Failed to upload homework attachment', 500);
  }
};

const uploadSubmissionAttachment = async (req, res) => {
  try {
    if (!req.file) return errorResponse(res, 'Please upload a file', 400);
    const classCode = safeSegment(req.body.classCode || req.body.Class || req.body.class, 'General');
    const regNo = safeSegment(req.body.registrationNumber || req.body.Registration_Number, 'student');
    const homeworkId = safeSegment(req.body.homeworkId || req.body.Homework_Id, 'general');
    const instutionCode = safeSegment(req.user?.InstutionCode, 'SYSTEM');
    const timestamp = Date.now();
    const originalName = req.file.originalname || 'submission';
    const safeName = safeSegment(originalName.replace(/\.[^/.]+$/, ''), 'file');
    const ext = (originalName.match(/\.[^/.]+$/) || [''])[0];
    const key = `${instutionCode}/Homework/${classCode}/submissions/${homeworkId}/${regNo}/${timestamp}-${safeName}${ext}`;
    const uploaded = await uploadToS3(req.file.buffer, key, req.file.mimetype);

    return successResponse(
      res,
      {
        File_Name: originalName,
        File_URL: uploaded.Location,
        S3_Key: uploaded.Key,
        File_Type: req.file.mimetype,
        File_Size: req.file.size,
      },
      'Submission attachment uploaded successfully',
      201
    );
  } catch (error) {
    logger.error('Error uploading submission attachment:', error);
    return errorResponse(res, error.message || 'Failed to upload submission attachment', 500);
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
      Attachments: parseAttachments(attachments),
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
    const submissionsWithSignedUrls = await withSignedAttachmentUrls(submissions);

    return successResponse(res, submissionsWithSignedUrls, 'Submissions retrieved successfully');
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
    const submissionsWithSignedUrls = await withSignedAttachmentUrls(submissions);

    return successResponse(res, submissionsWithSignedUrls, 'Submissions retrieved successfully');
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
  uploadHomeworkAttachment,
  uploadSubmissionAttachment,
  submitHomework,
  gradeHomework,
  getStudentSubmissions,
  getHomeworkSubmissions
};

