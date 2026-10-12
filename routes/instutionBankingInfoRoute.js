const express       = require('express')
const router        = express.Router()

const instutionBankInfoController = require('../controller/instutionBankInfoController');
const authenticate       = require('../middleware/authenticate');

router.get('/', authenticate, instutionBankInfoController.index) // give rec based on filter
router.get('/show', authenticate, instutionBankInfoController.show) // give rec based on Id
router.get('/get-All-BankingInfo', authenticate, instutionBankInfoController.getAllBankDetails)    // give all rec
router.post('/store', authenticate, instutionBankInfoController.store) // create rec
router.put('/update', authenticate, instutionBankInfoController.update) // update rec
router.delete('/delete', authenticate, instutionBankInfoController.destroy) 
router.put('/modify-status', authenticate, instutionBankInfoController.remove) 


module.exports = router