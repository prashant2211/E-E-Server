const { response } = require('express')
const facultyChatModel      = require('../models/facultyChatModel')


const store = (req, res, next) => {
    console.log(`chat -=-`)

    let announcement = new holidaysModel({
        InstutionId: req.user.InstutionCode,
        Holidays : req.body.Holidays
    })
    announcement.save()
    .then(response =>{
        res.status(201).json({
            success: true,
            message: 'Announcement Submited Successfully!',
            code: 201,
        });
    })
    .catch(error => {
        res.status(500).json({
            success: false,
            message: error.message,
            code: 500,
        });
    })


}

 const show = async (req, res, next) => {

    try{
        const holidaysRecord = await holidaysModel.find({ InstutionId: req.user.InstutionCode });

        res.status(200).json({
            success: true,
            message: 'Holidays Fetch Successfully!',   
            code: 200,
            data: holidaysRecord,
        });
    

    } catch(error){

        res.status(500).json({
            success: false,
            message: error.message,
            code: 500,
        });

    }

    


 }



module.exports = {
    store, show
}