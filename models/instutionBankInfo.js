const mongoose      = require('mongoose')
const { type } = require('os')

const Schema        = mongoose.Schema

const bankStructureSchema = new Schema({

    InstutionId:{
        type: String,
        required: true,
    },
    bankName:{
        type: String,
        required: true
    },
    accountHolderName:{
        type: String,
        required: true,
    },
    accountNumber:{
        type: String,
         unique: true,
         required: true,
    },
    IFSCCode:{
        type: String,
        required: true,
    },
    branchName:{
        type: String,
        required: true,
    },
     status : {
        type: Boolean,
        required: true
    },
     accountType : {
        type: String,
        required: true
    },
     upiId : {
        type: String,
        required: true,
        unique: true,
    },
    // Optional UPI number / mobile number linked to UPI
    upiNumber: {
        type: String,
        required: false,
    }
   
},
{timestamps:true}
)

const bankInfoModel = mongoose.model('instutionBankInfo',bankStructureSchema)

module.exports = bankInfoModel; 