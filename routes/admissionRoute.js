const express       = require('express')
const router        = express.Router()
const multer = require('multer')

const adminissionController = require('../controller/admissionController')
const authenticate       = require('../middleware/authenticate')
const { requireDefaultAcademicYear } = require('../middleware/requireDefaultAcademicYear')
const upload = multer({ storage: multer.memoryStorage() })

router.get('/get-all-admission-info', authenticate, adminissionController.index)
router.get('/get-admission-info-byId', authenticate, adminissionController.show)
// Registration route - supports both authenticated (admin/staff) and unauthenticated (public) requests
router.post('/registration', adminissionController.store)
// Authenticated route for admin/staff to create admissions
router.post('/create', authenticate, adminissionController.store)
router.patch('/update-admission-info', authenticate, adminissionController.update)
router.get('/required-documents', authenticate, adminissionController.getRequiredDocuments)
router.get('/required-documents/all', authenticate, adminissionController.getAllRequiredDocuments)
router.post('/required-documents', authenticate, adminissionController.upsertRequiredDocuments)
router.get('/document-catalog', authenticate, adminissionController.getDocumentCatalog)
router.post('/document-catalog', authenticate, adminissionController.addDocumentCatalogName)
router.post('/document-catalog/remove', authenticate, adminissionController.removeDocumentCatalogName)
router.post('/upload-document', authenticate, upload.single('document'), adminissionController.uploadAdmissionDocument)
router.get('/document-view-url', authenticate, adminissionController.getAdmissionDocumentViewUrl)
router.post('/verify-documents', authenticate, adminissionController.verifyDocuments)
router.post('/approve-admission', authenticate, adminissionController.approveAdmission)
router.delete('/deleteadmission-info', authenticate, adminissionController.destroy)
router.post('/convert-to-student', authenticate, requireDefaultAcademicYear, adminissionController.convertToStudent)

module.exports = router