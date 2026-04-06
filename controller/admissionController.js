const { response } = require('express')
const admissionModel = require('../models/admissionModel')
const studentModel = require('../models/studentModel')
const userModel = require('../models/User')
const classModel = require('../models/classModel')
const sectionModel = require('../models/sectionModel')
const admissionRequiredDocumentModel = require('../models/admissionRequiredDocumentModel')
const mongoErrorMessages = require('./mongoErrors.json')
const { cache } = require('../utils/cache')
const admissionDocumentCatalogModel = require('../models/admissionDocumentCatalogModel')
const bcrypt = require('bcryptjs')
const { getPermissionSet } = require('./permissionAssinment')
const { AcademicYear } = require('../models/academicYearModel')
const StudentEnrollment = require('../models/studentEnrollmentModel')
const { resolveAcademicYearScope } = require('../utils/academicYearScope')
const AWS = require('aws-sdk')
const path = require('path')

const ACCESS_KEY = process.env.ACCESS_KEY
const SECRET_ACCESS_KEY = process.env.SECRET_ACCESS_KEY
const BUCKET_NAME = process.env.BUCKET_NAME
const AWS_REGION = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'ap-southeast-2'

const s3 = new AWS.S3({
    accessKeyId: ACCESS_KEY,
    secretAccessKey: SECRET_ACCESS_KEY,
    region: AWS_REGION,
})

const buildTempRegistration = (instutionCode) => {
    const prefix = String(instutionCode || 'INST')
        .replace(/[^a-zA-Z0-9]/g, '')
        .toUpperCase()
        .slice(0, 6) || 'INST'
    const ymd = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    const rand = Math.random().toString(36).slice(2, 8).toUpperCase()
    return `TMP-${prefix}-${ymd}-${rand}`
}

const generateTemporaryRegistrationNumber = async (instutionCode) => {
    for (let i = 0; i < 12; i += 1) {
        const candidate = buildTempRegistration(instutionCode)
        // Keep temporary registration unique for this institution
        const exists = await admissionModel.exists({
            InstutionCode: instutionCode,
            Registration_Number: candidate,
        })
        if (!exists) return candidate
    }
    // Extremely unlikely fallback with timestamp entropy
    return `TMP-${Date.now()}-${Math.floor(Math.random() * 100000)}`
}

// Show the list of admissions
const index = async (req, res, next) => {
    try {
        const permissionsResult = await getPermissionSet(req);
        
        // Check permissions - Allow Admin, Admission Staff, and SuperAdmin
        const allowedRoles = ['Admin', 'Admission Staff', 'SuperAdmin'];
        if (!allowedRoles.includes(req.user?.UserType) && 
            !permissionsResult.admissions?.split("-").includes('R')) {
            return res.status(403).json({
                code: 403,
                success: false,
                message: 'You do not have permission to view admissions. Only Admin and Admission Staff can access this.'
            });
        }

        // Filter by institution
        const query = {};
        if (req.user?.InstutionCode) {
            query.InstutionCode = req.user.InstutionCode;
        } else if (req.user?.UserType !== 'SuperAdmin') {
            return res.status(403).json({
                code: 403,
                success: false,
                message: 'Institution code required'
            });
        }

        const scope = await resolveAcademicYearScope(req)
        if (scope?.from && scope?.to) {
            // Many new applications have no Admission_Date yet; they must still appear in the list.
            query.$or = [
                { Admission_Date: { $gte: scope.from, $lte: scope.to } },
                { Admission_Date: null },
                { Admission_Date: { $exists: false } },
            ]
        }

        const admissions = await admissionModel.find(query);
        res.json({
            success: true,
            code: 200,
            response: admissions
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            code: 500,
            message: 'An error occurred!',
            error: error.message
        });
    }
}

// Get single admission Record
const show = async (req, res, next) => {
    try {
        const permissionsResult = await getPermissionSet(req);
        const allowedRoles = ['Admin', 'Admission Staff', 'SuperAdmin'];
        
        if (!allowedRoles.includes(req.user?.UserType) && 
            !permissionsResult.admissions?.split("-").includes('R')) {
            return res.status(403).json({
                code: 403,
                success: false,
                message: 'You do not have permission to view admission details.'
            });
        }

        let studentRegId = req.body.studentRegId || req.query.studentRegId;
        const admission = await admissionModel.findById(studentRegId);
        
        if (!admission) {
            return res.status(404).json({
                success: false,
                code: 404,
                message: 'Admission record not found'
            });
        }

        res.json({
            success: true,
            code: 200,
            response: admission
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            code: 500,
            message: 'An error occurred!',
            error: error.message
        });
    }
}

