const express = require('express');
const router = express.Router();
const multer = require('multer');
const authenticate = require('../middleware/authenticate');
const systemConfigController = require('../controller/systemConfigController');

const storage = multer.memoryStorage();
const upload = multer({ storage });

// Academic Year Management
router.get('/get-all-academic-years', authenticate, systemConfigController.getAllAcademicYears);
router.get('/get-current-academic-year', authenticate, systemConfigController.getCurrentAcademicYear);
router.post('/create-academic-year', authenticate, systemConfigController.createAcademicYear);
router.patch('/update-academic-year', authenticate, systemConfigController.updateAcademicYear);

// System Settings
router.get('/get-settings', authenticate, systemConfigController.getSystemSettings);
router.patch('/update-settings', authenticate, systemConfigController.updateSystemSettings);

// Institution Document Uploads
router.post(
  '/upload-document',
  authenticate,
  upload.single('document'),
  systemConfigController.uploadInstitutionDocument
);

router.post(
  '/delete-document',
  authenticate,
  systemConfigController.deleteInstitutionDocument
);

module.exports = router;

