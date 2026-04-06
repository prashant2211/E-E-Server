
const express       = require('express')
const router        = express.Router()

const instutionController = require('../controller/knowladgeCenter')
// const authenticate       = require('../middleware/authenticate')


router.post('/knowladgeCenter', instutionController.knowladgeCenter)


module.exports = router