// Add New Admission to database
const store = async (req, res, next) => {
    try {
        // Get InstutionCode from authenticated user or request body
        const instutionCode = req.user?.InstutionCode || req.body.InstutionCode;
        
        // Validate InstutionCode is present
        if (!instutionCode) {
            return res.status(400).json({
                success: false,
                code: 400,
                message: 'Institution code is required. Please ensure you are logged in or provide InstutionCode in the request.'
            });
        }

        // Check permissions for authenticated users
        if (req.user) {
            const permissionsResult = await getPermissionSet(req);
            const allowedRoles = ['Admin', 'Admission Staff', 'SuperAdmin'];
            
            if (!allowedRoles.includes(req.user?.UserType) && 
                !permissionsResult.admissions?.split("-").includes('W')) {
                return res.status(403).json({
                    code: 403,
                    success: false,
                    message: 'You do not have permission to create admissions. Only Admin and Admission Staff can access this.'
                });
            }
        }

        const initialStatus = req.body.Status || 'Pending'
        if (initialStatus !== 'Pending') {
            return res.status(400).json({
                success: false,
                code: 400,
                message: 'New applications must start with status Pending.',
            })
        }

        const temporaryRegistrationNumber = await generateTemporaryRegistrationNumber(instutionCode)

        let newStudent = new admissionModel({
            Student_Name: req.body.Student_Name,
            Phone_Number: req.body.Phone_Number,
            Class_Name: req.body.Class_Name,
            Privious_School_Name: req.body.Privious_School_Name,
            Address: req.body.Address,
            Previous_class: req.body.Previous_class,
            Age: req.body.Age,
            Father_Name: req.body.Father_Name,
            Mother_Name: req.body.Mother_Name,
            School_visit_Day: req.body.School_visit_Day,
            Integrested_Subject: req.body.Integrested_Subject,
            Day_Of_Registration: req.body.Day_Of_Registration,
            Status: 'Pending',
            Admission_Date: req.body.Admission_Date,
            Registration_Number: temporaryRegistrationNumber,
            Date_Of_Birth: req.body.Date_Of_Birth,
            Gender: req.body.Gender,
            Aadhar_Number: req.body.Aadhar_Number,
            State: req.body.State,
            District: req.body.District,
            Email: req.body.Email,
            InstutionCode: instutionCode,
            AdmissionFeeStatus: 'Pending',
        })
        
        const saved = await newStudent.save();
        res.status(201).json({
            success: true,
            code: 201,
            message: 'Admission record created successfully!',
            data: saved
        });
    } catch (error) {
        const matchedKey = Object.keys(mongoErrorMessages).find((key) =>
            error.message.includes(key),
        )
        const errorMessage =
            matchedKey && mongoErrorMessages[matchedKey]
                ? mongoErrorMessages[matchedKey]
                : error.message || 'An error occurred while creating admission'

        res.status(500).json({
            success: false,
            code: 500,
            message: errorMessage,
            error: error.message
        });
    }
}

// Update Admission record
const update = async (req, res, next) => {
    try {
        const permissionsResult = await getPermissionSet(req);
        const allowedRoles = ['Admin', 'Admission Staff', 'SuperAdmin'];
        
        if (!allowedRoles.includes(req.user?.UserType) && 
            !permissionsResult.admissions?.split("-").includes('E')) {
            return res.status(403).json({
                code: 403,
                success: false,
                message: 'You do not have permission to update admissions. Only Admin and Admission Staff can access this.'
            });
        }

        let studentRegId = req.body.studentRegId

        const existing = await admissionModel.findById(studentRegId)
        if (!existing) {
            return res.status(404).json({
                success: false,
                code: 404,
                message: 'Admission record not found',
            })
        }

        // Status is controlled only by verify-documents, admission fee payment, and convert — not by this form
        let updateData = {
            Student_Name: req.body.Student_Name,
            Phone_Number: req.body.Phone_Number,
            Class_Name: req.body.Class_Name,
            Privious_School_Name: req.body.Privious_School_Name,
            Address: req.body.Address,
            Previous_class: req.body.Previous_class,
            Age: req.body.Age,
            Father_Name: req.body.Father_Name,
            School_visit_Day: req.body.School_visit_Day,
            Integrested_Subject: req.body.Integrested_Subject,
            Day_Of_Registration: req.body.Day_Of_Registration,
            Admission_Date: req.body.Admission_Date,
            Registration_Number: req.body.Registration_Number,
        }

        const updated = await admissionModel.findByIdAndUpdate(
            studentRegId,
            { $set: updateData },
            { new: true }
        )
        
        res.json({
            success: true,
            code: 200,
            message: 'Admission details updated successfully',
            data: updated
        });
    } catch (error) {
        const matchedKey = Object.keys(mongoErrorMessages).find((key) =>
            error.message.includes(key),
        )
        const errorMessage =
            matchedKey && mongoErrorMessages[matchedKey]
                ? mongoErrorMessages[matchedKey]
                : error.message || 'An error occurred while updating admission'

        res.status(500).json({
            success: false,
            code: 500,
            message: errorMessage,
            error: error.message
        });
    }
}

