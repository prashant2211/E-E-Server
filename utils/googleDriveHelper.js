const { google } = require('googleapis');
const { Readable } = require('stream');
const apikeys = require('../controller/GDAPIKey.json');
const folderStr = require('../controller/DocumentFolder.json');
const Instution = require('../models/InstutionModel');

const SCOPE = ['https://www.googleapis.com/auth/drive'];

/**
 * Authorize Google Drive API
 *
 * Note: When the private key is stored in JSON or environment variables,
 * newline characters are often escaped as "\\n". We need to convert them
 * back to real newlines to avoid "invalid_grant: Invalid JWT Signature".
 */
const authorize = async () => {
    // Normalize private key newlines
    const rawPrivateKey = apikeys.private_key || '';
    const normalizedPrivateKey = rawPrivateKey.replace(/\\n/g, '\n');

    const authClient = new google.auth.JWT(
        apikeys.client_email,
        null,
        normalizedPrivateKey,
        SCOPE
    );
    await authClient.authorize();
    return authClient;
};

/**
 * Get or create a folder for a specific school and folder type
 * @param {string} instutionCode - Institution code
 * @param {string} folderType - Type of folder (e.g., 'Inventory', 'Invoices')
 * @returns {Promise<string>} Folder ID
 */
const getOrCreateSchoolFolder = async (instutionCode, folderType = 'Inventory') => {
    try {
        const authClient = await authorize();
        const drive = google.drive({ version: 'v3', auth: authClient });

        // Check if folder already exists in DocumentFolder.json
        if (folderStr[instutionCode] && folderStr[instutionCode][folderType]) {
            // Verify folder still exists
            try {
                await drive.files.get({
                    fileId: folderStr[instutionCode][folderType],
                    fields: 'id, name'
                });
                return folderStr[instutionCode][folderType];
            } catch (error) {
                // Folder doesn't exist, create new one
                console.log(`Folder ${folderStr[instutionCode][folderType]} not found, creating new folder`);
                // Clear the invalid folder ID
                delete folderStr[instutionCode][folderType];
            }
        }

        // Get or create main school folder
        let schoolFolderId = null;
        if (folderStr[instutionCode] && folderStr[instutionCode].School) {
            try {
                await drive.files.get({
                    fileId: folderStr[instutionCode].School,
                    fields: 'id, name'
                });
                schoolFolderId = folderStr[instutionCode].School;
            } catch (error) {
                // School folder doesn't exist, create it
                console.log(`School folder not found, creating new folder for ${instutionCode}`);
            }
        }

        // Create school folder if it doesn't exist
        if (!schoolFolderId) {
            const institution = await Instution.findOne({ Instution_Id: instutionCode });
            const schoolFolderName = institution 
                ? `${instutionCode}-${institution.Instution_Name || 'School'}` 
                : `${instutionCode}-School`;

            const schoolFolderMetadata = {
                name: schoolFolderName,
                mimeType: 'application/vnd.google-apps.folder'
            };

            const schoolFolder = await drive.files.create({
                resource: schoolFolderMetadata,
                fields: 'id, name'
            });

            schoolFolderId = schoolFolder.data.id;

            // Update DocumentFolder.json structure (in memory, should be persisted)
            if (!folderStr[instutionCode]) {
                folderStr[instutionCode] = {};
            }
            folderStr[instutionCode].School = schoolFolderId;
        }

        // Check if specific folder type exists within school folder
        const folderName = `${folderType}-${instutionCode}`;
        const query = `name='${folderName}' and '${schoolFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;
        
        const existingFolders = await drive.files.list({
            q: query,
            fields: 'files(id, name)'
        });

        if (existingFolders.data.files && existingFolders.data.files.length > 0) {
            const folderId = existingFolders.data.files[0].id;
            
            // Update DocumentFolder.json structure
            if (!folderStr[instutionCode]) {
                folderStr[instutionCode] = {};
            }
            folderStr[instutionCode][folderType] = folderId;
            
            return folderId;
        }

        // Create new folder for the specific type
        const folderMetadata = {
            name: folderName,
            mimeType: 'application/vnd.google-apps.folder',
            parents: [schoolFolderId]
        };

        const folder = await drive.files.create({
            resource: folderMetadata,
            fields: 'id, name'
        });

        const folderId = folder.data.id;

        // Update DocumentFolder.json structure
        if (!folderStr[instutionCode]) {
            folderStr[instutionCode] = {};
        }
        folderStr[instutionCode][folderType] = folderId;

        return folderId;
    } catch (error) {
        console.error('Error getting/creating school folder:', error);
        throw error;
    }
};

/**
 * Upload file to Google Drive
 * @param {Object} authClient - Authorized Google Drive client
 * @param {Buffer} fileBuffer - File buffer
 * @param {string} fileName - File name
 * @param {string} instutionCode - Institution code
 * @param {string} folderType - Type of folder (default: 'Inventory')
 * @returns {Promise<Object>} Uploaded file data
 */
const uploadFile = async (authClient, fileBuffer, fileName, instutionCode, folderType = 'Inventory') => {
    try {
        const drive = google.drive({ version: 'v3', auth: authClient });
        
        // Get or create folder for the school
        const folderId = await getOrCreateSchoolFolder(instutionCode, folderType);

        const fileMetadata = {
            name: fileName,
            parents: [folderId]
        };

        const bufferStream = new Readable();
        bufferStream.push(fileBuffer);
        bufferStream.push(null);

        const media = {
            mimeType: 'application/octet-stream',
            body: bufferStream
        };

        // Set appropriate MIME type based on file extension
        if (fileName.endsWith('.jpg') || fileName.endsWith('.jpeg')) {
            media.mimeType = 'image/jpeg';
        } else if (fileName.endsWith('.png')) {
            media.mimeType = 'image/png';
        } else if (fileName.endsWith('.pdf')) {
            media.mimeType = 'application/pdf';
        } else if (fileName.endsWith('.doc') || fileName.endsWith('.docx')) {
            media.mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        } else if (fileName.endsWith('.xls') || fileName.endsWith('.xlsx')) {
            media.mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        } else if (fileName.endsWith('.txt')) {
            media.mimeType = 'text/plain';
        }

        const response = await drive.files.create({
            resource: fileMetadata,
            media: media,
            fields: 'id, name, mimeType, webViewLink, webContentLink, thumbnailLink'
        });

        return response.data;
    } catch (error) {
        console.error('Error uploading file to Google Drive:', error);
        throw error;
    }
};

module.exports = {
    authorize,
    getOrCreateSchoolFolder,
    uploadFile
};

