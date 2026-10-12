const { response } = require('express')
const announcementModel = require('../models/announcementModel')
const { getPermissionSet } = require('./permissionAssinment')
// Google Drive using service account JSON key (same style as StudentDocumentManager)
const { google } = require('googleapis')
const { Readable } = require('stream')
const apikeys = require('./GDAPIKey.json')
const folderStr = require('./DocumentFolder.json')

const SCOPE = ['https://www.googleapis.com/auth/drive']

// Use the exact same JWT pattern that already works in StudentDocumentManager
const authorizeDrive = async () => {
  console.log('apikeys -==-'+JSON.stringify(apikeys));
  console.log('apikeys.client_email -==-'+apikeys.client_email);
  const authClient = new google.auth.JWT(
    apikeys.client_email,
    null,
    apikeys.private_key,
    SCOPE
  )
  await authClient.authorize()
  return authClient
}

const uploadAnnouncementFile = async (authClient, fileBuffer, fileName, instutionId) => {
  console.log('authClient -==-'+authClient);
 
  console.log('fileName -==-'+JSON.stringify(fileName));
  console.log('instutionId -==-'+instutionId);
  const drive = google.drive({ version: 'v3', auth: authClient })

  // Expect a Notification folder per institution in DocumentFolder.json
  const instFolders = folderStr[instutionId]
  console.log('instFolders -==-'+JSON.stringify(instFolders));
  if (!instFolders || !instFolders.Notification) {
    throw new Error(
      `Notification folder not configured for institution ${instutionId} in DocumentFolder.json`
    )
  }
console.log('instFolders.Notification -==-'+instFolders.Notification);
  const fileMetadata = {
    name: fileName,
    parents: [instFolders.Notification],
  }

  const bufferStream = new Readable()
  bufferStream.push(fileBuffer)
  bufferStream.push(null)

  const media = {
    mimeType: 'application/octet-stream',
    body: bufferStream,
  }

  if (fileName.endsWith('.jpg') || fileName.endsWith('.jpeg')) {
    media.mimeType = 'image/jpeg'
  } else if (fileName.endsWith('.png')) {
    media.mimeType = 'image/png'
  } else if (fileName.endsWith('.pdf')) {
    media.mimeType = 'application/pdf'
  } else if (fileName.endsWith('.txt')) {
    media.mimeType = 'text/plain'
  }

  const response = await drive.files.create({
    resource: fileMetadata,
    media: media,
    fields: 'id, name, mimeType, webViewLink, webContentLink',
  })
console.log('response -==-'+response);
  return response.data
}

// Create announcement (text or file-based)
const store = async (req, res, next) => {
  try {
    const permissionsResult = await getPermissionSet(req)
    if (!permissionsResult.notifications || !permissionsResult.notifications.split('-').includes('W')) {
      return res.status(403).json({
        code: 403,
        success: false,
        message:
          'You do not have the necessary permissions to create announcements. Please contact your administrator',
      })
    }
    console.log('inside store -==-');
    const instutionCode = req.user.InstutionCode
    const { Announcement = '', Subject, UserType = 'All' } = req.body

    if (!Subject || !Subject.trim()) {
      return res.status(400).json({
        success: false,
        code: 400,
        message: 'Subject is required',
      })
    }
     console.log('Inside store 1 -==-=');
    // Get the current date and time in local date string format (used elsewhere in app)
    const currentDate = new Date()
    const date = currentDate.toLocaleDateString()

    let fileMeta = {}

    // If a file is uploaded, push it to Google Drive in an institution-specific Notification folder
    if (req.files && req.files.length > 0) {
      const file = req.files[0]
      try {
        console.log('Before authorizeDrive -==-');
        const authClient = await authorizeDrive()
        console.log('authClient -==-'+authClient);
     
        const uploaded = await uploadAnnouncementFile(
          authClient,
          file.buffer,
          file.originalname,
          instutionCode
        )
        console.log('folder Id  -==-'+uploaded.id);

        fileMeta = {
          FileId: uploaded.id,
          FileName: uploaded.name,
          FileMimeType: uploaded.mimeType,
          FileUrl: uploaded.webViewLink || uploaded.webContentLink,
          FileThumbnail: uploaded.thumbnailLink,
        }
      } catch (err) {
        console.error('Error uploading announcement attachment to Google Drive:', err)
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
    console.error('Error creating announcement:', error)
    res.status(500).json({
      success: false,
      message: error.message,
      code: 500,
    })
  }
}

// Get announcements for current institution / user
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

    // If userType is provided, return announcements targeted to that audience or to All
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
    console.error('Error fetching announcements:', error)
    res.status(500).json({
      success: false,
      message: error.message,
      code: 500,
    })
  }
}

const destroy = async (req, res, next) => {
  try {
    const permissionsResult = await getPermissionSet(req)
    if (!permissionsResult.notifications || !permissionsResult.notifications.split('-').includes('D')) {
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

    await announcementModel.findByIdAndDelete(notificationId)

    res.status(200).json({
      code: 200,
      success: true,
      message: 'Notification deleted successfully',
    })
  } catch (error) {
    console.error('Error deleting announcement:', error)
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