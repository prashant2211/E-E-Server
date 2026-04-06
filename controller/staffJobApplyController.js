const { response }          = require('express')
const staffjobApplyFormModel      = require('../models/staffJobApplyModels')

//Show the list of staff applied form

const index = (req, res, next) => {
    staffjobApplyFormModel.find()
    .then(response => {
        res.json({
            response
        })
    })
    .catch(error => {
        res.json({
            message: 'An error occured!'
        })
    })
}

// Get single staff applied form

const show = (req, res, next) =>{
    let jobApplyFormId = req.body.jobApplyFormId
    staffjobApplyFormModel.findById(jobApplyFormId)
    .then(response => {
        res.json({
            response
        })
    })
    .catch(error => {
        res.json({
            message: 'An error occured!'
        })
    })
}

// Add staff applied form to dataBase
const store = (req, res, next) => {

    let salaryDetails = new staffjobApplyFormModel({
        Staff_Name : req.body.Staff_Name,
        Phone: req.body.Phone,
        Qualification: req.body.Qualification,
        Address: req.body.Address,
        Privious_Experience: req.body.Privious_Experience,
        Number_of_years_Experiance:req.body.Number_of_years_Experiance,
        Specilised_Subject:req.body.Specilised_Subject,
        Confortable_Subject:req.body.Confortable_Subject,
        Apply_Date:req.body.Apply_Date,
        School_Visit_Date:req.body.School_Visit_Date,
        Status:req.body.Status,
        Joining_Date:req.body.Joining_Date,
        Demo_Date:req.body.Demo_Date,
        DOB:req.body.DOB,
        Password:req.body.Password        
    })
    salaryDetails.save()
    .then(response =>{
        res.json({
            message: 'Form applied sucessfully!'
        })
    })
    .catch(error => {
        res.json({
            message: 'An error occured!'
        })
    })
}

// update staff form record  => not required now
const update = (req, res, next) =>{
    let jobApplyFormId = req.body.jobApplyFormId
    let updateData = {
        Staff_Name : req.body.Staff_Name,
        Phone: req.body.Phone,
        Qualification: req.body.Qualification,
        Address: req.body.Address,
        Privious_Experience: req.body.Privious_Experience,
        Number_of_years_Experiance:req.body.Number_of_years_Experiance,
        Specilised_Subject:req.body.Specilised_Subject,
        Confortable_Subject:req.body.Confortable_Subject,
        Apply_Date:req.body.Apply_Date,
        School_Visit_Date:req.body.School_Visit_Date,
        Status:req.body.Status,
        Joining_Date:req.body.Joining_Date,
        Demo_Date:req.body.Demo_Date,
        DOB:req.body.DOB,
        Password:req.body.Password     
    }
    staffjobApplyFormModel.findByIdAndUpdate(jobApplyFormId, {$set: updateData})
    .then(response =>{
        res.json({
            message: 'details updated sucessfully'
        })
    })
    .catch(error => {
        res.json({
            message: ' An error occured'
        })
    })
}

// delete salary deteils  

const destroy = (req, res, next) =>{
    let jobApplyFormId = req.body.jobApplyFormId
    staffjobApplyFormModel.findByIdAndDelete(jobApplyFormId)
    .then(response => {
        res.json({
            message : 'form details Deleted sucessfully'
        })
    })
    .catch(error =>{
        res.json({
            message: 'An error occured!'
        })       
    })
}

module.exports = {
    index, show, store, update, destroy
}