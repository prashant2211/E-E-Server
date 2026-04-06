const express       = require('express')
const router        = express.Router()

const supportTicket = require('../controller/supportTicket')
const authenticate       = require('../middleware/authenticate')

//router.get('/get-all-admission-info', authenticate, supportTicket.index)
//router.get('/get-admission-info-byId', authenticate, supportTicket.show)
router.post('/raiseTicket', authenticate, supportTicket.store)

module.exports = router