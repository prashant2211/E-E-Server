const { response }          = require('express')
const staffSalaryModel      = require('../models/managementModel')

//Show the list of all member

const index = (req, res, next) => {
    staffSalaryModel.find()
    .then(response => {
        res.status(200).json({
            code: 200,
            success: true,
            data : response,
            message: 'Data fetched sucessfully!'
        })
    })
    .catch(error => {
        res.status(400).json({
            code: 400,
            success: true,
            message: 'Error occured!'
        })
    })
}

// Get single member Record

const show = (req, res, next) =>{
    let managementId = req.body.managementId
    staffSalaryModel.findById(managementId)
    .then(response => {
        res.status(200).json({
            code: 200,
            success: true,
            data: response,
            message: 'data fetched sucessfully!'
        })
    })
    .catch(error => {
        res.status(500).json({
            code: 500,
            success: true,
            message: 'Error Occured!'
        })
    })
}

// Add management Member to dataBase
const store = async(req, res, next) => {
let memberId = await generateId(); 
     
    let salaryDetails = new staffSalaryModel({
        M_Id : memberId,
        InstutionCode: req.user.InstutionCode,
        Name: req.body.Name,
        Phone: req.body.Phone,
        Address: req.body.Address,
        Qualification: req.body.Qualification,
        Destination:req.body.Destination,
        Email:req.body.Email,
        Joining_Date:req.body.Joining_Date,
        Age:req.body.Age ,
        Adhar:req.body.Adhar,
    })
    salaryDetails.save()
    .then(response =>{
        res.status(201).json({
            code: 401,
            success: true,
            message: 'salary Details details added sucessfully!'
        })
    })
    .catch(error => {
        res.status(401).json({
            code: 401,
            success: false,
            message: 'An error occured!'
        })
    })
}

// update management menber record  
const update = (req, res, next) =>{
    let managementId = req.body.managementId
    let updateData = {
        M_Id : req.body.M_Id,
        Name: req.body.Name,
        Phone: req.body.Phone,
        Address: req.body.Address,
        Qualification: req.body.Qualification,
        Destination:req.body.Destination,
        Email:req.body.Email,
        Password:req.body.Password,
        Joining_Date:req.body.Joining_Date,
        Age:req.body.Age ,
        Adhar:req.body.Adhar,
        Salary:req.body.Salary  
    }
    staffSalaryModel.findByIdAndUpdate(managementId, {$set: updateData})
    .then(response =>{
        res.status(200).json({
            code: 200,
            success: true,
            message: 'details updated sucessfully!'
        })
       
    })
    .catch(error => {
        res.status(500).json({
            code: 500,
            success: false,
            message: 'Error occured!'
        })
    })
}

// delete management deteils  

const destroy = (req, res, next) =>{
    let managementId = req.body.managementId
    staffSalaryModel.findByIdAndDelete(managementId)
    .then(response => {
        res.status(200).json({
            code: 200,
            success: true,
            message: 'Record deleted sucessfully!'
        })
    })
    .catch(error =>{
        res.status(500).json({
            code: 500,
            success: false,
            message: 'Error Occured!'
        })     
    })
}

const generateId = async () => {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const numeric = '0123456789';
    let randomId = '';
    //const charactersLength = characters.length;
    const numericLength = numeric.length;
    
    for (let i = 0; i < 4; i++) {
        randomId += `${numeric.charAt(Math.floor(Math.random() * numericLength))}`;
    }
    
     console.log('variable type : '+typeof randomId);
     return randomId;
};

module.exports = {
    index, show, store, update, destroy
}