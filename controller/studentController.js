const studentModel = require('../models/studentModel');
const classModel = require('../models/classModel');
const userModel = require('../models/User');
const { getPermissionSet } = require('./permissionAssinment');
const nodemailer = require('nodemailer');
const bcrypt = require('bcryptjs');
const mongoErrorMessages = require('./mongoErrors.json');
const folderStr = require('./DocumentFolder.json');
const { logger } = require('../utils/logger');
const { successResponse, errorResponse, paginatedResponse } = require('../utils/response');
const { cache } = require('../utils/cache');
const AWS = require('aws-sdk');

// S3 configuration for student photo uploads
const ACCESS_KEY = process.env.ACCESS_KEY;
const SECRET_ACCESS_KEY = process.env.SECRET_ACCESS_KEY;
const BUCKET_NAME = process.env.BUCKET_NAME;
// IMPORTANT: Default region set to ap-southeast-2 to match the S3 bucket
// Override via AWS_REGION or AWS_DEFAULT_REGION in .env if needed
const AWS_REGION = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'ap-southeast-2';

const s3 = new AWS.S3({
  accessKeyId: ACCESS_KEY,
  secretAccessKey: SECRET_ACCESS_KEY,
  region: AWS_REGION,
});

const uploadStudentPhotoToS3 = async (buffer, key, contentType) => {
  if (!BUCKET_NAME || !ACCESS_KEY || !SECRET_ACCESS_KEY) {
    throw new Error('S3 configuration missing (ACCESS_KEY, SECRET_ACCESS_KEY, BUCKET_NAME)');
  }

  const params = {
    Bucket: BUCKET_NAME,
    Key: key,
    Body: buffer,
    ContentType: contentType || 'application/octet-stream',
  };

  return await s3.upload(params).promise();
};

// Generic helper to upload any student document (Adhar, Pan, Other) to S3
const uploadStudentDocumentToS3 = async (buffer, key, contentType) => {
  if (!BUCKET_NAME || !ACCESS_KEY || !SECRET_ACCESS_KEY) {
    throw new Error('S3 configuration missing (ACCESS_KEY, SECRET_ACCESS_KEY, BUCKET_NAME)');
  }

  const params = {
    Bucket: BUCKET_NAME,
    Key: key,
    Body: buffer,
    ContentType: contentType || 'application/octet-stream',
  };

  return await s3.upload(params).promise();
};

// Generate a short-lived signed URL for private student photos
const getStudentPhotoSignedUrl = async (key) => {
  if (!BUCKET_NAME || !ACCESS_KEY || !SECRET_ACCESS_KEY || !key) {
    return null;
  }

  // First verify the file exists in S3
  try {
    await s3.headObject({
      Bucket: BUCKET_NAME,
      Key: key,
    }).promise();
  } catch (err) {
    if (err.code === 'NotFound' || err.statusCode === 404) {
      logger.warn(`Student photo not found in S3: ${key}`);
      return null;
    }
    logger.warn(`Error checking student photo in S3: ${key}. Error: ${err.message}`);
    return null;
  }

  const params = {
    Bucket: BUCKET_NAME,
    Key: key,
    Expires: 60 * 60, // 1 hour
  };

  try {
    return await s3.getSignedUrlPromise('getObject', params);
  } catch (err) {
    logger.warn('Failed to generate signed URL for student photo:', err.message);
    return null;
  }
};

// Generic helper to generate signed URL for any student document
const getStudentDocumentSignedUrl = async (key) => {
  if (!BUCKET_NAME || !ACCESS_KEY || !SECRET_ACCESS_KEY || !key) {
    return null;
  }

  const params = {
    Bucket: BUCKET_NAME,
    Key: key,
    Expires: 60 * 60, // 1 hour
  };

  try {
    return await s3.getSignedUrlPromise('getObject', params);
  } catch (err) {
    logger.warn('Failed to generate signed URL for student document:', err.message);
    return null;
  }
};

// Attach signed URLs for photo and documents to a student object (in-place)
const attachSignedUrlsToStudent = async (student) => {
  if (!student) return student;

  // Photo
  if (student.PhotoKey) {
    const signedUrl = await getStudentPhotoSignedUrl(student.PhotoKey);
    if (signedUrl) {
      student.PhotoUrl = signedUrl;
    } else {
      // If signed URL generation failed (file doesn't exist), clear the PhotoUrl
      student.PhotoUrl = null;
    }
  }

  // Aadhar front/back
  if (student.AdharFrontDocKey) {
    const url = await getStudentDocumentSignedUrl(student.AdharFrontDocKey);
    if (url) {
      student.AdharFrontDocUrl = url;
    }
  }
  if (student.AdharBackDocKey) {
    const url = await getStudentDocumentSignedUrl(student.AdharBackDocKey);
    if (url) {
      student.AdharBackDocUrl = url;
    }
  }

  // PAN
  if (student.PanDocKey) {
    const url = await getStudentDocumentSignedUrl(student.PanDocKey);
    if (url) {
      student.PanDocUrl = url;
    }
  }

  // Other docs
  if (Array.isArray(student.OtherDocs) && student.OtherDocs.length > 0) {
    for (const doc of student.OtherDocs) {
      if (doc && doc.Key) {
        const url = await getStudentDocumentSignedUrl(doc.Key);
        if (url) {
          doc.Url = url;
        }
      }
    }
  }

  return student;
};

/**
 * Get all students with pagination, search, and filtering
 * Optimized with indexing and caching
 */
