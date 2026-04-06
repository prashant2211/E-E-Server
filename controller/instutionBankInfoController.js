const { response }         = require('express')
const { getPermissionSet } = require('./permissionAssinment');
const instutionBankInfoModel = require('../models/instutionBankInfo')
const mongoErrorMessages = require('./mongoErrors.json');

const hasPermission = (permissionsResult, key, flag) => {
    const raw = permissionsResult?.[key] || '';
    return String(raw).split('-').includes(flag);
};



//Show the list of class

const index = async (req, res, next) => {
    const permissionsResult = await getPermissionSet(req);

    if (hasPermission(permissionsResult, 'bankDetails', 'RA')) {
        try {
            const page = parseInt(req.query.PageNumber) || 1;
            const limit = parseInt(req.query.PageSize) || 10;
            const skip = (page - 1) * limit;
            
            // Build search condition to only get classes for the logged-in user's institution
           
        let searchCondition = {
            InstutionId: req.user.InstutionCode
        };
            
            // Fetch filtered classes and count in parallel with pagination
            const [classes, totalCount] = await Promise.all([
                instutionBankInfoModel.find(searchCondition).skip(skip).limit(limit),
                instutionBankInfoModel.countDocuments(searchCondition)
            ]);

            res.status(200).json({
                code: 200,
                success: true,
                message: "Data retrieved successfully",
                totalRecords: totalCount,
                data: classes
            });
        } catch (error) {
            const matchedKey = Object.keys(mongoErrorMessages).find(key => error.message.includes(key));
            const errorMessage = matchedKey ? mongoErrorMessages[matchedKey] : error.message;

            res.status(500).json({
                code: 500,
                success: false,
                message: errorMessage,
                error: errorMessage
            });
        }
    } else {
        res.status(403).json({
            code: 403,
            success: false,
            message: 'You do not have the necessary permissions to access this resource. Please contact your administrator.'
        });
    }
};

// Get single Class Record

const show = (req, res, next) =>{
    let bankInfoRecId = req.body.bankInfoRecId
    instutionBankInfoModel.findById(bankInfoRecId)
    .then(response => {
        res.status(200).json({  
            success: true,
            message: "Bank Information fetched Successfully",
            code: 200,
            data:response});
    })
    .catch(error => {
        const matchedKey = Object.keys(mongoErrorMessages).find(key => error.message.includes(key));
        const errorMessage = matchedKey ? mongoErrorMessages[matchedKey] : error.message;

        res.status(500).json({
            message: errorMessage
        })
    })
}

const getAllBankDetails = async (req, res, next) => {
    try {
        const bankInfoList = await instutionBankInfoModel.find({ InstutionId: { $in: req.user.InstutionCode } });
        
        return res.status(200).json({
            success: true,
            message: "Classes fetched successfully",
            code: 200,
            data: bankInfoList
        });
    } catch (error) {
        const matchedKey = Object.keys(mongoErrorMessages).find(key => error.message.includes(key));
        const errorMessage = matchedKey ? mongoErrorMessages[matchedKey] : error.message;
        return res.status(500).json({
            success: false,
            message: errorMessage,
            error: errorMessage
        });
    }
};




// Add Classes to dataBase
const store = async (req, res, next) => {
    const permissionsResult = await getPermissionSet(req);
    if (hasPermission(permissionsResult, 'bankDetails', 'W')) {
    //const  classCode = `${req.user.InstutionCode}_${req.body.Class_Name}`;

    let bankInfoRec = new instutionBankInfoModel({
        InstutionId: req.user.InstutionCode,
        bankName: req.body.bankName,
        accountHolderName: req.body.accountHolderName,
        accountNumber: req.body.accountNumber,
        IFSCCode:req.body.IFSCCode,
        branchName:req.body.branchName,
        accountType:req.body.accountType,
        upiId: req.body.upiId,
        upiNumber: req.body.upiNumber,
        status: true  
    })
    bankInfoRec.save()
    .then(response =>{
        res.status(201).json({
            success: true,
            code: 201,
            message: 'Bank Info Added Sucessfully!'
        })
    })
    .catch(error => {
        const matchedKey = Object.keys(mongoErrorMessages).find(key => error.message.includes(key));
        const errorMessage = matchedKey ? mongoErrorMessages[matchedKey] : error.message;

        res.status(500).json({
            success: false,
            code: 500,
            message: errorMessage,
            error: errorMessage
        })
    })} else{
        res.status(403).json({
            code: 403,
            success: true,
            message: 'You do not have the necessary permissions to access this resource. Please contact your administrator'
        })
    }
}

