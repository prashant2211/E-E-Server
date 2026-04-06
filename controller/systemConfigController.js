const { AcademicYear, SystemSettings } = require('../models/academicYearModel');
const { logger } = require('../utils/logger');
const { successResponse, errorResponse } = require('../utils/response');
const { cache } = require('../utils/cache');
const AWS = require('aws-sdk');
const path = require('path');

const ACCESS_KEY = process.env.ACCESS_KEY;
const SECRET_ACCESS_KEY = process.env.SECRET_ACCESS_KEY;
const BUCKET_NAME = process.env.BUCKET_NAME;
const AWS_REGION = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'ap-southeast-2';

const s3 = new AWS.S3({
  accessKeyId: ACCESS_KEY,
  secretAccessKey: SECRET_ACCESS_KEY,
  region: AWS_REGION,
});

// Helper: generate signed URL for institution documents (logo, signatures, etc.)
const getInstitutionDocSignedUrl = async (key) => {
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
    logger.warn('Failed to generate signed URL for institution document:', {
      message: err.message,
      key,
    });
    return null;
  }
};

// Academic Year Management
const getAllAcademicYears = async (req, res) => {
  try {
    const years = await AcademicYear.find({
      InstutionCode: req.user.InstutionCode,
      Status: true
    })
      .select('-__v')
      .sort({ Start_Date: -1 })
      .lean();

    return successResponse(res, years, 'Academic years retrieved successfully');
  } catch (error) {
    logger.error('Error fetching academic years:', error);
    return errorResponse(res, 'Failed to fetch academic years', 500);
  }
};

const getCurrentAcademicYear = async (req, res) => {
  try {
    const year = await AcademicYear.findOne({
      InstutionCode: req.user.InstutionCode,
      Is_Current: true,
      Status: true
    }).select('-__v').lean();

    if (!year) {
      return errorResponse(res, 'No current academic year found', 404);
    }

    return successResponse(res, year, 'Current academic year retrieved successfully');
  } catch (error) {
    logger.error('Error fetching current academic year:', error);
    return errorResponse(res, 'Failed to fetch current academic year', 500);
  }
};

const createAcademicYear = async (req, res) => {
  try {
    const { yearName, startDate, endDate, terms } = req.body;

    if (!yearName || !startDate || !endDate) {
      return errorResponse(res, 'Please provide yearName, startDate, and endDate', 400);
    }

    // If setting as current, unset others
    if (req.body.isCurrent) {
      await AcademicYear.updateMany(
        { InstutionCode: req.user.InstutionCode },
        { Is_Current: false }
      );
    }

    const academicYear = await AcademicYear.create({
      InstutionCode: req.user.InstutionCode,
      Year_Name: yearName,
      Start_Date: new Date(startDate),
      End_Date: new Date(endDate),
      Terms: terms || [],
      Is_Current: req.body.isCurrent || false,
      Status: true
    });

    return successResponse(res, academicYear, 'Academic year created successfully', 201);
  } catch (error) {
    logger.error('Error creating academic year:', error);
    return errorResponse(res, 'Failed to create academic year', 500);
  }
};

const updateAcademicYear = async (req, res) => {
  try {
    const yearId = req.body.yearId || req.body._id;
    if (!yearId) return errorResponse(res, 'Please provide Year ID', 400);

    // If setting as current, unset others
    if (req.body.isCurrent) {
      await AcademicYear.updateMany(
        { InstutionCode: req.user.InstutionCode, _id: { $ne: yearId } },
        { Is_Current: false }
      );
    }

    const updateData = { ...req.body };
    delete updateData.yearId;
    delete updateData._id;
    delete updateData.InstutionCode;

    // Map UI field -> schema field
    // (Create flow already maps isCurrent -> Is_Current, update flow must do same)
    if (updateData.isCurrent !== undefined) {
      updateData.Is_Current = !!updateData.isCurrent;
      delete updateData.isCurrent;
    }

    if (updateData.startDate) {
      updateData.Start_Date = new Date(updateData.startDate);
      delete updateData.startDate;
    }

    if (updateData.endDate) {
      updateData.End_Date = new Date(updateData.endDate);
      delete updateData.endDate;
    }

    const academicYear = await AcademicYear.findOneAndUpdate(
      { _id: yearId, InstutionCode: req.user.InstutionCode },
      updateData,
      { new: true }
    ).select('-__v');

    if (!academicYear) {
      return errorResponse(res, 'Academic year not found', 404);
    }

    return successResponse(res, academicYear, 'Academic year updated successfully');
  } catch (error) {
    logger.error('Error updating academic year:', error);
    return errorResponse(res, 'Failed to update academic year', 500);
  }
};