const index = async (req, res, next) => {
  const permissionsResult = await getPermissionSet(req);
  
  if (!permissionsResult.students.split("-").includes('RA')) {
    return errorResponse(res, 'You do not have the necessary permissions to access this resource. Please contact your administrator', 403);
  }

  try {
    const page = parseInt(req.query.PageNumber) || 1;
    const limit = parseInt(req.query.PageSize) || 10;
    const skip = (page - 1) * limit;
    const searchText = req.query.SearchText || '';
    const status = req.query.status;

    // Build search condition
    let searchCondition = {
      InstutionCode: req.user.InstutionCode
    };

    // Status filter
    if (status === 'Active') {
      searchCondition.Status = true;
    } else if (status === 'Inactive') {
      searchCondition.Status = false;
    }

    // Class_Code filter
    if (req.query.Class_Code) {
      searchCondition.Class_Code = req.query.Class_Code;
    }

    // SectionCode filter
    if (req.query.SectionCode) {
      searchCondition.SectionCode = req.query.SectionCode;
    }

    // Search text filter (optimized with indexes)
    if (searchText) {
      searchCondition.$or = [
        { Contact_Number: { $regex: searchText, $options: 'i' } },
        { First_Name: { $regex: searchText, $options: 'i' } },
        { Last_Name: { $regex: searchText, $options: 'i' } },
        { Registration_Number: { $regex: searchText, $options: 'i' } },
        { Class: { $regex: searchText, $options: 'i' } },
        { Email: { $regex: searchText, $options: 'i' } }
      ];
    }

    // Check cache first (include class/section filters so results don't mix)
    const classFilter = req.query.Class_Code || '';
    const sectionFilter = req.query.SectionCode || '';
    const cacheKey = `students:${req.user.InstutionCode}:${page}:${limit}:${status}:${searchText}:${classFilter}:${sectionFilter}`;
    const cached = cache.get(cacheKey);
    
    if (cached) {
      return successResponse(res, cached.data, 'Data retrieved successfully', 200);
    }

    // Optimized query with select only needed fields
    const [students, totalCount] = await Promise.all([
      studentModel
        .find(searchCondition)
        .select('-Password -__v') // Exclude sensitive fields
        .sort({ Registration_Number: 1 }) // Sort for consistency
        .skip(skip)
        .limit(limit)
        .lean(), // Use lean() for better performance
      studentModel.countDocuments(searchCondition)
    ]);

    const result = {
      data: students,
      pagination: {
        page,
        pageSize: limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit),
        hasNextPage: page < Math.ceil(totalCount / limit),
        hasPreviousPage: page > 1
      }
    };

    // Cache for 5 minutes
    cache.set(cacheKey, result, 300);

    return paginatedResponse(res, students, {
      page,
      pageSize: limit,
      total: totalCount
    }, 'Data retrieved successfully');

  } catch (error) {
    logger.error('Error fetching students:', error);
    const matchedKey = Object.keys(mongoErrorMessages).find(key => error.message.includes(key));
    const errorMessage = matchedKey ? mongoErrorMessages[matchedKey] : 'Failed to fetch students';
    return errorResponse(res, errorMessage, 500);
  }
};

/**
 * Get student list (for dropdowns)
 * Optimized and cached
 */
const getAllStudent = async (req, res, next) => {
  const permissionsResult = await getPermissionSet(req);
  
  if (!permissionsResult.students.split("-").includes('R')) {
    return errorResponse(res, 'You do not have the necessary permissions to access this resource. Please contact your administrator', 403);
  }

  try {
    const classFilter = req.query.Class || '';
    const cacheKey = `student-list:${req.user.InstutionCode}:${classFilter}`;
    const cached = cache.get(cacheKey);

    if (cached) {
      return successResponse(res, cached, 'Student record retrieved successfully!');
    }

    const query = {
      InstutionCode: req.user.InstutionCode
    };

    if (classFilter) {
      query.Class = classFilter;
    }

    const studentRecord = await studentModel
      .find(query)
      .select('First_Name Last_Name Registration_Number')
      .sort({ First_Name: 1 })
      .lean();

    const formattedRecords = studentRecord.map(student => ({
      StudentName: `${student.First_Name} ${student.Last_Name}`,
      StudentId: student.Registration_Number
    }));

    // Cache for 10 minutes
    cache.set(cacheKey, formattedRecords, 600);

    return successResponse(res, formattedRecords, 'Student record retrieved successfully!');

  } catch (error) {
    logger.error('Error fetching student list:', error);
    return errorResponse(res, 'Failed to fetch student list', 500);
  }
};

/**
 * Get single student by ID
 */
const show = async (req, res, next) => {
  const permissionsResult = await getPermissionSet(req);
  
  if (!permissionsResult.students.split("-").includes('R')) {
    return errorResponse(res, 'You do not have the necessary permissions to access this resource. Please contact your administrator', 403);
  }

  try {
    const studentId = req.query.studentId;

    if (!studentId || studentId === 'null') {
      return errorResponse(res, 'Please provide a valid Student ID', 400);
    }

    const cacheKey = `student:${studentId}`;
    const cached = cache.get(cacheKey);

    if (cached) {
      await attachSignedUrlsToStudent(cached);
      return successResponse(res, cached, 'Student retrieved successfully');
    }

    const student = await studentModel
      .findOne({
        _id: studentId,
        InstutionCode: req.user.InstutionCode
      })
      .select('-Password -__v')
      .lean();

    if (!student) {
      return errorResponse(res, 'Student not found', 404);
    }

    await attachSignedUrlsToStudent(student);

    // Cache for 5 minutes
    cache.set(cacheKey, student, 300);

    return successResponse(res, student, 'Student retrieved successfully');

  } catch (error) {
    logger.error('Error fetching student:', error);
    return errorResponse(res, 'Failed to fetch student', 500);
  }
};

/**
 * Get student by registration number
 */
const getStudentByRegisterationNumber = async (req, res, next) => {
  try {
    const registrationNumber = req.query.registrationNumber;

    if (!registrationNumber) {
      return errorResponse(res, 'Please provide Registration Number', 400);
    }

    const cacheKey = `student-reg:${registrationNumber}`;
    const cached = cache.get(cacheKey);

    if (cached) {
      return successResponse(res, cached, 'Student retrieved successfully');
    }

    const student = await studentModel
      .findOne({
        Registration_Number: registrationNumber,
        InstutionCode: req.user.InstutionCode
      })
      .select('-Password -__v')
      .lean();

    if (!student) {
      return errorResponse(res, 'Student not found', 404);
    }

    cache.set(cacheKey, student, 300);

    return successResponse(res, student, 'Student retrieved successfully');

  } catch (error) {
    logger.error('Error fetching student by registration:', error);
    return errorResponse(res, 'Failed to fetch student', 500);
  }
};

/**
 * Get student profile
 */