// Delete Admission => Only Admin and Admission Staff can access this feature
const destroy = async (req, res, next) => {
    try {
        const permissionsResult = await getPermissionSet(req);
        const allowedRoles = ['Admin', 'Admission Staff', 'SuperAdmin'];
        
        if (!allowedRoles.includes(req.user?.UserType) && 
            !permissionsResult.admissions?.split("-").includes('D')) {
            return res.status(403).json({
                code: 403,
                success: false,
                message: 'You do not have permission to delete admissions. Only Admin and Admission Staff can access this.'
            });
        }

        let studentRegId = req.body.studentRegId
        const deleted = await admissionModel.findByIdAndDelete(studentRegId);
        
        if (!deleted) {
            return res.status(404).json({
                success: false,
                code: 404,
                message: 'Admission record not found'
            });
        }

        res.json({
            success: true,
            code: 200,
            message: 'Admission record deleted successfully'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            code: 500,
            message: 'An error occurred!',
            error: error.message
        });
    }
}

const upsertRequiredDocuments = async (req, res) => {
    try {
        const { Class_Name, Documents } = req.body
        if (!Class_Name) {
            return res.status(400).json({ success: false, code: 400, message: 'Class_Name is required.' })
        }

        const normalizedDocuments = Array.isArray(Documents)
            ? [...new Set(Documents.map((d) => String(d || '').trim()).filter(Boolean))]
            : []

        const config = await admissionRequiredDocumentModel.findOneAndUpdate(
            { InstutionCode: req.user.InstutionCode, Class_Name: String(Class_Name).trim() },
            { $set: { Documents: normalizedDocuments } },
            { upsert: true, new: true }
        )

        return res.status(200).json({
            success: true,
            code: 200,
            message: 'Required documents updated successfully.',
            data: config,
        })
    } catch (error) {
        return res.status(500).json({
            success: false,
            code: 500,
            message: error.message || 'Failed to update required documents.',
        })
    }
}

const getRequiredDocuments = async (req, res) => {
    try {
        const className = String(req.query.Class_Name || req.query.className || '').trim()
        if (!className) {
            return res.status(400).json({ success: false, code: 400, message: 'Class_Name is required.' })
        }

        const config = await admissionRequiredDocumentModel
            .findOne({ InstutionCode: req.user.InstutionCode, Class_Name: className })
            .lean()

        return res.status(200).json({
            success: true,
            code: 200,
            data: {
                Class_Name: className,
                Documents: config?.Documents || [],
            },
        })
    } catch (error) {
        return res.status(500).json({
            success: false,
            code: 500,
            message: error.message || 'Failed to fetch required documents.',
        })
    }
}

const getAllRequiredDocuments = async (req, res) => {
    try {
        const rows = await admissionRequiredDocumentModel
            .find({ InstutionCode: req.user.InstutionCode })
            .sort({ Class_Name: 1 })
            .lean()

        return res.status(200).json({
            success: true,
            code: 200,
            data: rows.map((row) => ({
                _id: row._id,
                Class_Name: row.Class_Name,
                Documents: Array.isArray(row.Documents) ? row.Documents : [],
                updatedAt: row.updatedAt || null,
            })),
        })
    } catch (error) {
        return res.status(500).json({
            success: false,
            code: 500,
            message: error.message || 'Failed to fetch class-wise required documents.',
        })
    }
}

