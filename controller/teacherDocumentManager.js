const { google } = require('googleapis');
const { Readable } = require('stream');
const apikeys = require('./GDAPIKey.json');
const folderStr = require('./DocumentFolder.json');

const SCOPE = ['https://www.googleapis.com/auth/drive'];

const authorize = async () => {
    const authClient = new google.auth.JWT(
        apikeys.client_email,
        null,
        apikeys.private_key,
        SCOPE
    );
    await authClient.authorize();
    return authClient;
};

const uploaddoc = async (req, res, next) => {
    try {
 
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({
                success: false,
                message: "No files uploaded",
            });
        }

        const authClient = await authorize();

        const uploadPromises = req.files.map(async (file) => {
            console.log(`File: ${file.originalname}, Size: ${file.size}`);
           
            await uploadFile(authClient, file.buffer, `${req.query.teacher}-${file.originalname}`, req.user.InstutionCode);
        });

        await Promise.all(uploadPromises); // Wait for all uploads to complete
        
        return res.status(200).json({
            success: true,
            message: "Files uploaded successfully",
        });
    } catch (error) {
        console.error("❌ Error uploading documents (multiple):", error);
        return res.status(500).json({
            success: false,
            message: "Failed to upload documents",
            error: error.message,
        });
    }
};

const uploadFile = async (authClient, fileBuffer, fileName, instutionId) => {
  const drive = google.drive({ version: 'v3', auth: authClient });
  const fileMetadata = {
      name: fileName,
      parents: [folderStr[instutionId].Teacher], // Replace with your actual folder ID
  };

  const bufferStream = new Readable();
  bufferStream.push(fileBuffer);
  bufferStream.push(null);

  const media = {
      mimeType: 'application/octet-stream',
      body: bufferStream,
  };

  if (fileName.endsWith('.jpg') || fileName.endsWith('.jpeg')) {
      media.mimeType = 'image/jpeg';
  } else if (fileName.endsWith('.png')) {
      media.mimeType = 'image/png';
  } else if (fileName.endsWith('.pdf')) {
      media.mimeType = 'application/pdf';
  } else if (fileName.endsWith('.txt')) {
      media.mimeType = 'text/plain';
  }

  const response = await drive.files.create({
      resource: fileMetadata,
      media: media,
      fields: 'id, name, mimeType, webViewLink, webContentLink',
  });

  return response.data;
};

module.exports = {
    uploaddoc,
};