const getStudentProfile = async (req, res, next) => {
  try {
    const registrationNumber = req.query.registrationNumber;

    if (!registrationNumber) {
      return errorResponse(res, 'Please provide Registration Number', 400);
    }

    const cacheKey = `student-profile:${registrationNumber}`;
    const cached = cache.get(cacheKey);

    if (cached) {
      return successResponse(res, cached, 'Student profile retrieved successfully');
    }

    const student = await studentModel
      .findOne({
        Registration_Number: registrationNumber,
        InstutionCode: req.user.InstutionCode
      })
      .select('-Password -__v')
      .lean();

    if (!student) {
      return errorResponse(res, 'Student not found', 404);
    }

    // Get class details if needed
    const classDetails = await classModel
      .findOne({ Class_Code: student.Class_Code })
      .select('Class_Name Class_Code')
      .lean();

    const profile = {
      ...student,
      ClassDetails: classDetails
    };

    cache.set(cacheKey, profile, 300);

    return successResponse(res, profile, 'Student profile retrieved successfully');

  } catch (error) {
    logger.error('Error fetching student profile:', error);
    return errorResponse(res, 'Failed to fetch student profile', 500);
  }
};

/**
 * Upload / update student photo to S3
 */
const uploadStudentPhoto = async (req, res, next) => {
  try {
    const permissionsResult = await getPermissionSet(req);

    // Require write or edit permission on students
    if (
      !permissionsResult.students ||
      (!permissionsResult.students.split('-').includes('W') &&
        !permissionsResult.students.split('-').includes('E'))
    ) {
      return errorResponse(
        res,
        'You do not have the necessary permissions to upload student photos',
        403
      );
    }

    const instutionCode = req.user?.InstutionCode;
    const { studentId } = req.body;
    const file = req.file;

    if (!instutionCode) {
      return errorResponse(res, 'Institution code is required', 400);
    }

    if (!studentId) {
      return errorResponse(res, 'studentId is required', 400);
    }

    if (!file) {
      return errorResponse(res, 'Photo file is required', 400);
    }

    const student = await studentModel.findOne({
      _id: studentId,
      InstutionCode: instutionCode,
    });

    if (!student) {
      return errorResponse(res, 'Student not found', 404);
    }

    const originalName = file.originalname || 'photo';
    const regNo = student.Registration_Number || studentId;

    // Preserve file extension (if any) but standardize the name to: {Registration_Number}_Photo.{ext}
    const dotIndex = originalName.lastIndexOf('.');
    const ext = dotIndex !== -1 ? originalName.substring(dotIndex) : '';
    const key = `${instutionCode}/Student/Photo/${regNo}_Photo${ext}`;

    // Upload new photo
    let uploaded;
    try {
      uploaded = await uploadStudentPhotoToS3(file.buffer, key, file.mimetype);
      
      if (!uploaded || !uploaded.Key) {
        throw new Error('Upload failed: No key returned from S3');
      }
      
      // Log upload result for debugging
      logger.info(`Student photo uploaded to S3. Key: ${uploaded.Key}, Location: ${uploaded.Location}`);
    } catch (uploadError) {
      logger.error(`Failed to upload student photo to S3. Key: ${key}, Error: ${uploadError.message}`);
      return errorResponse(res, `Failed to upload photo to storage: ${uploadError.message}`, 500);
    }

    // Delete previous photo if exists (best-effort) - only if different key
    if (student.PhotoKey && BUCKET_NAME && student.PhotoKey !== uploaded.Key) {
      try {
        await s3
          .deleteObject({
            Bucket: BUCKET_NAME,
            Key: student.PhotoKey,
          })
          .promise();
        logger.info(`Deleted old student photo: ${student.PhotoKey}`);
      } catch (err) {
        logger.warn('Failed to delete old student photo from S3:', err.message);
      }
    }

    // Use the actual key from upload response
    const actualKey = uploaded.Key;
    student.PhotoKey = actualKey;
    student.PhotoMimeType = file.mimetype || '';
    
    // Generate a signed URL so the browser can access the photo
    let signedUrl = null;
    try {
      signedUrl = await getStudentPhotoSignedUrl(actualKey);
      if (signedUrl) {
        student.PhotoUrl = signedUrl;
        logger.info(`Generated signed URL for student photo: ${actualKey}`);
      } else {
        logger.warn(`Failed to generate signed URL for key: ${actualKey}`);
        // Fallback to Location if signed URL generation fails
        student.PhotoUrl = uploaded.Location;
      }
    } catch (err) {
      logger.error(`Error generating signed URL for key: ${actualKey}. Error: ${err.message}`);
      // Fallback to Location
      student.PhotoUrl = uploaded.Location;
    }
    
    await student.save();

    // Also update linked User avatar so student header can show photo
    try {
      await userModel.updateOne(
        {
          InstutionCode: instutionCode,
          MemberId: student.Registration_Number,
          UserType: 'Student',
        },
        { $set: { Avatar: student.PhotoUrl } }
      );
    } catch (err) {
      logger.warn('Failed to update user avatar for student:', err.message);
    }

    // Clear cache to ensure fresh data is returned on next fetch
    try {
      cache.delete(`student:${studentId}`);
      cache.delete(`student-reg:${student.Registration_Number}`);
      cache.delete(`student-profile:${student.Registration_Number}`);
    } catch (err) {
      logger.warn('Failed to clear cache after photo upload:', err.message);
    }

    return successResponse(res, student, 'Student photo uploaded successfully');
  } catch (error) {
    logger.error('Error uploading student photo:', error);
    return errorResponse(res, 'Failed to upload student photo', 500);
  }
};

/**
 * Upload / update student documents (Adhar, Pan, Other) to S3
 * Expects:
 *  - body: { studentId, type: 'Adhar' | 'Pan' | 'Other', side?, documentName? }
 *  - file: multipart field "document"
 */