const getDocumentCatalog = async (req, res) => {
    try {
        const doc = await admissionDocumentCatalogModel
            .findOne({ InstutionCode: req.user.InstutionCode })
            .lean()
        const names = Array.isArray(doc?.DocumentNames) ? doc.DocumentNames : []
        return res.status(200).json({
            success: true,
            code: 200,
            data: { DocumentNames: names },
        })
    } catch (error) {
        return res.status(500).json({
            success: false,
            code: 500,
            message: error.message || 'Failed to fetch document catalog.',
        })
    }
}

const addDocumentCatalogName = async (req, res) => {
    try {
        const name = String(req.body.name || '').trim()
        if (!name) {
            return res.status(400).json({ success: false, code: 400, message: 'name is required.' })
        }

        let doc = await admissionDocumentCatalogModel.findOne({ InstutionCode: req.user.InstutionCode })
        if (!doc) {
            doc = await admissionDocumentCatalogModel.create({
                InstutionCode: req.user.InstutionCode,
                DocumentNames: [],
            })
        }
        const lower = name.toLowerCase()
        if (doc.DocumentNames.some((n) => String(n).trim().toLowerCase() === lower)) {
            return res.status(200).json({
                success: true,
                code: 200,
                message: 'Document name already exists.',
                data: { DocumentNames: doc.DocumentNames },
            })
        }
        doc.DocumentNames.push(name)
        doc.markModified('DocumentNames')
        await doc.save()
        return res.status(200).json({
            success: true,
            code: 200,
            message: 'Document name added.',
            data: { DocumentNames: doc.DocumentNames },
        })
    } catch (error) {
        return res.status(500).json({
            success: false,
            code: 500,
            message: error.message || 'Failed to add document name.',
        })
    }
}

const removeDocumentCatalogName = async (req, res) => {
    try {
        const name = String(req.body.name || '').trim()
        if (!name) {
            return res.status(400).json({ success: false, code: 400, message: 'name is required.' })
        }

        const doc = await admissionDocumentCatalogModel.findOne({ InstutionCode: req.user.InstutionCode })
        if (!doc) {
            return res.status(200).json({
                success: true,
                code: 200,
                data: { DocumentNames: [] },
            })
        }
        const lower = name.toLowerCase()
        doc.DocumentNames = doc.DocumentNames.filter(
            (n) => String(n).trim().toLowerCase() !== lower
        )
        doc.markModified('DocumentNames')
        await doc.save()
        return res.status(200).json({
            success: true,
            code: 200,
            message: 'Document name removed.',
            data: { DocumentNames: doc.DocumentNames },
        })
    } catch (error) {
        return res.status(500).json({
            success: false,
            code: 500,
            message: error.message || 'Failed to remove document name.',
        })
    }
}

const uploadAdmissionDocument = async (req, res) => {
    try {
        if (!ACCESS_KEY || !SECRET_ACCESS_KEY || !BUCKET_NAME) {
            return res.status(500).json({ success: false, code: 500, message: 'S3 configuration missing on server.' })
        }

        const { admissionId, documentName } = req.body
        const file = req.file
        if (!admissionId || !documentName) {
            return res.status(400).json({ success: false, code: 400, message: 'admissionId and documentName are required.' })
        }
        if (!file) {
            return res.status(400).json({ success: false, code: 400, message: 'Document file is required.' })
        }

        const admission = await admissionModel.findById(admissionId)
        if (!admission) {
            return res.status(404).json({ success: false, code: 404, message: 'Admission record not found.' })
        }
        if (req.user?.UserType !== 'SuperAdmin' && admission.InstutionCode !== req.user?.InstutionCode) {
            return res.status(403).json({ success: false, code: 403, message: 'Access denied.' })
        }

        const safeName = String(documentName)
            .trim()
            .replace(/\s+/g, '_')
            .replace(/[^a-zA-Z0-9_\-]/g, '')
            .substring(0, 80) || 'Document'
        const ext = path.extname(file.originalname || '') || ''
        const key = `${admission.InstutionCode}/Admission/${admission._id}/${safeName}${ext}`

        const uploaded = await s3.upload({
            Bucket: BUCKET_NAME,
            Key: key,
            Body: file.buffer,
            ContentType: file.mimetype || 'application/octet-stream',
        }).promise()

        const entry = {
            Name: String(documentName).trim(),
            Key: uploaded.Key,
            Url: uploaded.Location,
            UploadedAt: new Date(),
        }

        if (!Array.isArray(admission.AdmissionDocuments)) {
            admission.AdmissionDocuments = []
        }

        const existingIndex = admission.AdmissionDocuments.findIndex(
            (d) => String(d?.Name || '').toLowerCase() === entry.Name.toLowerCase()
        )
        if (existingIndex >= 0) {
            admission.AdmissionDocuments[existingIndex] = entry
        } else {
            admission.AdmissionDocuments.push(entry)
        }

        await admission.save()
        return res.status(200).json({
            success: true,
            code: 200,
            message: 'Document uploaded successfully.',
            data: {
                admissionId: admission._id,
                document: entry,
                documents: admission.AdmissionDocuments,
            },
        })
    } catch (error) {
        return res.status(500).json({
            success: false,
            code: 500,
            message: error.message || 'Failed to upload admission document.',
        })
    }
}