// System Settings
const getSystemSettings = async (req, res) => {
  try {
    const cacheKey = `settings:${req.user.InstutionCode}`;
    const cached = cache.get(cacheKey);

    if (cached) {
      return successResponse(res, cached, 'Settings retrieved successfully');
    }

    let settingsDoc = await SystemSettings.findOne({
      InstutionCode: req.user.InstutionCode
    }).select('-__v');

    // Create default settings if not exists
    if (!settingsDoc) {
      settingsDoc = await SystemSettings.create({
        InstutionCode: req.user.InstutionCode,
        Features: {
          Library: true,
          Transport: true,
          Hostel: true,
          SMS_Notifications: false,
          Email_Notifications: true,
          Online_Payment: false
        },
        Settings: {
          Documents: {
            LogoKey: null,
            LogoUrl: null,
            PrincipalSignatureKey: null,
            PrincipalSignatureUrl: null,
            DirectorSignatureKey: null,
            DirectorSignatureUrl: null,
            FeeQRKey: null,
            FeeQRUrl: null,
            OtherDocs: []
          }
        }
      });
    } else {
      // Ensure nested structure exists for existing documents
      if (!settingsDoc.Settings) {
        settingsDoc.Settings = {};
      }
      if (!settingsDoc.Settings.Documents) {
        settingsDoc.Settings.Documents = {
          LogoKey: null,
          LogoUrl: null,
          PrincipalSignatureKey: null,
          PrincipalSignatureUrl: null,
          DirectorSignatureKey: null,
          DirectorSignatureUrl: null,
          FeeQRKey: null,
          FeeQRUrl: null,
          OtherDocs: []
        };
      } else {
        if (settingsDoc.Settings.Documents.FeeQRKey === undefined) {
          settingsDoc.Settings.Documents.FeeQRKey = null;
        }
        if (settingsDoc.Settings.Documents.FeeQRUrl === undefined) {
          settingsDoc.Settings.Documents.FeeQRUrl = null;
        }
        if (!Array.isArray(settingsDoc.Settings.Documents.OtherDocs)) {
          settingsDoc.Settings.Documents.OtherDocs = [];
        }
      }

      // Mark Mixed path as modified so Mongoose actually saves it
      settingsDoc.markModified('Settings');
      await settingsDoc.save();
    }

    const settings = settingsDoc.toObject();

    // For private S3 buckets, replace raw URLs with fresh signed URLs before sending to UI
    if (settings.Settings && settings.Settings.Documents) {
      const docs = settings.Settings.Documents;

      if (docs.LogoKey) {
        const signed = await getInstitutionDocSignedUrl(docs.LogoKey);
        if (signed) docs.LogoUrl = signed;
      }

      if (docs.PrincipalSignatureKey) {
        const signed = await getInstitutionDocSignedUrl(docs.PrincipalSignatureKey);
        if (signed) docs.PrincipalSignatureUrl = signed;
      }

      if (docs.DirectorSignatureKey) {
        const signed = await getInstitutionDocSignedUrl(docs.DirectorSignatureKey);
        if (signed) docs.DirectorSignatureUrl = signed;
      }

      if (docs.FeeQRKey) {
        const signed = await getInstitutionDocSignedUrl(docs.FeeQRKey);
        if (signed) docs.FeeQRUrl = signed;
      }

      if (Array.isArray(docs.OtherDocs)) {
        for (const doc of docs.OtherDocs) {
          if (doc && doc.Key) {
            const signed = await getInstitutionDocSignedUrl(doc.Key);
            if (signed) {
              doc.Url = signed;
            }
          }
        }
      }
    }

    cache.set(cacheKey, settings, 600);
    return successResponse(res, settings, 'Settings retrieved successfully');
  } catch (error) {
    logger.error('Error fetching settings:', error);
    return errorResponse(res, 'Failed to fetch settings', 500);
  }
};

const updateSystemSettings = async (req, res) => {
  try {
    const updateData = { ...req.body };
    delete updateData.InstutionCode;

    let settings = await SystemSettings.findOneAndUpdate(
      { InstutionCode: req.user.InstutionCode },
      updateData,
      { new: true, upsert: true }
    ).select('-__v');

    cache.delete(`settings:${req.user.InstutionCode}`);
    return successResponse(res, settings, 'Settings updated successfully');
  } catch (error) {
    logger.error('Error updating settings:', error);
    return errorResponse(res, 'Failed to update settings', 500);
  }
};