const uploadStudentDocument = async (req, res, next) => {
  try {
    const permissionsResult = await getPermissionSet(req);

    // Require write or edit permission on students
    if (
      !permissionsResult.students ||
      (!permissionsResult.students.split('-').includes('W') &&
        !permissionsResult.students.split('-').includes('E'))
    ) {
      return errorResponse(
        res,
        'You do not have the necessary permissions to upload student documents',
        403
      );
    }

    const instutionCode = req.user?.InstutionCode;
    const { studentId, type, documentName, side } = req.body;
    const file = req.file;

    if (!instutionCode) {
      return errorResponse(res, 'Institution code is required', 400);
    }

    if (!studentId) {
      return errorResponse(res, 'studentId is required', 400);
    }

    if (!type || !['Adhar', 'Pan', 'Other'].includes(type)) {
      return errorResponse(res, 'Invalid document type. Allowed: Adhar, Pan, Other', 400);
    }

    if (!file) {
      return errorResponse(res, 'Document file is required', 400);
    }

    const student = await studentModel.findOne({
      _id: studentId,
      InstutionCode: instutionCode,
    });

    if (!student) {
      return errorResponse(res, 'Student not found', 404);
    }

    const originalName = file.originalname || 'document';
    const regNo = student.Registration_Number || studentId;

    // Determine folder and filename based on type
    let folder = 'Other';
    let baseName = `${regNo}_${documentName || 'Document'}`;
    if (type === 'Adhar') {
      folder = 'Adhar';
      const sideSuffix = (side === 'Back' || side === 'back') ? 'Back' : 'Front';
      baseName = `${regNo}_Adhar${sideSuffix}`;
    } else if (type === 'Pan') {
      folder = 'Pan';
      baseName = `${regNo}_Pan`;
    }

    // Preserve file extension if present
    const dotIndex = originalName.lastIndexOf('.');
    const ext = dotIndex !== -1 ? originalName.substring(dotIndex) : '';

    const key = `${instutionCode}/Student/${folder}/${baseName}${ext}`;

    // Upload to S3
    const uploaded = await uploadStudentDocumentToS3(file.buffer, key, file.mimetype);

    // Update student record based on type
    if (type === 'Adhar') {
      const isBack = side === 'Back' || side === 'back';

      // Best-effort delete previous Aadhar document for the same side
      const prevKey = isBack ? student.AdharBackDocKey : student.AdharFrontDocKey;
      if (prevKey && BUCKET_NAME) {
        try {
          await s3
            .deleteObject({
              Bucket: BUCKET_NAME,
              Key: prevKey,
            })
            .promise();
        } catch (err) {
          logger.warn('Failed to delete old Aadhar document from S3:', err.message);
        }
      }

      if (isBack) {
        student.AdharBackDocUrl = uploaded.Location;
        student.AdharBackDocKey = uploaded.Key;
        student.AdharBackDocMimeType = file.mimetype || '';
      } else {
        student.AdharFrontDocUrl = uploaded.Location;
        student.AdharFrontDocKey = uploaded.Key;
        student.AdharFrontDocMimeType = file.mimetype || '';
      }
    } else if (type === 'Pan') {
      if (student.PanDocKey && BUCKET_NAME) {
        try {
          await s3
            .deleteObject({
              Bucket: BUCKET_NAME,
              Key: student.PanDocKey,
            })
            .promise();
        } catch (err) {
          logger.warn('Failed to delete old Pan document from S3:', err.message);
        }
      }

      student.PanDocUrl = uploaded.Location;
      student.PanDocKey = uploaded.Key;
      student.PanDocMimeType = file.mimetype || '';
    } else {
      // Other documents: append or update by name
      const docs = Array.isArray(student.OtherDocs) ? student.OtherDocs : [];
      const normalizedName = (documentName || 'Document').trim();

      const existingIndex = docs.findIndex(
        (d) => d.Name && d.Name.toLowerCase() === normalizedName.toLowerCase()
      );

      const docEntry = {
        Name: normalizedName,
        Url: uploaded.Location,
        Key: uploaded.Key,
        MimeType: file.mimetype || '',
        UploadedAt: new Date(),
      };

      if (existingIndex >= 0) {
        // Best-effort delete previous "Other" document with same name
        const prev = docs[existingIndex];
        if (prev.Key && BUCKET_NAME) {
          try {
            await s3
              .deleteObject({
                Bucket: BUCKET_NAME,
                Key: prev.Key,
              })
              .promise();
          } catch (err) {
            logger.warn('Failed to delete old Other document from S3:', err.message);
          }
        }

        docs[existingIndex] = docEntry;
      } else {
        docs.push(docEntry);
      }

      student.OtherDocs = docs;
    }

    await student.save();

    // Regenerate signed URLs so the response contains viewable links
    await attachSignedUrlsToStudent(student);

    return successResponse(res, student, 'Student document uploaded successfully');
  } catch (error) {
    logger.error('Error uploading student document:', error);
    return errorResponse(res, 'Failed to upload student document', 500);
  }
};

/**
 * Delete student document (Aadhar front/back, Pan, Other by name)
 */
const deleteStudentDocument = async (req, res, next) => {
  try {
    const permissionsResult = await getPermissionSet(req);

    if (
      !permissionsResult.students ||
      (!permissionsResult.students.split('-').includes('W') &&
        !permissionsResult.students.split('-').includes('E'))
    ) {
      return errorResponse(
        res,
        'You do not have the necessary permissions to delete student documents',
        403
      );
    }

    const instutionCode = req.user?.InstutionCode;
    const { studentId, type, side, documentName } = req.body;

    if (!instutionCode) {
      return errorResponse(res, 'Institution code is required', 400);
    }
    if (!studentId) {
      return errorResponse(res, 'studentId is required', 400);
    }
    if (!type || !['Adhar', 'Pan', 'Other'].includes(type)) {
      return errorResponse(res, 'Invalid document type. Allowed: Adhar, Pan, Other', 400);
    }

    const student = await studentModel.findOne({
      _id: studentId,
      InstutionCode: instutionCode,
    });

    if (!student) {
      return errorResponse(res, 'Student not found', 404);
    }

    const deleteKey = async (key) => {
      if (key && BUCKET_NAME) {
        try {
          await s3
            .deleteObject({
              Bucket: BUCKET_NAME,
              Key: key,
            })
            .promise();
        } catch (err) {
          logger.warn('Failed to delete document from S3:', err.message);
        }
      }
    };

    if (type === 'Adhar') {
      const isBack = side === 'Back' || side === 'back';
      if (isBack) {
        await deleteKey(student.AdharBackDocKey);
        student.AdharBackDocUrl = undefined;
        student.AdharBackDocKey = undefined;
        student.AdharBackDocMimeType = undefined;
      } else {
        await deleteKey(student.AdharFrontDocKey);
        student.AdharFrontDocUrl = undefined;
        student.AdharFrontDocKey = undefined;
        student.AdharFrontDocMimeType = undefined;
      }
    } else if (type === 'Pan') {
      await deleteKey(student.PanDocKey);
      student.PanDocUrl = undefined;
      student.PanDocKey = undefined;
      student.PanDocMimeType = undefined;
    } else {
      // Other docs: delete by Name
      if (!documentName) {
        return errorResponse(res, 'documentName is required for Other documents', 400);
      }

      const normalizedName = documentName.trim().toLowerCase();
      const docs = Array.isArray(student.OtherDocs) ? student.OtherDocs : [];

      const remainingDocs = [];
      for (const doc of docs) {
        if (doc.Name && doc.Name.toLowerCase() === normalizedName) {
          await deleteKey(doc.Key);
          // skip adding to remainingDocs
        } else {
          remainingDocs.push(doc);
        }
      }

      student.OtherDocs = remainingDocs;
    }

    await student.save();

    return successResponse(res, student, 'Student document deleted successfully');
  } catch (error) {
    logger.error('Error deleting student document:', error);
    return errorResponse(res, 'Failed to delete student document', 500);
  }
};

