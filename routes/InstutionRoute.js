
const express       = require('express')
const router        = express.Router()

const instutionController = require('../controller/InstutionRegistrationController')
const authenticate       = require('../middleware/authenticate')


router.post('/get-all-instution', instutionController.index)
router.get('/get-byid-instution', instutionController.show)
router.post('/instution-Register', instutionController.store)
router.patch('/update-instution', instutionController.update)
router.patch('/deactivate-instution', authenticate, instutionController.remove)
router.delete('/delete-instution', authenticate, instutionController.destroy)

module.exports = router