const announcementModel = require('../models/announcementModel')
const { getPermissionSet } = require('./permissionAssinment')
const AWS = require('aws-sdk')

// Configure S3 using environment variables
const ACCESS_KEY = process.env.ACCESS_KEY
const SECRET_ACCESS_KEY = process.env.SECRET_ACCESS_KEY
const BUCKET_NAME = process.env.BUCKET_NAME
const AWS_REGION = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'ap-south-1'

const s3 = new AWS.S3({
  accessKeyId: ACCESS_KEY,
  secretAccessKey: SECRET_ACCESS_KEY,
  region: AWS_REGION,
})

const uploadToS3 = async (buffer, key, contentType) => {
  if (!BUCKET_NAME || !ACCESS_KEY || !SECRET_ACCESS_KEY) {
    throw new Error('S3 configuration missing (ACCESS_KEY, SECRET_ACCESS_KEY, BUCKET_NAME)')
  }

  const params = {
    Bucket: BUCKET_NAME,
    Key: key,
    Body: buffer,
    ContentType: contentType || 'application/octet-stream',
  }

  const result = await s3.upload(params).promise()
  return result
}

// Create announcement (text or file-based) using S3 for file storage
const store = async (req, res, next) => {
  try {
    const permissionsResult = await getPermissionSet(req)
    if (
      !permissionsResult.notifications ||
      !permissionsResult.notifications.split('-').includes('W')
    ) {
      return res.status(403).json({
        code: 403,
        success: false,
        message:
          'You do not have the necessary permissions to create announcements. Please contact your administrator',
      })
    }

    const instutionCode = req.user.InstutionCode
    const { Announcement = '', Subject, UserType = 'All' } = req.body

    if (!Subject || !Subject.trim()) {
      return res.status(400).json({
        success: false,
        code: 400,
        message: 'Subject is required',
      })
    }

    const currentDate = new Date()
    const date = currentDate.toLocaleDateString()

    let fileMeta = {}

    // If a file is uploaded, push it to S3 under {InstutionCode}/Notification/
    if (req.files && req.files.length > 0) {
      const file = req.files[0]
      try {
        const originalName = file.originalname || 'attachment'
        const safeName = originalName.replace(/\s+/g, '_')
        const timestamp = Date.now()
        const key = `${instutionCode}/Notification/${timestamp}-${safeName}`

        const uploaded = await uploadToS3(file.buffer, key, file.mimetype)

        fileMeta = {
          FileId: uploaded.Key,
          FileName: originalName,
          FileMimeType: file.mimetype,
          FileUrl: uploaded.Location,
          FileThumbnail: '', // not applicable for S3 by default
        }
      } catch (err) {
        console.error('Error uploading announcement attachment to S3:', err)
        return res.status(500).json({
          success: false,
          code: 500,
          message: 'Failed to upload attachment for announcement',
          error: err.message,
        })
      }
    }

    let announcementType = 'text'
    if (fileMeta.FileId && Announcement && Announcement.trim()) {
      announcementType = 'text+file'
    } else if (fileMeta.FileId) {
      announcementType = 'file'
    }

    const announcement = new announcementModel({
      InstutionId: instutionCode,
      Announcement: Announcement || '',
      Date: date,
      UserType: UserType || 'All',
      Subject: Subject.trim(),
      AnnouncementType: announcementType,
      ...fileMeta,
    })

    await announcement.save()

    res.status(201).json({
      success: true,
      message: 'Notification added successfully!',
      code: 201,
      data: announcement,
    })
  } catch (error) {
    console.error('Error creating announcement (S3):', error)
    res.status(500).json({
      success: false,
      message: error.message,
      code: 500,
    })
  }
}

// Get announcements for current institution / user (same as existing logic)
const show = async (req, res, next) => {
  try {
    const instutionCode = req.user?.InstutionCode
    const userType = req.query.UserType // Optional: Student / Parent / Teacher / Admin / All

    if (!instutionCode) {
      return res.status(400).json({
        success: false,
        message: 'Institution code is required',
        code: 400,
      })
    }

    const filter = {
      InstutionId: instutionCode,
    }

    if (userType) {
      filter.$or = [{ UserType: 'All' }, { UserType: userType }]
    }

    const announcemenRecord = await announcementModel
      .find(filter)
      .sort({ createdAt: -1 })
      .lean()

    res.status(200).json({
      success: true,
      message: 'Notification fetched successfully!',
      code: 200,
      data: announcemenRecord,
    })
  } catch (error) {
    console.error('Error fetching announcements (S3):', error)
    res.status(500).json({
      success: false,
      message: error.message,
      code: 500,
    })
  }
}

// Delete announcement (keeps same behavior, does not delete S3 object for now)
const destroy = async (req, res, next) => {
  try {
    const permissionsResult = await getPermissionSet(req)
    if (
      !permissionsResult.notifications ||
      !permissionsResult.notifications.split('-').includes('D')
    ) {
      return res.status(401).json({
        code: 401,
        success: false,
        message:
          'You do not have the necessary permissions to delete announcements. Please contact your administrator',
      })
    }

    const notificationId = req.body.announcementId || req.query.NotificationId

    if (!notificationId) {
      return res.status(400).json({
        code: 400,
        success: false,
        message: 'announcementId is required',
      })
    }

    // Find announcement first so we know if there is an attached file
    const announcement = await announcementModel.findById(notificationId)

    if (!announcement) {
      return res.status(404).json({
        code: 404,
        success: false,
        message: 'Notification not found',
      })
    }

    // If there is a file stored in S3, try to delete it
    if (announcement.FileId && BUCKET_NAME) {
      try {
        await s3
          .deleteObject({
            Bucket: BUCKET_NAME,
            Key: announcement.FileId,
          })
          .promise()
      } catch (err) {
        console.error('Error deleting S3 object for announcement:', err)
        // We continue with DB delete even if S3 delete fails
      }
    }

    await announcementModel.findByIdAndDelete(notificationId)

    res.status(200).json({
      code: 200,
      success: true,
      message: 'Notification deleted successfully',
    })
  } catch (error) {
    console.error('Error deleting announcement (S3):', error)
    res.status(500).json({
      code: 500,
      success: false,
      message: 'An error occurred while deleting notification',
    })
  }
}

module.exports = {
  store,
  show,
  destroy,
}


