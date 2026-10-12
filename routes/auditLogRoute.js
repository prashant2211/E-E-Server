const express = require('express')
const router = express.Router()
const authenticate = require('../middleware/authenticate')
const { requireSuperAdmin } = require('../middleware/authorize')
const { listAuditLogs } = require('../controller/auditLogController')

router.get('/', authenticate, requireSuperAdmin, listAuditLogs)

module.exports = router