/**
 * Short-lived signed URL so staff can open private S3 objects in a new browser tab.
 */
const getAdmissionDocumentViewUrl = async (req, res) => {
    try {
        if (!BUCKET_NAME || !ACCESS_KEY || !SECRET_ACCESS_KEY) {
            return res.status(500).json({
                success: false,
                code: 500,
                message: 'S3 configuration missing on server.',
            })
        }

        const admissionId = String(req.query.admissionId || req.body.admissionId || '').trim()
        const documentName = String(req.query.documentName || req.body.documentName || '').trim()
        if (!admissionId || !documentName) {
            return res.status(400).json({
                success: false,
                code: 400,
                message: 'admissionId and documentName are required.',
            })
        }

        const admission = await admissionModel.findById(admissionId)
        if (!admission) {
            return res.status(404).json({ success: false, code: 404, message: 'Admission record not found.' })
        }
        if (req.user?.UserType !== 'SuperAdmin' && admission.InstutionCode !== req.user?.InstutionCode) {
            return res.status(403).json({ success: false, code: 403, message: 'Access denied.' })
        }

        const lower = documentName.toLowerCase()
        const entry = (admission.AdmissionDocuments || []).find(
            (d) => String(d?.Name || '').trim().toLowerCase() === lower
        )
        if (!entry?.Key) {
            return res.status(404).json({
                success: false,
                code: 404,
                message: 'No uploaded file found for this document name.',
            })
        }

        const url = await s3.getSignedUrlPromise('getObject', {
            Bucket: BUCKET_NAME,
            Key: entry.Key,
            Expires: 60 * 60,
        })

        return res.status(200).json({
            success: true,
            code: 200,
            data: { url },
        })
    } catch (error) {
        return res.status(500).json({
            success: false,
            code: 500,
            message: error.message || 'Failed to generate document link.',
        })
    }
}

/**
 * After reviewing documents: accept → Payment Pending, reject → Rejected
 */
const verifyDocuments = async (req, res) => {
    try {
        const permissionsResult = await getPermissionSet(req)
        const allowedRoles = ['Admin', 'Admission Staff', 'SuperAdmin']

        if (
            !allowedRoles.includes(req.user?.UserType) &&
            !permissionsResult.admissions?.split("-").includes('E')
        ) {
            return res.status(403).json({
                code: 403,
                success: false,
                message: 'You do not have permission to verify admission documents.',
            })
        }

        const { admissionId, decision, documentUploadWaived } = req.body
        const waived =
            documentUploadWaived === true ||
            documentUploadWaived === 'true' ||
            documentUploadWaived === 1
        if (!admissionId || !['accept', 'reject'].includes(decision)) {
            return res.status(400).json({
                success: false,
                code: 400,
                message: 'admissionId and decision ("accept" or "reject") are required.',
            })
        }

        const admission = await admissionModel.findById(admissionId)
        if (!admission) {
            return res.status(404).json({
                success: false,
                code: 404,
                message: 'Admission record not found',
            })
        }

        if (req.user?.UserType !== 'SuperAdmin' && admission.InstutionCode !== req.user?.InstutionCode) {
            return res.status(403).json({
                success: false,
                code: 403,
                message: 'Access denied',
            })
        }

        if (admission.Status !== 'Pending') {
            return res.status(400).json({
                success: false,
                code: 400,
                message: 'Documents can only be verified when the application status is Pending.',
            })
        }

        if (decision === 'accept') {
            const requiredConfig = await admissionRequiredDocumentModel
                .findOne({
                    InstutionCode: admission.InstutionCode,
                    Class_Name: String(admission.Class_Name || '').trim(),
                })
                .lean()
            const requiredDocs = Array.isArray(requiredConfig?.Documents) ? requiredConfig.Documents : []
            const uploadedNames = new Set(
                (admission.AdmissionDocuments || []).map((d) => String(d?.Name || '').trim().toLowerCase())
            )
            const missingDocs = requiredDocs.filter((name) => !uploadedNames.has(String(name).trim().toLowerCase()))
            if (requiredDocs.length > 0 && missingDocs.length > 0 && !waived) {
                return res.status(400).json({
                    success: false,
                    code: 400,
                    message: `Please upload all required documents before acceptance, or mark "Document upload not required": ${missingDocs.join(', ')}`,
                    missingDocuments: missingDocs,
                })
            }
            admission.Status = 'Payment Pending'
            if (requiredDocs.length > 0 && waived && missingDocs.length > 0) {
                admission.DocumentUploadWaived = true
                admission.DocumentUploadWaivedAt = new Date()
            } else {
                admission.DocumentUploadWaived = false
                admission.DocumentUploadWaivedAt = null
            }
        } else {
            admission.Status = 'Rejected'
        }
        await admission.save()

        res.json({
            success: true,
            code: 200,
            message:
                decision === 'accept'
                    ? 'Documents accepted. Status is now Payment Pending.'
                    : 'Application rejected.',
            data: admission,
        })
    } catch (error) {
        res.status(500).json({
            success: false,
            code: 500,
            message: error.message || 'Verification failed',
        })
    }
}

