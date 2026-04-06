const { response } = require('express')
const scheduleClassModel      = require('../models/scheduleClassModel')
const { getPermissionSet } = require('./permissionAssinment');


const getAll = async (req, res, next) => {
    const permissionsResult = await getPermissionSet(req);
    if(permissionsResult.scheduleClass.split("-").includes('RA')){

      // Get the current date and time
      const currentDate = new Date();
      const date = currentDate.toLocaleDateString();  
  
      await scheduleClassModel.find({instutionId:req.user.InstutionCode, date:date})
            .then(response =>{
                res.status(201).json({
                    success: true,
                    code: 200,
                    data: response,
                    message: 'Scheduled class fetched sucessfully!'
                })
            })
            .catch(error => {
                res.status(500).json({
                    success: true,
                    code: 500,
                    message: 'An error occured!',
                    error: error
                })
})} else{
    res.status(401).json({
        code: 401,
        success: true,
        message: 'You do not have the necessary permissions to access this resource. Please contact your administrator'
    })
}
}

// add fee details to DB
const store = (req, res, next) => {
     // Get the current date and time
     const currentDate = new Date();
     const date = currentDate.toLocaleDateString();  
     const time = currentDate.toLocaleTimeString(); 

    let fmarksDetails = new scheduleClassModel({
            instutionId : req.user.InstutionCode,
            classes: req.body.class,
            subject: req.body.subject,
            period: req.body.period,
            date: date,
            time:time,
            teacherName:req.body.teacherName,
            teacherId:req.body.teacherId
    })
    fmarksDetails.save()
    .then(response =>{
        res.json({
            message: 'Class Scheduled sucessfully!'
        })
    })
    .catch(error => {
        res.json({
            message: 'An error occured!'
        })
    })
}


// delete fee details  => Not required as of now

const destroy = (req, res, next) =>{
    let scheduleClassId = req.body.scheduleClassId
    console.log(scheduleClassId);
    scheduleClassModel.findByIdAndDelete(scheduleClassId)
     .then(response =>{
        res.json({
            message: 'Class Scheduled sucessfully!'
        })
    })
    .catch(error => {
        res.json({
            message: 'An error occured!'
        })
    })
}

module.exports = {
     store, destroy, getAll
}