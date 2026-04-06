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

const uploadImage = async (req, res, next) => {
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
            await uploadFile(authClient, file.buffer, `${file.originalname}`);
        });

        await Promise.all(uploadPromises); // Wait for all uploads to complete
        
        return res.status(200).json({
            success: true,
            message: "Files uploaded successfully to Google Drive",
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

const uploadFile = async (authClient, fileBuffer, fileName) => {
  const drive = google.drive({ version: 'v3', auth: authClient });

  const fileMetadata = {
      name: fileName,
      parents: [folderStr["RQA-001"].Gallery], // Replace with your actual folder ID
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

////////////////////////////////////////////////
/*const getFilesInFolder = async (req, res) => {
    try {
        const  folderId  = folderStr["RQA-001"].Gallery;
        console.log("📂 Folder ID Received:", folderId);

        if (!folderId) {
            return res.status(400).json({
                success: false,
                message: "Missing folderId in query parameters",
            });
        }

        const authClient = await authorize();
        const drive = google.drive({ version: 'v3', auth: authClient });

        let files = [];
        let nextPageToken = null;

        // Paginate through all results (Google Drive lists max 1000 per page)
        do {
            const response = await drive.files.list({
                q: `'${folderId}' in parents and trashed = false`,
                fields: 'nextPageToken, files(id, name, mimeType, webViewLink)',
                spaces: 'drive',
                pageToken: nextPageToken || undefined,
            });

            files = files.concat(response.data.files);
            nextPageToken = response.data.nextPageToken;
        } while (nextPageToken);

        return res.status(200).json({
            success: true,
            files: files,
        });
    } catch (error) {
        console.error("❌ Error listing folder files:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch folder files from Google Drive",
            error: error.message,
        });
    }
};*/

// const listImagesInFolder = async (req, res) => {
//     try {
//         const  folderId  = folderStr["RQA-001"].Gallery;

//         if (!folderId) {
//             return res.status(400).json({ success: false, data: [], message: 'Missing folderId' });
//         }

//         const authClient = await authorize();
//         const drive = google.drive({ version: 'v3', auth: authClient });

//         const response = await drive.files.list({
//             q: `'${folderId}' in parents and trashed = false and mimeType contains 'image/'`,
//             fields: 'files(id, name, mimeType)',
//         });

//         const files = response.data.files;

//         // Build a URL your frontend can hit to get each image
//         const imageUrls = files.map((file) => ({
//             name: file.name,
//             mimeType: file.mimeType,
//             url: `/api/image?fileId=${file.id}`,
//         }));

//         return res.status(200).json({ success: true, code:200, data: imageUrls });
//     } catch (error) {
//         console.error("❌ Error listing images:", error);
//         return res.status(500).json({
//             success: false,
//             message: "Failed to list images",
//             error: error.message,
//             data:[],
//             code: 500
//         });
//     }
// };

// const { google } = require('googleapis');//
// const authorize = require('./path-to-authorize');

const listImagesInFolder = async (req, res) => {
  try {
    const folderId = folderStr["RQA-001"].Gallery;

    if (!folderId) {
      return res.status(400).json({ success: false, data: [], message: 'Missing folderId' });
    }

    const authClient = await authorize();
    const drive = google.drive({ version: 'v3', auth: authClient });

    // Step 1: List image files in folder
    const response = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false and mimeType contains 'image/'`,
      fields: 'files(id, name, mimeType)',
    });

    const files = response.data.files;

    const imagePromises = files.map(async (file) => {
      try {
        const fileStream = await drive.files.get(
          { fileId: file.id, alt: 'media' },
          { responseType: 'arraybuffer' } // Get raw data
        );

        const base64Image = Buffer.from(fileStream.data, 'binary').toString('base64');

        return {
          name: file.name,
          mimeType: file.mimeType,
          data: `data:${file.mimeType};base64,${base64Image}`
        };
      } catch (err) {
        console.error(`Error fetching file ${file.name}:`, err);
        return null;
      }
    });

    const imagesWithData = (await Promise.all(imagePromises)).filter(Boolean); // remove nulls

    return res.status(200).json({
      success: true,
      code: 200,
      data: imagesWithData
    });

  } catch (error) {
    console.error("❌ Error in listImagesInFolder:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to list and fetch images",
      error: error.message,
      data: [],
      code: 500
    });
  }
};

module.exports = { listImagesInFolder };





////////////////////////////////////////////////////

module.exports = {
    uploadImage, listImagesInFolder
};