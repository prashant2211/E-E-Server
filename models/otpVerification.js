const mongoose      = require('mongoose')
const { type } = require('os')

const Schema        = mongoose.Schema

const otpVerification = new Schema({
    userId:{
        type: String
    },
    otp : {
        type: String
    },
    
},
{timestamps:true}
)

const otpVerify = mongoose.model('otpVerification',otpVerification)

module.exports = otpVerify; 