// Upload institution-level documents (Logo, Principal/Director signatures, Other docs)
const uploadInstitutionDocument = async (req, res) => {
  try {
    logger.info('Upload institution document called', {
      hasFile: !!req.file,
      body: req.body,
      instutionCode: req.user?.InstutionCode,
    });

    if (!ACCESS_KEY || !SECRET_ACCESS_KEY || !BUCKET_NAME) {
      logger.error('S3 configuration missing', {
        hasAccessKey: !!ACCESS_KEY,
        hasSecretKey: !!SECRET_ACCESS_KEY,
        hasBucket: !!BUCKET_NAME,
      });
      return errorResponse(res, 'S3 configuration missing on server', 500);
    }

    const instutionCode = req.user?.InstutionCode;
    const { type, documentName } = req.body;
    const file = req.file;

    if (!instutionCode) {
      return errorResponse(res, 'Institution code is required', 400);
    }

    if (!file) {
      return errorResponse(res, 'Document file is required', 400);
    }

    const allowedTypes = ['Logo', 'PrincipalSignature', 'DirectorSignature', 'FeeQR', 'Other'];
    if (!type || !allowedTypes.includes(type)) {
      return errorResponse(
        res,
        'Invalid document type. Allowed: Logo, PrincipalSignature, DirectorSignature, Other',
        400
      );
    }

    const originalName = file.originalname || 'document';
    const ext = path.extname(originalName);

    let baseName;
    if (type === 'Logo') {
      baseName = `${instutionCode}_Logo`;
    } else if (type === 'PrincipalSignature') {
      baseName = `${instutionCode}_PrincipalSignature`;
    } else if (type === 'DirectorSignature') {
      baseName = `${instutionCode}_DirectorSignature`;
    } else if (type === 'FeeQR') {
      baseName = `${instutionCode}_FeeQR`;
    } else {
      if (!documentName) {
        return errorResponse(res, 'documentName is required for Other documents', 400);
      }
      const safeName = String(documentName)
        .trim()
        .replace(/\s+/g, '_')
        .replace(/[^a-zA-Z0-9_\-]/g, '');
      baseName = `${instutionCode}_${safeName || 'Document'}`;
    }

    const key = `${instutionCode}/Institution/${baseName}${ext}`;

    logger.info('Uploading to S3', {
      bucket: BUCKET_NAME,
      key,
      fileSize: file.buffer?.length,
      contentType: file.mimetype,
    });

    const uploaded = await s3
      .upload({
        Bucket: BUCKET_NAME,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype || 'application/octet-stream',
      })
      .promise();

    logger.info('S3 upload successful', {
      key: uploaded.Key,
      location: uploaded.Location,
      etag: uploaded.ETag,
    });

    // Persist document info inside SystemSettings.Settings.Documents
    let settingsDoc = await SystemSettings.findOne({
      InstutionCode: instutionCode,
    });

    if (!settingsDoc) {
      settingsDoc = await SystemSettings.create({
        InstutionCode: instutionCode,
        Settings: {
          Documents: {
            LogoKey: null,
            LogoUrl: null,
            PrincipalSignatureKey: null,
            PrincipalSignatureUrl: null,
            DirectorSignatureKey: null,
            DirectorSignatureUrl: null,
            FeeQRKey: null,
            FeeQRUrl: null,
            OtherDocs: []
          }
        }
      });
    }

    if (!settingsDoc.Settings) {
      settingsDoc.Settings = {};
    }
    if (!settingsDoc.Settings.Documents) {
      settingsDoc.Settings.Documents = {
        LogoKey: null,
        LogoUrl: null,
        PrincipalSignatureKey: null,
        PrincipalSignatureUrl: null,
        DirectorSignatureKey: null,
        DirectorSignatureUrl: null,
        FeeQRKey: null,
        FeeQRUrl: null,
        OtherDocs: []
      };
    } else {
      if (settingsDoc.Settings.Documents.FeeQRKey === undefined) {
        settingsDoc.Settings.Documents.FeeQRKey = null;
      }
      if (settingsDoc.Settings.Documents.FeeQRUrl === undefined) {
        settingsDoc.Settings.Documents.FeeQRUrl = null;
      }
    }

    const docs = settingsDoc.Settings.Documents;

    if (type === 'Logo') {
      docs.LogoKey = uploaded.Key;
      docs.LogoUrl = uploaded.Location;
    } else if (type === 'PrincipalSignature') {
      docs.PrincipalSignatureKey = uploaded.Key;
      docs.PrincipalSignatureUrl = uploaded.Location;
    } else if (type === 'DirectorSignature') {
      docs.DirectorSignatureKey = uploaded.Key;
      docs.DirectorSignatureUrl = uploaded.Location;
    } else if (type === 'FeeQR') {
      docs.FeeQRKey = uploaded.Key;
      docs.FeeQRUrl = uploaded.Location;
    } else if (type === 'Other') {
      const safeName = String(documentName)
        .trim()
        .replace(/\s+/g, ' ')
        .substring(0, 100);

      if (!Array.isArray(docs.OtherDocs)) {
        docs.OtherDocs = [];
      }

      const existingIndex = docs.OtherDocs.findIndex(
        (d) => d && d.Name && d.Name.toLowerCase() === safeName.toLowerCase()
      );

      const docEntry = {
        Name: safeName,
        Key: uploaded.Key,
        Url: uploaded.Location,
        UploadedAt: new Date(),
      };

      if (existingIndex >= 0) {
        docs.OtherDocs[existingIndex] = docEntry;
      } else {
        docs.OtherDocs.push(docEntry);
      }
    }

    // Ensure Mixed path changes are persisted
    settingsDoc.markModified('Settings');
    await settingsDoc.save();

    // Invalidate cache so next get-settings returns latest
    cache.delete(`settings:${instutionCode}`);

    return successResponse(
      res,
      {
        key: uploaded.Key,
        url: uploaded.Location,
        type,
      },
      'Institution document uploaded successfully',
      201
    );
  } catch (error) {
    logger.error('Error uploading institution document:', {
      message: error.message,
      stack: error.stack,
      code: error.code,
      statusCode: error.statusCode,
    });
    return errorResponse(
      res,
      `Failed to upload institution document: ${error.message || 'Unknown error'}`,
      500
    );
  }
};

