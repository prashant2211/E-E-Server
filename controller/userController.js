const instutionModel           = require('../models/InstutionModel')
const user                     = require('../models/User')
const mongoErrorMessages = require('./mongoErrors.json');
const bcrypt        = require('bcryptjs')


const givePermissionAccess = async (req, res, next) => {

    const instutionRecord = await instutionModel.findOne({
        Instution_Id: req.query.InstutionId
    });
    let status  = false;
    if (instutionRecord) {
        console.log(instutionRecord.Status); // Accessing the field
        status = instutionRecord.Status;
    }
    
  //  console.log(` Instutuoon -=- ${instutionRecord}`)
    try{
        if(req.query.InstutionId == undefined){
            res.status(503).json({
                success: false,
                code: 503,
                message: 'Access Blocked !!',
                data : []
            })
            return;
        } else if(status == true ){
            const access =  {
                Access:'Granted'
            }
        
            return res.status(200).json({
                success: true,
                code: 200,
                message: 'Permissions retrieved successfully.',
                data: access
            });
        } else if(req.query.InstutionId != insId){
            return res.status(503).json({
                success: true,
                code: 503,
                message: 'Permissions retrieved successfully.',
                data: []
            });
        }
       
    } catch(error){
        console.log(error)
        res.status(503).json({
            success: false,
            code: 503,
            message: 'Access Blocked !!',
            data : []
        })
    }
   
}


const resetUserPassword = async (req, res, next) => {
    const password = req.body.Password;
    
    const userRecord = await user.findById(req.body.Id);

    bcrypt.hash(password, 10, function(err, hashedPass) {
        if(err){
            res.json({
                error: err
            })
        }

    let updateData = {
        Password: hashedPass
    }

    


    user.findByIdAndUpdate(req.body.Id, { $set: updateData })
    .then(response => {
        res.status(200).json({
            success: true,
            message: 'Password updated sucessfully',
            code: 200,
            data: 'Password updated sucessfully'
        });
    })
    .catch(error => {
        const matchedKey = Object.keys(mongoErrorMessages).find(key => error.message.includes(key));
        const errorMessage = matchedKey ? mongoErrorMessages[matchedKey] : error.message;
        res.status(400).json({
            success: false,
            message: errorMessage,
            code: 400,
            error: errorMessage,
            data : []
        });
    });
})    

}


module.exports = {
    givePermissionAccess, resetUserPassword
}