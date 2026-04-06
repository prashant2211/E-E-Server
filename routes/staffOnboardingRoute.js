const express = require('express');
const router = express.Router();
const staffOnboardingController = require('../controller/staffOnboardingController');
const authenticate = require('../middleware/authenticate');

// Get available user types
router.get('/user-types', authenticate, staffOnboardingController.getAvailableUserTypes);

// Staff onboarding routes
router.post('/onboard', authenticate, staffOnboardingController.onboardStaff);
router.get('/staff', authenticate, staffOnboardingController.getAllStaff);
router.patch('/staff/:id', authenticate, staffOnboardingController.updateStaff);
router.delete('/staff/:id', authenticate, staffOnboardingController.deleteStaff);

module.exports = router;