/**
 * After admission fee is recorded (Payment Done), staff confirms final approval.
 */
const approveAdmission = async (req, res) => {
    try {
        const permissionsResult = await getPermissionSet(req)
        const allowedRoles = ['Admin', 'Admission Staff', 'SuperAdmin']

        if (
            !allowedRoles.includes(req.user?.UserType) &&
            !permissionsResult.admissions?.split("-").includes('E')
        ) {
            return res.status(403).json({
                code: 403,
                success: false,
                message: 'You do not have permission to approve admissions.',
            })
        }

        const { admissionId } = req.body
        if (!admissionId) {
            return res.status(400).json({
                success: false,
                code: 400,
                message: 'admissionId is required.',
            })
        }

        const admission = await admissionModel.findById(admissionId)
        if (!admission) {
            return res.status(404).json({
                success: false,
                code: 404,
                message: 'Admission record not found',
            })
        }

        if (req.user?.UserType !== 'SuperAdmin' && admission.InstutionCode !== req.user?.InstutionCode) {
            return res.status(403).json({
                success: false,
                code: 403,
                message: 'Access denied',
            })
        }

        if (admission.Status !== 'Payment Done') {
            return res.status(400).json({
                success: false,
                code: 400,
                message: 'Admission can be approved only when status is Payment Done.',
            })
        }

        if ((admission.AdmissionFeeStatus || 'Pending') !== 'Received') {
            return res.status(400).json({
                success: false,
                code: 400,
                message: 'Admission fee must be recorded before final approval.',
            })
        }

        admission.Status = 'Approved'
        await admission.save()

        res.json({
            success: true,
            code: 200,
            message: 'Admission approved successfully.',
            data: admission,
        })
    } catch (error) {
        res.status(500).json({
            success: false,
            code: 500,
            message: error.message || 'Approval failed',
        })
    }
}