const remove = async (req, res, next) => {
    const permissionsResult = await getPermissionSet(req);
    if (hasPermission(permissionsResult, 'bankDetails', 'D')) {

    let bankInfoRecId = req.body.bankInfoRecId;
    let removeData = {
        status: req.body.status
    };
    instutionBankInfoModel.findByIdAndUpdate(bankInfoRecId, { $set: removeData })
        .then(response => {
            res.status(200).json({
                success: true,
                message: req.body.status ? 'Bank Details Activeted Successfully!':'Bank Details InActiveted Successfully!',
                code: 200
            });``
        })
        .catch(error => {
            const matchedKey = Object.keys(mongoErrorMessages).find(key => error.message.includes(key));
        const errorMessage = matchedKey ? mongoErrorMessages[matchedKey] : error.message;
            res.status(500).json({
                message: errorMessage,
                code: 500,
                success: false,
                error: errorMessage
            });
        });
    }else{
        res.status(403).json({
            code: 403,
            success: true,
            message: 'You do not have the necessary permissions to access this resource. Please contact your administrator'
        })
    }
};


// update Class record
const update = async (req, res, next) =>{
    const permissionsResult = await getPermissionSet(req);
    if (hasPermission(permissionsResult, 'bankDetails', 'E')) {

   
    let bankInfoRecId = req.body.bankInfoRecId
 

    let updateData = {
        bankName: req.body.bankName,
        accountHolderName: req.body.accountHolderName,
        accountNumber: req.body.accountNumber,
        IFSCCode:req.body.IFSCCode,
        branchName:req.body.branchName,
        accountType:req.body.accountType,
        upiId: req.body.upiId,
        upiNumber: req.body.upiNumber,
    }
    instutionBankInfoModel.findByIdAndUpdate(bankInfoRecId, {$set: updateData})
    .then(response =>{
        res.status(201).json({
            success: true,
            code: 201,
            message: 'Bank Info Updated sucessfully!'
        })
    })
    .catch(error => {
        const matchedKey = Object.keys(mongoErrorMessages).find(key => error.message.includes(key));
        const errorMessage = matchedKey ? mongoErrorMessages[matchedKey] : error.message;
        res.status(500).json({
            success: true,
            code: 500,
            message: errorMessage,
            error: errorMessage
        })
    }) }else{
        res.status(403).json({
            code: 403,
            success: true,
            message: 'You do not have the necessary permissions to access this resource. Please contact your administrator'
        })
    }
}

// delete an Class  => Only super admin can access this feature

const destroy = async (req, res, next) =>{
    const permissionsResult = await getPermissionSet(req);
    if (hasPermission(permissionsResult, 'bankDetails', 'D')) {
     let bankInfoRecId = req.query.bankInfoRecId; //req.body.bankInfoRecId
    instutionBankInfoModel.findByIdAndDelete(bankInfoRecId)
    .then(response => {
        res.status(200).json({
            message : 'Bank Info Deleted Sucessfully',
            code: 200,
            success: true
        })
    })
    .catch(error =>{
        const matchedKey = Object.keys(mongoErrorMessages).find(key => error.message.includes(key));
        const errorMessage = matchedKey ? mongoErrorMessages[matchedKey] : error.message;
        res.status(500).json({
            message: errorMessage
        })       
    })}else{
        res.status(403).json({
            code: 403,
            success: true,
            message: 'You do not have the necessary permissions to access this resource. Please contact your administrator'
        })
    }
}

module.exports = {
    index, show, store, update, destroy,getAllBankDetails, remove
}