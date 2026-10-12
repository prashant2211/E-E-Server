const express = require('express')
const router = express.Router()

const SectionController = require('../controller/sectionController')
const authenticate = require('../middleware/authenticate')

// RESTful routes
router.get('/', authenticate, SectionController.index)
router.get('/:id', authenticate, SectionController.show)
router.post('/create', authenticate, SectionController.store)
router.patch('/update', authenticate, SectionController.update)
router.delete('/delete', authenticate, SectionController.destroy)

module.exports = router