// Convert Admission to Student
const convertToStudent = async (req, res, next) => {
    try {
        const permissionsResult = await getPermissionSet(req);
        const allowedRoles = ['Admin', 'Admission Staff', 'SuperAdmin'];
        
        if (!allowedRoles.includes(req.user?.UserType) && 
            !permissionsResult.admissions?.split("-").includes('W')) {
            return res.status(403).json({
                code: 403,
                success: false,
                message: 'You do not have permission to convert admissions. Only Admin and Admission Staff can access this.'
            });
        }

        const {
            admissionId,
            Class_Code,
            SectionCode,
            Email,
            DOB,
            Gender,
            Aadhar,
            State,
            District,
            Mother_Name,
            Registration_Number: requestedRegistrationNumber,
        } = req.body;

        if (!admissionId) {
            return res.status(400).json({
                success: false,
                code: 400,
                message: 'Admission ID is required'
            });
        }

        // Fetch admission record
        const admission = await admissionModel.findById(admissionId);
        
        if (!admission) {
            return res.status(404).json({
                success: false,
                code: 404,
                message: 'Admission record not found'
            });
        }

        // Check if already converted
        if (admission.IsConvertedToStudent) {
            return res.status(400).json({
                success: false,
                code: 400,
                message: 'This admission has already been converted to a student'
            });
        }

        // Check if status is Approved
        if (admission.Status !== 'Approved' && admission.Status !== 'Admitted') {
            return res.status(400).json({
                success: false,
                code: 400,
                message: 'Admission must be approved before converting to student'
            });
        }

        if ((admission.AdmissionFeeStatus || 'Pending') !== 'Received') {
            return res.status(400).json({
                success: false,
                code: 400,
                message:
                    'Admission fee must be received before converting this application to a student.',
            });
        }

        // Parse student name (assuming format: "FirstName LastName" or just "Name")
        const nameParts = (admission.Student_Name || '').trim().split(' ');
        const First_Name = nameParts[0] || 'Student';
        const Last_Name = nameParts.slice(1).join(' ') || '';

        // Get class and section details
        let className = admission.Class_Name || '';
        let sectionName = '';
        
        if (Class_Code) {
            const classData = await classModel.findOne({ Class_Code: Class_Code });
            if (classData) {
                className = classData.Class_Name || className;
            }
        }

        if (SectionCode) {
            const sectionData = await sectionModel.findOne({ SectionCode: SectionCode });
            if (sectionData) {
                sectionName = sectionData.SectionName || '';
            }
        }

        // Decide final registration number:
        // - Prefer value passed from UI (requestedRegistrationNumber)
        // - Ignore temporary admission numbers (TMP-...)
        // - If nothing valid, auto-generate based on class & section
        let registrationNumber = requestedRegistrationNumber || admission.Registration_Number;
        if (registrationNumber && registrationNumber.startsWith('TMP-')) {
            registrationNumber = null;
        }
        if (!registrationNumber) {
            // Generate registration number using similar logic
            const year = new Date().getFullYear().toString().slice(-2);
            const classIdentifier = Class_Code || className;
            let classNameCode = 'XX';
            
            if (classIdentifier) {
                let extractedClassName = '';
                if (classIdentifier.includes('-') && classIdentifier.split('-').length >= 3) {
                    const parts = classIdentifier.split('-');
                    extractedClassName = parts[parts.length - 2];
                } else if (classIdentifier.includes('_')) {
                    const parts = classIdentifier.split('_');
                    const classPart = parts.length > 1 ? parts[parts.length - 1] : classIdentifier;
                    extractedClassName = classPart.split(/\s+/)[0];
                } else {
                    extractedClassName = classIdentifier.split(/\s+/)[0];
                }
                
                if (extractedClassName) {
                    classNameCode = extractedClassName.replace(/\s+/g, '').toLowerCase();
                }
            }
            
            // Add section if provided
            if (sectionName && sectionName.trim()) {
                let sectionCode = sectionName.trim().toUpperCase();
                if (sectionCode.includes('-')) {
                    sectionCode = sectionCode.split('-').pop() || sectionCode;
                }
                if (sectionCode.includes(' ')) {
                    sectionCode = sectionCode.split(' ').pop() || sectionCode;
                }
                sectionCode = sectionCode.replace(/^(SECTION|Section|SEC|Sec)\s*/i, '');
                sectionCode = sectionCode.match(/^[A-Z0-9]+/)?.[0] || sectionCode.charAt(0) || '';
                if (sectionCode) {
                    classNameCode = `${classNameCode}${sectionCode}`;
                }
            }
            
            // Find last registration number
            const escapedClassNameCode = classNameCode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regexPattern = `^${year}${escapedClassNameCode}\\d{3}$`;
            const lastStudent = await studentModel.findOne({
                Registration_Number: { $regex: regexPattern },
                InstutionCode: admission.InstutionCode
            }).sort({ Registration_Number: -1 });
            
            let sequence = 1;
            if (lastStudent && lastStudent.Registration_Number) {
                const lastSeq = parseInt(lastStudent.Registration_Number.slice(-3));
                sequence = lastSeq + 1;
            }
            
            registrationNumber = `${year}${classNameCode}${String(sequence).padStart(3, '0')}`;
        }

        // Check if registration number already exists
        const existingStudent = await studentModel.findOne({ Registration_Number: registrationNumber });
        if (existingStudent) {
            return res.status(400).json({
                success: false,
                code: 400,
                message: 'Registration number already exists. Please use a different one.'
            });
        }

        // Prepare student data
        const studentData = {
            First_Name: First_Name,
            Last_Name: Last_Name,
            Email: Email || `${First_Name.toLowerCase()}.${registrationNumber}@school.com`,
            Contact_Number: admission.Phone_Number,
            Registration_Number: registrationNumber,
            Class: className,
            Class_Code: Class_Code || null,
            Section: sectionName,
            SectionCode: SectionCode || null,
            DOB: DOB || (admission.Date_Of_Birth ? new Date(admission.Date_Of_Birth) : null),
            Gender: Gender || admission.Gender || 'Male',
            Adhar: Aadhar || admission.Aadhar_Number || '',
            State: State || admission.State || '',
            District: District || admission.District || '',
            Father_Name: admission.Father_Name || '',
            Mother_Name: Mother_Name || admission.Mother_Name || '',
            Address: admission.Address || '',
            OutstandingAmount: '0',
            Status: true,
            InstutionCode: admission.InstutionCode
        };

        // Generate password
        const plainPassword = `${First_Name}@${registrationNumber}`;
        studentData.Password = await bcrypt.hash(plainPassword, 10);

        // Create student
        const student = await studentModel.create(studentData);

        // Resolve academic year from header or current
        const instutionCode = admission.InstutionCode
        const selectedAcademicYearId = req.headers['x-academic-year-id']
        let academicYearDoc = null

        if (selectedAcademicYearId) {
            academicYearDoc = await AcademicYear.findOne({
                _id: selectedAcademicYearId,
                InstutionCode: instutionCode,
                Status: true,
            }).lean()
        }

        if (!academicYearDoc) {
            academicYearDoc = await AcademicYear.findOne({
                InstutionCode: instutionCode,
                Is_Current: true,
                Status: true,
            }).lean()
        }

        // Create per-academic-year enrollment record for this new student
        if (academicYearDoc && Class_Code) {
            const enrollmentPayload = {
                InstutionCode: instutionCode,
                StudentId: student.Registration_Number,
                StudentMongoId: student._id.toString(),
                AcademicYearId: academicYearDoc._id.toString(),
                AcademicYearName: academicYearDoc.Year_Name || '',
                ClassCode: Class_Code,
                ClassName: className,
                SectionCode: SectionCode || '',
                SectionName: sectionName || '',
                Status: 'Active',
            }

            await StudentEnrollment.create(enrollmentPayload)
        }

        // Create user account
        try {
            const userData = {
                FirstName: student.First_Name,
                LastName: student.Last_Name,
                Email: student.Email,
                Phone: student.Contact_Number,
                UserName: student.Registration_Number,
                Password: student.Password,
                UserType: 'Student',
                MemberId: student.Registration_Number,
                InstutionCode: student.InstutionCode,
                InstutionName: req.user?.InstutionName || '',
                Verified: true
            };

            await userModel.create(userData);
        } catch (userError) {
            console.warn('User creation failed for student:', userError);
            // Continue even if user creation fails
        }

        // Update admission record
        admission.IsConvertedToStudent = true;
        admission.ConvertedStudentId = student._id.toString();
        admission.ConvertedAt = new Date();
        admission.Status = 'Admitted';
        await admission.save();

        // Clear caches so new student appears immediately in listings
        try {
            cache.clear()
        } catch (cacheError) {
            console.warn('Failed to clear cache after converting to student:', cacheError?.message)
        }

        res.status(200).json({
            success: true,
            code: 200,
            message: 'Admission successfully converted to student',
            data: {
                studentId: student._id,
                registrationNumber: student.Registration_Number,
                admissionId: admission._id
            }
        });

    } catch (error) {
        console.error('Error converting admission to student:', error);
        res.status(500).json({
            success: false,
            code: 500,
            message: 'An error occurred while converting admission to student',
            error: error.message
        });
    }
}

module.exports = {
    index,
    show,
    store,
    update,
    destroy,
    getRequiredDocuments,
    getAllRequiredDocuments,
    upsertRequiredDocuments,
    getDocumentCatalog,
    addDocumentCatalogName,
    removeDocumentCatalogName,
    uploadAdmissionDocument,
    getAdmissionDocumentViewUrl,
    convertToStudent,
    verifyDocuments,
    approveAdmission,
}
