const { response } = require('express')
const admissionInquaryModel      = require('../models/admissionInquaryModel');
const nodemailer = require('nodemailer');
const { getPermissionSet } = require('./permissionAssinment');
const { resolveAcademicYearScope } = require('../utils/academicYearScope')

const util = require('util');

// const Student = require('../models/studentModel');


const index = async (req, res, next) => {
  try {
    const permissionsResult = await getPermissionSet(req);
    const allowedRoles = ['Admin', 'Admission Staff', 'Reception Staff', 'SuperAdmin'];

    // Check permissions - Allow Admin, Admission Staff, Reception Staff, and SuperAdmin
    if (!allowedRoles.includes(req.user?.UserType) && 
        !permissionsResult.admissionInquary?.split("-").includes('R')) {
      return res.status(403).json({
        code: 403,
        success: false,
        message: 'You do not have the necessary permissions to access this resource. Only Admin, Admission Staff, and Reception Staff can access inquiries.'
      });
    }

    // Pagination
    const page = parseInt(req.query.PageNumber) || 1;
    const limit = parseInt(req.query.PageSize) || 10;
    const skip = (page - 1) * limit;
    const searchText = req.query.SearchText?.trim() || '';

    // Build search condition
    let searchCondition = {
      InstutionId: req.user.InstutionCode
    };

    // Academic year range filter for Date field (Date is stored as Date in schema)
    const scope = await resolveAcademicYearScope(req)
    if (scope?.from && scope?.to) {
      searchCondition.Date = { $gte: scope.from, $lte: scope.to }
    }

    if (searchText) {
      searchCondition.$or = [
        { Phone_Number: { $regex: searchText, $options: 'i' } },
        { Class_Name: { $regex: searchText, $options: 'i' } },
        { First_Name: { $regex: searchText, $options: 'i' } },
        { State: { $regex: searchText, $options: 'i' } },
        { District: { $regex: searchText, $options: 'i' } },
        { Gender: { $regex: searchText, $options: 'i' } },
        { Date: { $regex: searchText, $options: 'i' } },
        { InstutionCode: { $regex: searchText, $options: 'i' } }  // Corrected field added in $or
      ];
    }

    // Fetch data
    const [admissionInquary, totalCount] = await Promise.all([
      admissionInquaryModel.find(searchCondition).skip(skip).limit(limit),
      admissionInquaryModel.countDocuments(searchCondition)
    ]);


    return res.status(200).json({
      success: true,
      message: "Data retrieved successfully",
      code: 200,
      totalRecords: totalCount,
      data: admissionInquary
    });

  } catch (error) {
    console.error('Error in Admission Inquiry:', error);
    return res.status(500).json({
      success: false,
      message: 'An internal server error occurred!',
      code: 500,
      error: error.message
    });
  }
};


const store = async (req, res, next) => {
  try {
    // Check permissions for authenticated users (Reception Staff, Admin, Admission Staff)
    if (req.user) {
      const permissionsResult = await getPermissionSet(req);
      const allowedRoles = ['Admin', 'Admission Staff', 'Reception Staff', 'SuperAdmin'];
      
      if (!allowedRoles.includes(req.user?.UserType) && 
          !permissionsResult.admissionInquary?.split("-").includes('W')) {
        return res.status(403).json({
          code: 403,
          success: false,
          message: 'You do not have permission to create inquiries. Only Admin, Admission Staff, and Reception Staff can access this.'
        });
      }
    }

    // Get the current date and time
    const currentDate = new Date();
    const date = currentDate.toLocaleDateString();  

    let admissionInquaries = new admissionInquaryModel({
        InstutionId: req.user?.InstutionCode || req.body.InstutionId, 
        Phone_Number: req.body.PhoneNumber,
        Class_Name: req.body.ClassName, 
        First_Name: req.body.FirstName, 
        Last_Name: req.body.LastName, 
        Address: req.body.Address, 
        State: req.body.State, 
        District: req.body.District, 
        Father_Name: req.body.FatherName, 
        Other_Phone_Number: req.body.OtherPhoneNumber, 
        Gender: req.body.Gender, 
        Date: date
    })
    
    const saved = await admissionInquaries.save();
    
    // Send email if provided
    if (req.body.email) {
      try {
        emailVerification(
          req.body.FirstName + ' ' + req.body.LastName, 
          req.body.FatherName, 
          req.body.PhoneNumber, 
          req.body.ClassName, 
          req.body.email
        );
      } catch (emailError) {
        console.error('Email sending failed:', emailError);
        // Don't fail the request if email fails
      }
    }
    
    res.status(201).json({
        success: true,
        message: 'Inquiry submitted successfully!',
        code: 201,
        data: saved
    });
  } catch (error) {
    res.status(500).json({
        success: false,
        message: error.message,
        code: 500,
    });
  }
}