// Delete institution-level documents from S3 and settings
const deleteInstitutionDocument = async (req, res) => {
  try {
    const instutionCode = req.user?.InstutionCode;
    const { type, documentName } = req.body;

    if (!instutionCode) {
      return errorResponse(res, 'Institution code is required', 400);
    }

    const allowedTypes = ['Logo', 'PrincipalSignature', 'DirectorSignature', 'FeeQR', 'Other'];
    if (!type || !allowedTypes.includes(type)) {
      return errorResponse(
        res,
        'Invalid document type. Allowed: Logo, PrincipalSignature, DirectorSignature, Other',
        400
      );
    }

    let settingsDoc = await SystemSettings.findOne({ InstutionCode: instutionCode });
    if (!settingsDoc || !settingsDoc.Settings || !settingsDoc.Settings.Documents) {
      return errorResponse(res, 'No documents found for this institution', 404);
    }

    const docs = settingsDoc.Settings.Documents;
    let keyToDelete = null;

    if (type === 'Logo') {
      keyToDelete = docs.LogoKey;
      docs.LogoKey = null;
      docs.LogoUrl = null;
    } else if (type === 'PrincipalSignature') {
      keyToDelete = docs.PrincipalSignatureKey;
      docs.PrincipalSignatureKey = null;
      docs.PrincipalSignatureUrl = null;
    } else if (type === 'DirectorSignature') {
      keyToDelete = docs.DirectorSignatureKey;
      docs.DirectorSignatureKey = null;
      docs.DirectorSignatureUrl = null;
    } else if (type === 'FeeQR') {
      keyToDelete = docs.FeeQRKey;
      docs.FeeQRKey = null;
      docs.FeeQRUrl = null;
    } else if (type === 'Other') {
      if (!documentName) {
        return errorResponse(res, 'documentName is required for deleting Other documents', 400);
      }
      if (!Array.isArray(docs.OtherDocs)) {
        docs.OtherDocs = [];
      }
      const index = docs.OtherDocs.findIndex(
        (d) => d && d.Name && d.Name.toLowerCase() === String(documentName).toLowerCase()
      );
      if (index >= 0) {
        keyToDelete = docs.OtherDocs[index].Key;
        docs.OtherDocs.splice(index, 1);
      }
    }

    // Delete from S3 if we have a key
    if (keyToDelete) {
      try {
        await s3
          .deleteObject({
            Bucket: BUCKET_NAME,
            Key: keyToDelete,
          })
          .promise();
      } catch (err) {
        logger.warn('Failed to delete institution document from S3', {
          message: err.message,
          key: keyToDelete,
        });
      }
    }

    settingsDoc.markModified('Settings');
    await settingsDoc.save();
    cache.delete(`settings:${instutionCode}`);

    return successResponse(res, { type, documentName }, 'Institution document deleted successfully');
  } catch (error) {
    logger.error('Error deleting institution document:', {
      message: error.message,
      stack: error.stack,
      code: error.code,
      statusCode: error.statusCode,
    });
    return errorResponse(
      res,
      `Failed to delete institution document: ${error.message || 'Unknown error'}`,
      500
    );
  }
};

module.exports = {
  getAllAcademicYears,
  getCurrentAcademicYear,
  createAcademicYear,
  updateAcademicYear,
  getSystemSettings,
  updateSystemSettings,
  uploadInstitutionDocument,
  deleteInstitutionDocument,
};