/**
 * Register new student
 */
const store = async (req, res, next) => {
  const permissionsResult = await getPermissionSet(req);
  
  if (!permissionsResult.students || !permissionsResult.students.split("-").includes('W')) {
    return errorResponse(res, 'You do not have the necessary permissions to create students', 403);
  }

  try {
    const studentData = req.body;
    studentData.InstutionCode = req.user.InstutionCode;

    // Generate registration number if not provided
    if (!studentData.Registration_Number) {
      // Try to get ClassCode from class record to extract className
      let classCode = studentData.Class_Code || studentData.ClassCode;
      let className = studentData.Class;
      let section = studentData.Section || '';
      
      // If Class_Code or ClassCode is provided, try to fetch the class to get ClassCode
      if (!classCode && (studentData.Class_Code || studentData.Class)) {
        try {
          const classRecord = await classModel.findOne({
            InstutionCode: req.user.InstutionCode,
            $or: [
              { ClassName: studentData.Class },
              { ClassCode: studentData.Class_Code }
            ]
          }).select('ClassCode ClassName').lean();
          
          if (classRecord) {
            classCode = classRecord.ClassCode;
            className = classRecord.ClassName;
          }
        } catch (error) {
          logger.warn('Error fetching class for registration number generation:', error.message);
        }
      }
      
      // If SectionCode is provided, extract section name from it
      if (studentData.SectionCode && !section) {
        // SectionCode format: CLASSCODE_SECTIONNAME (e.g., EES-001-5th-26_A)
        const parts = studentData.SectionCode.split('_');
        if (parts.length > 1) {
          section = parts[parts.length - 1];
        }
      }
      
      // Use ClassCode if available, otherwise fallback to Class name
      const classIdentifier = classCode || className;
      studentData.Registration_Number = await generateRegistrationNumber(req.user.InstutionCode, classIdentifier, section);
    }

    // Generate default password if not provided
    // Format: FirstName@RegistrationNumber (e.g., John@2410A001)
    let plainPassword = studentData.Password;
    if (!plainPassword) {
      const firstName = studentData.First_Name || 'Student';
      const regNumber = studentData.Registration_Number || '123456';
      plainPassword = `${firstName}@${regNumber}`;
      studentData.Password = await bcrypt.hash(plainPassword, 10);
    } else {
      // Hash password if provided
      studentData.Password = await bcrypt.hash(studentData.Password, 10);
    }

    // Create student
    const student = await studentModel.create(studentData);

    // Create user account
    try {
      const userData = {
        FirstName: student.First_Name,
        LastName: student.Last_Name,
        Email: student.Email,
        Phone: student.Contact_Number,
        UserName: student.Registration_Number,
        Password: student.Password, // Already hashed
        UserType: 'Student',
        MemberId: student.Registration_Number,
        InstutionCode: student.InstutionCode,
        InstutionName: req.user.InstutionName || '',
        Verified: true
      };

      await userModel.create(userData);
    } catch (userError) {
      logger.warn('User creation failed for student:', userError);
      // Continue even if user creation fails
    }

    // Clear all student-related cache entries for this institution
    // Since cache.delete doesn't support wildcards, we'll clear all cache
    // In production, use Redis with pattern matching
    cache.clear();

    // Send welcome email (async, don't wait)
    sendWelcomeEmail(student).catch(err => logger.error('Email send failed:', err));

    return successResponse(res, {
      _id: student._id,
      Registration_Number: student.Registration_Number
    }, 'Student registered successfully', 201);

  } catch (error) {
    logger.error('Error creating student:', error);
    
    if (error.code === 11000) {
      return errorResponse(res, 'Student with this registration number already exists', 400);
    }

    const matchedKey = Object.keys(mongoErrorMessages).find(key => error.message.includes(key));
    const errorMessage = matchedKey ? mongoErrorMessages[matchedKey] : 'Failed to register student';
    
    return errorResponse(res, errorMessage, 500);
  }
};

/**
 * Update student
 */
const update = async (req, res, next) => {
  const permissionsResult = await getPermissionSet(req);
  
  if (!permissionsResult.students || !permissionsResult.students.split("-").includes('E')) {
    return errorResponse(res, 'You do not have the necessary permissions to update students', 403);
  }

  try {
    const studentId = req.body.studentId || req.body._id;
    
    if (!studentId) {
      return errorResponse(res, 'Please provide Student ID', 400);
    }

    const updateData = { ...req.body };
    delete updateData.studentId;
    delete updateData._id;
    delete updateData.InstutionCode; // Prevent changing institution

    // Hash password if provided
    if (updateData.Password) {
      updateData.Password = await bcrypt.hash(updateData.Password, 10);
    }

    const student = await studentModel.findOneAndUpdate(
      {
        _id: studentId,
        InstutionCode: req.user.InstutionCode
      },
      updateData,
      { new: true, runValidators: true }
    ).select('-Password -__v');

    if (!student) {
      return errorResponse(res, 'Student not found', 404);
    }

    // Clear cache
    cache.delete(`student:${studentId}`);
    cache.delete(`student-reg:${student.Registration_Number}`);
    // Clear all cache since wildcard deletion is not supported
    cache.clear();

    return successResponse(res, student, 'Student updated successfully');

  } catch (error) {
    logger.error('Error updating student:', error);
    return errorResponse(res, 'Failed to update student', 500);
  }
};

