const express = require('express');
const router = express.Router();
const schoolOnboardingController = require('../controller/schoolOnboardingController');
const authenticate = require('../middleware/authenticate');
const { requireSuperAdmin } = require('../middleware/authorize');

/**
 * @route   POST /api/onboard/school
 * @desc    Onboard a new school/institution with admin user
 * @access  SuperAdmin Only (Secure)
 */
router.post('/school', authenticate, requireSuperAdmin, schoolOnboardingController.onboardSchool);

/**
 * @route   GET /api/onboard/info
 * @desc    Get onboarding system information
 * @access  SuperAdmin Only
 */
router.get('/info', authenticate, requireSuperAdmin, schoolOnboardingController.getOnboardingInfo);

/**
 * @route   GET /api/onboard/public-info
 * @desc    Get public onboarding statistics (no sensitive data)
 * @access  Public
 */
router.get('/public-info', schoolOnboardingController.getPublicInfo);

/**
 * @route   GET /api/onboard/institutions
 * @desc    Get public list of institutions (basic info only)
 * @access  Public
 */
router.get('/institutions', schoolOnboardingController.listInstitutionsPublic);
router.patch(
  '/institutions/status',
  authenticate,
  requireSuperAdmin,
  schoolOnboardingController.updateInstitutionStatus
);

module.exports = router;