const getEnquiriesRec = async(req, res, next) => {
  let admissionRecord;
     admissionRecord = await admissionInquaryModel.find({
        InstutionCode: req.user.InstutionCode
    })
    
    .then(response =>{
        
        res.status(201).json({
            success: true,
            message: 'Inquary fetched Successfully!',
            code: 201,
            data: admissionRecord
        });
    })
    .catch(error => {
      console.log(error.message)
        res.status(500).json({
            success: false,
            message: error.message,
            code: 500,
        });
    })


}



const emailVerification = async (studentName, parentName, phoneNumber, className, email) => {
  
   
    const mailStructure = `<!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>New Admission Inquiry</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #f4f6f8; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td align="center" style="padding: 40px 0;">
            <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 10px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); overflow: hidden;">
              <tr>
                <td align="center" style="background-color: #004aad; padding: 20px;">
                  <h1 style="color: #ffffff; margin: 0; font-size: 26px;">New Admission Inquiry Received</h1>
                </td>
              </tr>
              <tr>
                <td style="padding: 30px;">
                  <p style="font-size: 16px; color: #333333; margin: 0 0 20px;">
                    Hello <strong>Admissions Team</strong>,
                  </p>
                  <p style="font-size: 16px; color: #333333; margin: 0 0 20px;">
                    A new admission inquiry has been submitted through the website. Here are the details:
                  </p>
    
                  <table width="100%" cellpadding="5" cellspacing="0" style="font-size: 16px; color: #333333;">
                    <tr>
                      <td style="width: 35%;"><strong>Student Name:</strong></td>
                      <td>${studentName}</td>
                    </tr>
                    <tr>
                      <td><strong>Parent/Guardian Name:</strong></td>
                      <td>${parentName}</td>
                    </tr>
                    <tr>
                      <td><strong>Contact Number:</strong></td>
                      <td>${phoneNumber}</td>
                    </tr>
                    <tr>
                      <td><strong>Class Applied For:</strong></td>
                      <td>${className}</td>
                    </tr>
                  </table>
    
                  <p style="font-size: 16px; color: #333333; margin: 30px 0 0;">
                    Please contact the parent/guardian at your earliest convenience.
                  </p>
    
                </td>
              </tr>
             
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
    `;

    // Assuming otpManager is synchronous or properly awaited
    // const otpSaved = otpManager(email, otp);
    // if (!otpSaved) {
    //     return false; // OTP couldn't be saved
    // }
    

    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.ORGANIZATION_EMAIL,
            pass: process.env.ORGANIZATION_PASSWORD,
        },
    });

    // Promisify sendMail
    const sendMail = util.promisify(transporter.sendMail).bind(transporter);

    try {
        const emailOptions = {
            from: process.env.ORGANIZATION_EMAIL,
            to: email,
            subject: 'Admission Enquary Received',
            html: mailStructure,
        };

        await sendMail(emailOptions); // Await email sending
        return true; // Success
    } catch (error) {
        console.error('Error sending email:', error);
        return false; // Failure
    }
};


module.exports = {
    store, getEnquiriesRec, emailVerification, index
}