/**
 * Deactivate/Activate student
 */
const remove = async (req, res, next) => {
  const permissionsResult = await getPermissionSet(req);
  
  if (!permissionsResult.students || !permissionsResult.students.split("-").includes('E')) {
    return errorResponse(res, 'You do not have the necessary permissions to update students', 403);
  }

  try {
    const studentId = req.body.studentId;
    const status = req.body.status !== undefined ? req.body.status : false;

    if (!studentId) {
      return errorResponse(res, 'Please provide Student ID', 400);
    }

    const student = await studentModel.findOneAndUpdate(
      {
        _id: studentId,
        InstutionCode: req.user.InstutionCode
      },
      { Status: status },
      { new: true }
    ).select('-Password -__v');

    if (!student) {
      return errorResponse(res, 'Student not found', 404);
    }

    // Clear cache
    cache.delete(`student:${studentId}`);
    // Clear all cache since wildcard deletion is not supported
    cache.clear();

    return successResponse(res, student, `Student ${status ? 'activated' : 'deactivated'} successfully`);

  } catch (error) {
    logger.error('Error updating student status:', error);
    return errorResponse(res, 'Failed to update student status', 500);
  }
};

/**
 * Delete student
 */
const destroy = async (req, res, next) => {
  const permissionsResult = await getPermissionSet(req);
  
  if (!permissionsResult.students.split("-").includes('D')) {
    return errorResponse(res, 'You do not have the necessary permissions to delete students', 403);
  }

  try {
    const studentId = req.body.studentId;

    if (!studentId) {
      return errorResponse(res, 'Please provide Student ID', 400);
    }

    const student = await studentModel.findOneAndDelete({
      _id: studentId,
      InstutionCode: req.user.InstutionCode
    });

    if (!student) {
      return errorResponse(res, 'Student not found', 404);
    }

    // Clear cache
    cache.delete(`student:${studentId}`);
    cache.delete(`student-reg:${student.Registration_Number}`);
    // Clear all cache since wildcard deletion is not supported
    cache.clear();

    return successResponse(res, null, 'Student deleted successfully');

  } catch (error) {
    logger.error('Error deleting student:', error);
    return errorResponse(res, 'Failed to delete student', 500);
  }
};

/**
 * Generate unique registration number
 * Format: YYCLASSNAMESECTIONSEQ (e.g., 265thA001) or YYCLASSNAMESEQ (e.g., 265th001) if no section
 * Uses className from ClassCode instead of institution code "001"
 * @param {string} instutionCode - Institution code
 * @param {string} classIdentifier - ClassCode or Class name
 * @param {string} section - Section name (optional, e.g., "A", "B")
 */
const generateRegistrationNumber = async (instutionCode, classIdentifier, section = '') => {
  const year = new Date().getFullYear().toString().slice(-2);
  
  // Extract className from ClassCode or Class_Code
  // ClassCode format: EES-001-5th-26 -> extract "5th"
  // Class_Code format: EES-001_10th A -> extract "10th A" then get "10th"
  let classNameCode = 'XX';
  
  if (classIdentifier) {
    let className = '';
    
    // Check if it's a ClassCode format (contains hyphens like "EES-001-5th-26")
    if (classIdentifier.includes('-') && classIdentifier.split('-').length >= 3) {
      // ClassCode format: INST-CODE-CLASSNAME-YY
      // Extract className (third part, before the year)
      const parts = classIdentifier.split('-');
      // className is the part before the last (which is year)
      // e.g., "EES-001-5th-26" -> className = "5th"
      if (parts.length >= 3) {
        className = parts[parts.length - 2]; // Second to last part is className
      }
    } 
    // Check if it's a Class_Code format (contains underscore like "EES-001_10th A")
    else if (classIdentifier.includes('_')) {
      const parts = classIdentifier.split('_');
      const classPart = parts.length > 1 ? parts[parts.length - 1] : classIdentifier;
      // Extract class name from "10th A" -> "10th" (remove section if present)
      className = classPart.split(/\s+/)[0]; // Get first part before space
    }
    // If it's just a class name like "5th" or "10th A"
    else {
      // Extract class name (remove section if present)
      className = classIdentifier.split(/\s+/)[0];
    }
    
    // Clean className: remove spaces, convert to lowercase, remove special chars except numbers
    // "5th" -> "5th", "10th" -> "10th", "1st" -> "1st"
    if (className) {
      classNameCode = className.replace(/\s+/g, '').toLowerCase();
    }
  }
  
  // Add section to classNameCode if provided (e.g., "5thA" or "10thB")
  if (section && section.trim()) {
    // Extract section code: "A" from "SECTION-A", "A" from "Section A", or just "A"
    let sectionCode = section.trim().toUpperCase();
    // If it contains a hyphen, get the part after the hyphen
    if (sectionCode.includes('-')) {
      sectionCode = sectionCode.split('-').pop() || sectionCode;
    }
    // If it contains a space, get the last part
    if (sectionCode.includes(' ')) {
      sectionCode = sectionCode.split(' ').pop() || sectionCode;
    }
    // Extract only letters/numbers (remove "SECTION", "Section" etc.)
    sectionCode = sectionCode.replace(/^(SECTION|Section|SEC|Sec)\s*/i, '');
    // Take only the first meaningful character(s) - usually a single letter or number
    sectionCode = sectionCode.match(/^[A-Z0-9]+/)?.[0] || sectionCode.charAt(0) || '';
    
    if (sectionCode) {
      classNameCode = `${classNameCode}${sectionCode}`;
    }
  }
  
  // Find last registration number for this className + section pattern
  // Pattern should match exactly: YY + classNameCode + exactly 3 digits
  // e.g., for "3rd" class: ^263rd\d{3}$ matches "263rd001", "263rd002", etc.
  // Escape special regex characters in classNameCode
  const escapedClassNameCode = classNameCode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const basePattern = `${year}${escapedClassNameCode}`;
  const regexPattern = `^${basePattern}\\d{3}$`;
  
  logger.info('Generating registration number:', {
    instutionCode,
    classIdentifier,
    section,
    classNameCode,
    escapedClassNameCode,
    year,
    regexPattern,
    basePattern
  });
  
  // Find the last student with matching pattern
  const lastStudent = await studentModel
    .findOne({
      InstutionCode: instutionCode,
      Registration_Number: { $regex: regexPattern }
    })
    .sort({ Registration_Number: -1 })
    .select('Registration_Number')
    .lean();

  let sequence = 1;
  if (lastStudent && lastStudent.Registration_Number) {
    // Extract sequence from end (last 3 digits)
    const regNumber = lastStudent.Registration_Number;
    const lastSeq = parseInt(regNumber.slice(-3)) || 0;
    
    // Validate that the registration number matches our expected pattern
    const expectedPrefix = `${year}${classNameCode}`;
    if (regNumber.startsWith(expectedPrefix) && regNumber.length === expectedPrefix.length + 3) {
      sequence = lastSeq + 1;
      logger.info('Found existing registration number:', {
        lastRegNumber: regNumber,
        lastSeq,
        nextSequence: sequence,
        expectedPrefix
      });
    } else {
      // Registration number doesn't match expected pattern, start from 001
      logger.warn('Found registration number but pattern mismatch:', {
        lastRegNumber: regNumber,
        expectedPrefix,
        actualPrefix: regNumber.slice(0, expectedPrefix.length)
      });
      sequence = 1;
    }
  } else {
    logger.info('No existing registration number found, starting from 001');
  }

  const generatedRegNumber = `${year}${classNameCode}${sequence.toString().padStart(3, '0')}`;
  
  logger.info('Generated registration number:', {
    generatedRegNumber,
    sequence,
    finalFormat: `${year}${classNameCode}${sequence.toString().padStart(3, '0')}`
  });
  
  return generatedRegNumber;
};

