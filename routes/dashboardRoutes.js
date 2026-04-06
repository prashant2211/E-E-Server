const express       = require('express')
const router        = express.Router()

const dashboardController = require('../controller/dashboardController');
const authenticate       = require('../middleware/authenticate');

router.get('/', authenticate, dashboardController.getDashboardData)


module.exports = router