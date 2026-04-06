const express       =   require('express')
const router        =   express.Router()


const AuthController    = require('../controller/AuthContrroller')
const authenticate       = require('../middleware/authenticate');

router.post('/user-register', authenticate, AuthController.register)
// router.post('/user-verification', authenticate, AuthController.userOtpVerification)
router.post('/login', AuthController.login)  //refresh-token   verifyOtp  
router.post('/refresh-token',authenticate, AuthController.refreshToken)
router.post('/forgot-password', AuthController.forgotPassword)
router.post('/otp-verification', AuthController.verifyOtp)
router.post('/superAdmin-otp-verification', AuthController.superadminotpVerification)
router.post('/update-password', AuthController.updatePasword)


module.exports = router