/**
 * Send welcome email to student
 */
/**
 * Send login credentials to selected students
 */
const sendCredentials = async (req, res, next) => {
  const permissionsResult = await getPermissionSet(req);
  
  if (!permissionsResult.students || !permissionsResult.students.split("-").includes('W')) {
    return errorResponse(res, 'You do not have the necessary permissions to send credentials', 403);
  }

  try {
    const { studentIds, classFilter } = req.body;

    if (!studentIds || !Array.isArray(studentIds) || studentIds.length === 0) {
      return errorResponse(res, 'Please select at least one student', 400);
    }

    // Find selected students
    const searchCondition = {
      _id: { $in: studentIds },
      InstutionCode: req.user.InstutionCode
    };

    if (classFilter) {
      searchCondition.Class = classFilter;
    }

    const students = await studentModel.find(searchCondition).lean();

    if (students.length === 0) {
      return errorResponse(res, 'No students found', 404);
    }

    // Send credentials email to each student
    const results = [];
    for (const student of students) {
      try {
        // Generate password
        const firstName = student.First_Name || 'Student';
        const regNumber = student.Registration_Number || '123456';
        const plainPassword = `${firstName}@${regNumber}`;
        const hashedPassword = await bcrypt.hash(plainPassword, 10);

        // Check if user exists by username or email
        const existingUser = await userModel.findOne({
          $or: [
            { UserName: student.Registration_Number, InstutionCode: req.user.InstutionCode },
            { Email: student.Email, InstutionCode: req.user.InstutionCode }
          ]
        });

        if (existingUser) {
          // Update existing user with new password and ensure correct details
          await userModel.updateOne(
            { _id: existingUser._id },
            {
              $set: {
                Password: hashedPassword,
                FirstName: student.First_Name,
                LastName: student.Last_Name,
                Email: student.Email,
                Phone: student.Contact_Number,
                UserName: student.Registration_Number,
                UserType: 'Student',
                MemberId: student.Registration_Number,
                InstutionCode: student.InstutionCode,
                InstutionName: req.user.InstutionName || '',
                Verified: true
              }
            }
          );
          logger.info(`Updated existing user account for ${student.Registration_Number}`);
        } else {
          // Create new user account
          const userData = {
            FirstName: student.First_Name,
            LastName: student.Last_Name,
            Email: student.Email,
            Phone: student.Contact_Number,
            UserName: student.Registration_Number,
            Password: hashedPassword,
            UserType: 'Student',
            MemberId: student.Registration_Number,
            InstutionCode: student.InstutionCode,
            InstutionName: req.user.InstutionName || '',
            Verified: true
          };

          await userModel.create(userData);
          logger.info(`Created new user account for ${student.Registration_Number}`);
        }

        // Send email with credentials (user account is already created/updated)
        try {
          const institutionName = req.user?.InstutionName || 'Your Institution';
          await sendCredentialsEmail(student, plainPassword, institutionName);
          results.push({
            studentId: student._id,
            registrationNumber: student.Registration_Number,
            email: student.Email,
            status: 'sent',
            credentials: {
              username: student.Registration_Number,
              password: plainPassword
            }
          });
        } catch (emailError) {
          // Email failed but user account is ready - log credentials for manual distribution
          logger.warn(`Email sending failed for ${student.Registration_Number}, but user account is ready.`);
          logger.info(`Credentials for ${student.Registration_Number}: Username: ${student.Registration_Number}, Password: ${plainPassword}`);
          results.push({
            studentId: student._id,
            registrationNumber: student.Registration_Number,
            email: student.Email,
            status: 'failed',
            error: emailError.message,
            credentials: {
              username: student.Registration_Number,
              password: plainPassword
            },
            note: 'User account created/updated. Credentials logged to console.'
          });
        }
      } catch (error) {
        logger.error(`Error processing student ${student.Registration_Number}:`, error);
        results.push({
          studentId: student._id,
          registrationNumber: student.Registration_Number,
          email: student.Email,
          status: 'failed',
          error: error.message
        });
      }
    }

    const successCount = results.filter(r => r.status === 'sent').length;
    const failCount = results.filter(r => r.status === 'failed').length;

    // Return success even if some failed, but include details
    if (successCount === 0 && failCount > 0) {
      // All failed - return error with details
      const errorMessages = results
        .filter(r => r.status === 'failed')
        .map(r => `${r.registrationNumber}: ${r.error || 'Unknown error'}`)
        .join('; ');
      
      return errorResponse(res, `Failed to send credentials. Errors: ${errorMessages}`, 500);
    }

    return successResponse(res, {
      total: students.length,
      success: successCount,
      failed: failCount,
      results
    }, `Credentials sent to ${successCount} student(s)${failCount > 0 ? `, ${failCount} failed` : ''}`, 200);

  } catch (error) {
    logger.error('Error sending credentials:', error);
    return errorResponse(res, 'Failed to send credentials', 500);
  }
};

/**
 * Send credentials email to student
 */
const sendCredentialsEmail = async (student, password, institutionName) => {
  try {
    // Use existing email configuration (ORGANIZATION_EMAIL) or new SMTP config
    let transporter;
    
    // Check for existing ORGANIZATION_EMAIL configuration (used in other parts of the system)
    if (process.env.ORGANIZATION_EMAIL && process.env.ORGANIZATION_PASSWORD) {
      transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.ORGANIZATION_EMAIL,
          pass: process.env.ORGANIZATION_PASSWORD,
        },
      });
      logger.info('Using ORGANIZATION_EMAIL configuration for sending credentials');
    }
    // Check for new SMTP configuration
    else if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
      transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_SECURE === 'true' || false,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        },
        tls: {
          rejectUnauthorized: false // Allow self-signed certificates
        }
      });
      logger.info('Using SMTP configuration for sending credentials');
    }
    // No email configuration found
    else {
      const warningMsg = 'Email configuration is missing. Please configure ORGANIZATION_EMAIL and ORGANIZATION_PASSWORD (or SMTP_HOST, SMTP_USER, SMTP_PASS) in BackEnd/.env file.';
      logger.warn(warningMsg);
      logger.info(`Credentials for ${student.Registration_Number}: Username: ${student.Registration_Number}, Password: ${password}`);
      // Don't throw error - just skip email sending
      return { skipped: true, reason: 'Email not configured' };
    }

    // Determine "from" email based on configuration used
    // Use dynamic email or fallback to configured email, never hardcode domain
    const fromEmail = process.env.SMTP_FROM || process.env.ORGANIZATION_EMAIL || 'noreply@erpsystem.com';
    
    const mailOptions = {
      from: fromEmail,
      to: student.Email,
      subject: `Your Login Credentials - ${institutionName}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .credentials-box { background: white; border: 2px solid #667eea; border-radius: 8px; padding: 20px; margin: 20px 0; }
            .credential-item { margin: 15px 0; padding: 12px; background: #f0f4ff; border-left: 4px solid #667eea; }
            .credential-label { font-weight: bold; color: #667eea; }
            .credential-value { font-size: 18px; color: #333; margin-top: 5px; }
            .warning { background: #fff3cd; border: 1px solid #ffc107; padding: 15px; border-radius: 5px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
            .button { display: inline-block; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Welcome to ${institutionName}</h1>
            </div>
            <div class="content">
              <p>Dear ${student.First_Name} ${student.Last_Name},</p>
              
              <p>Your student account has been created successfully. Please find your login credentials below:</p>
              
              <div class="credentials-box">
                <div class="credential-item">
                  <div class="credential-label">Email Address:</div>
                  <div class="credential-value">${student.Email}</div>
                </div>
                <div class="credential-item">
                  <div class="credential-label">Username / Registration Number:</div>
                  <div class="credential-value">${student.Registration_Number}</div>
                </div>
                <div class="credential-item">
                  <div class="credential-label">Password:</div>
                  <div class="credential-value">${password}</div>
                </div>
                <div class="credential-item">
                  <div class="credential-label">User Type:</div>
                  <div class="credential-value">Student</div>
                </div>
              </div>
              
              <div class="warning">
                <strong>⚠️ Important:</strong> Please keep these credentials secure and do not share them with anyone. 
                We recommend changing your password after your first login.
              </div>
              
              <p><strong>How to Login:</strong></p>
              <ol>
                <li>Go to the login page</li>
                <li>Select "Student" as your user type</li>
                <li>Enter your Email Address or Registration Number as Username</li>
                <li>Enter your Password</li>
                <li>Click on "Login"</li>
              </ol>
              <p><strong>Note:</strong> You can use either your Email Address (${student.Email}) or Registration Number (${student.Registration_Number}) as your Username to login.</p>
              
              <p>If you have any questions or need assistance, please contact the administration office.</p>
              
              <p>Best regards,<br>
              <strong>${institutionName} Administration</strong></p>
            </div>
            <div class="footer">
              <p>This is an automated email. Please do not reply to this message.</p>
              <p>&copy; ${new Date().getFullYear()} ${institutionName}. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `
    };

    await transporter.sendMail(mailOptions);
    logger.info(`Credentials email sent to ${student.Email}`);
  } catch (error) {
    logger.error(`Error sending credentials email to ${student.Email}:`, error);
    throw error;
  }
};

const sendWelcomeEmail = async (student, institutionName) => {
  try {
    // Use ORGANIZATION_EMAIL configuration (same as other email functions)
    if (!process.env.ORGANIZATION_EMAIL || !process.env.ORGANIZATION_PASSWORD) {
      logger.warn('ORGANIZATION_EMAIL not configured. Welcome email skipped.');
      return;
    }

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.ORGANIZATION_EMAIL,
        pass: process.env.ORGANIZATION_PASSWORD
      }
    });

    // Use dynamic institution name, never hardcode
    const instName = institutionName || 'Your Institution';
    const fromEmail = process.env.SMTP_FROM || process.env.ORGANIZATION_EMAIL || 'noreply@erpsystem.com';

    const mailOptions = {
      from: fromEmail,
      to: student.Email,
      subject: `Welcome to ${instName}`,
      html: `
        <h2>Welcome ${student.First_Name} ${student.Last_Name}!</h2>
        <p>Your registration is complete.</p>
        <p><strong>Registration Number:</strong> ${student.Registration_Number}</p>
        <p><strong>Class:</strong> ${student.Class}</p>
        <p>Please keep your credentials safe.</p>
      `
    };

    await transporter.sendMail(mailOptions);
    logger.info(`Welcome email sent to ${student.Email}`);
  } catch (error) {
    logger.error('Failed to send welcome email:', error);
    // Don't throw, just log
  }
};

module.exports = {
  index,
  getAllStudent,
  show,
  getStudentByRegisterationNumber,
  getStudentProfile,
  store,
  update,
  remove,
  destroy,
  sendCredentials,
  uploadStudentPhoto,
  uploadStudentDocument,
  deleteStudentDocument,
};
