
const User          = require('../models/User')
const InstutionModel = require('../models/InstutionModel')
const otpVerification = require('../models/otpVerification');
const studentModel = require('../models/studentModel')
const bcrypt        = require('bcryptjs')
const jwt           = require('jsonwebtoken')
const { getPermissionSet } = require('./permissionAssinment');
const { getJwtAccessSecret, getJwtRefreshSecret } = require('../utils/jwtConfig');
const { createAuditLog } = require('../utils/auditLog');
require('dotenv').config();
const nodemailer = require('nodemailer');
// const bcrypt        = require('bcryptjs')

var tokenExpiry = '4h';
const mongoErrorMessages = {
    "MongoServerError: E11000 duplicate key error": "This record already exists. Please use a different value.",
    "CastError": "Invalid ID format. Please check the data and try again.",
    "ValidationError": "Some required fields are missing or invalid. Please review your input.",
    "MongoNetworkError": "Unable to connect to the database. Please check your internet connection or try again later.",
    "MongoTimeoutError": "The request timed out. Please try again.",
    "MongoParseError": "There was an error processing the request. Please contact support.",
    "MongoWriteConcernError": "There was an issue saving your data. Please try again.",
    "DocumentNotFoundError": "The requested item was not found.",
    "NotFound": "No records matched your search.",
    "BSONError": "There was an error processing the data format. Please check your input.",
    "BulkWriteError": "Some of the data could not be saved. Please try again.",
    "MissingSchemaError": "The data structure is invalid. Please contact support.",
    "DisconnectedError": "The database connection was lost. Please try again later.",
    "UnknownError": "Something went wrong. Please try again later."
  }
  

const register = async (req, res, next) => {
    const normalizeUserType = (t) =>
        String(t || '')
            .trim()
            .toLowerCase()
            .replace(/\s+/g, '');

    const isSuperAdminTarget = normalizeUserType(req.body.UserType) === 'superadmin';

    let instutionCode = req.body.InstutionCode;
    if (instutionCode === '') {
        instutionCode = req.user?.InstutionCode;
    }

    let instution = null;
    let institutionName = req.body.InstutionName;

    if (isSuperAdminTarget) {
        if (normalizeUserType(req.user?.UserType) !== 'superadmin') {
            return res.status(403).json({
                message: 'Only SuperAdmin can create SuperAdmin users',
                success: false,
                code: 403,
            });
        }
        instutionCode =
            (instutionCode && String(instutionCode).trim()) || 'SYSTEM';
        institutionName =
            (institutionName && String(institutionName).trim()) ||
            'Educational Eternity Platform';
    } else {
        if (!instutionCode || String(instutionCode).trim() === '') {
            return res.status(400).json({
                message: 'Please pass the Instution Code!',
                success: false,
                code: 400,
            });
        }
        instution = await InstutionModel.findOne({ Instution_Id: instutionCode });
        if (institutionName === '') {
            institutionName = instution?.Instution_Name;
        }
        if (!instution) {
            return res.status(500).json({
                message: 'Instution not found!',
                success: false,
                code: 500,
            });
        }
    }

    let memberId = req.body.MemberId;
    if (isSuperAdminTarget && (!memberId || String(memberId).trim() === '')) {
        const base = String(req.body.Email || req.body.UserName || 'user')
            .replace(/[^a-zA-Z0-9]/g, '')
            .slice(0, 32);
        memberId = `SA-${base || Date.now()}`;
    }
    if (!isSuperAdminTarget && (!memberId || String(memberId).trim() === '')) {
        return res.status(400).json({
            message: 'Please pass the Member Id!',
            success: false,
            code: 400,
        });
    }

    const permissionsResult = await getPermissionSet(req);
    if(permissionsResult && permissionsResult.users.split("-").includes('W')){
    bcrypt.hash(req.body.Password, 10, function(err, hashedPass) {
        if(err){
            res.json({
                error: err
            })
        }
        let user = new User ({
            FirstName : req.body.Firstname,
            LastName : req.body.LastName,
            Email : req.body.Email,
            InstutionName: institutionName,
            Phone : req.body.Phone,
            UserName : req.body.UserName,
            InstutionCode : instutionCode,
            MemberId: memberId,
            UserType: req.body.UserType,
            PermissionSet : isSuperAdminTarget
                ? (req.body.PermissionSet && String(req.body.PermissionSet).trim()) || 'all'
                : req.body.PermissionSet,
            Password : hashedPass
        })
       
        user.save()
        .then(user => {
           
            let fullName = `${req.body.Firstname} ${req.body.LastName}`
            emailVerification(req.body.Email, fullName, institutionName, req.body.UserName, req.body.Password) 
                res.json({
                success: true,
                message: "User Added Sucessfully",
                code: 201
               
            })
        })
        .catch(error => {
            const matchedKey = Object.keys(mongoErrorMessages).find(key => error.message.includes(key));
            let errorMsg = matchedKey ? mongoErrorMessages[matchedKey] : "An unexpected error occurred.";

            res.status(500).json({
                success: false,
                message : errorMsg,
                error: errorMsg,
                code: 500,
            })
        })
    })
}else{
    res.status(403).json({
        code: 403,
        success: true,
        message: 'You do not have the necessary permissions to access this resource. Please contact your administrator'
    })

}

   
}

const login = async (req, res, next) => {
    const username = req.body.username || req.body.email;
    const password = req.body.password;
    const userType = req.body.userType || req.body.UserType;
    const normalizeUserType = (value) =>
        String(value || '')
            .trim()
            .toLowerCase()
            .replace(/\s+/g, '');
    try {
        const user = await User.findOne({
            $or: [
                { Email: username },
                { Phone: username },
                { UserName: username }
            ],
        });

        if (!user) {
            return res.status(401).json({
                message: 'Invalid credentials',
                success: false,
                code: 401,
            });
        }
        if (
            user.UserType &&
            userType &&
            normalizeUserType(user.UserType) !== normalizeUserType(userType)
        ) {
            return res.status(401).json({
                message: `Invalid User Type! Expected: ${userType}, Found: ${user.UserType}`,
                success: false,
                code: 401,
                data: []
            });
        }

        const isPasswordMatch = await bcrypt.compare(password, user.Password);
        if (!isPasswordMatch) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials',
                code: 401,
            });
        }

        //   const studentRecord = await studentModel.find({
        //     Email: user.Email,
        //     InstutionCode: user.InstutionCode,
        //     Registration_Number: user.MemberId,
        // });

        // if(studentRecord[0].Status == false){
        //       return res.status(400).json({
        //         success: false,
        //         message: "Your account seems to be inactive. Kindly contact the admin to get it reactivated.",
        //         code: 400,
        //     });
        // }

        const userTokenJSON =  {
            FirstName: user.FirstName,
            LastName: user.LastName,
            Phone: user.Phone,
            UserName: user.UserName,
            InstutionCode: user.InstutionCode,
            InstutionName: user.InstutionName,
            UserType: user.UserType,
            PermissionSet: user.PermissionSet,
            Email: user.Email,
            MemberId: user.MemberId,
            MemberCode: user.MemberId,
            Avatar: user.Avatar || '',
            userId: user._id,
        }

        if (!user.Verified) {
            await User.findByIdAndUpdate(user._id, { $set: { Verified: true } });
        }
        const accessSecret = getJwtAccessSecret();
        const refreshSecret = getJwtRefreshSecret();
        const token = jwt.sign(userTokenJSON, accessSecret, { expiresIn: tokenExpiry });
        const refreshTokenJwt = jwt.sign(userTokenJSON, refreshSecret, { expiresIn: tokenExpiry });

         // Prepare user response
         const responseUser = {
            _id: user._id,
            FirstName: user.FirstName,
            LastName: user.LastName,
            email: user.Email,
            UserName: user.UserName,
            InstutionCode: user.InstutionCode,
            InstutionName: user.InstutionName,
            MemberId: user.MemberId,
            UserType: user.UserType,
            Phone: user.Phone,
            Avatar: user.Avatar || '',
            avatar: user.Avatar || '',
            token: token,
            refreshtoken: refreshTokenJwt,
        };
        res.json({
            success: true,
            message: 'Login Successful',
            data: responseUser,
            code: 200,
        });
        req.user = userTokenJSON;
        createAuditLog({
            req,
            eventType: 'LOGIN',
            feature: 'Authentication',
            meta: { login: true },
        }).catch(() => {});
    } catch (error) {
        console.error('Error during login:', error);
        res.status(500).json({
            success: false,
            message: process.env.NODE_ENV === 'production' ? 'Login failed' : error.message,
            code: 500,
        });
    }
};




const refreshToken = (req, res, next) =>{
    const incomingRefresh = req.body.refreshtoken;
    if (!incomingRefresh) {
        return res.status(400).json({ success: false, message: 'refreshtoken required' })
    }
    jwt.verify(incomingRefresh, getJwtRefreshSecret(), function(err, decode) {
        if(err){
            return res.status(401).json({
                success: false,
                message: 'Invalid or expired refresh token',
                code: 401,
            })
        }
            const payload = { ...decode };
            delete payload.iat;
            delete payload.exp;
            const token = jwt.sign(payload, getJwtAccessSecret(), {expiresIn: tokenExpiry})
            res.status(200).json({
                message : 'token refreshed successfully !',
                success: true,
                token,
                refreshToken: incomingRefresh
            })
    })
}
const superadminotpVerification = (req, res, next) => {
    var otp = req.body.otp;
    var email = req.body.email;
    otpVerification.findOne({otp:otp})
    .then(data => {
      
        if(data){

            otpVerification.findByIdAndDelete(data._id)
            .then(response => {
              
            })
            .catch(error => {
              
            })

            let user = {
                FirstName: 'Owner',
                LastName: 'User',
                Email: email,
                Phone: '9934001660',
                UserName: email,
                UserType: 'SuperAdmin',
                PermissionSet:''
              }
           let token = jwt.sign({FirstName: user.FirstName, PermissionSet: user.PermissionSet, Phone: user.Phone, UserName: user.UserName, UserType: user.UserType, Email: user.Email}, getJwtAccessSecret(), {expiresIn : '4h'})
            const responseUser = {
                UserType: 'SuperAdmin',
                FirstName: 'Owner',
                LastName: 'User',
                email: email,
                UserName: email,
                PermissionSet: '',
                token: token,
            }
            res.status(200).json({
                success: true,
                message: 'Login Successful',
                data:responseUser,
                code: 200,
                
            })
        }else{
            res.status(500).json({
                message : 'Incorrect OTP !',
                data: '',
                status: 'fail',
                success: false,
                
            })
        } });
}

// this method is used to verify the user for 1st time logged in
/*const userOtpVerification = async (req, res, next) => {
    const existingOtp = await otpVerification.findOne({ userId: req.user.Email })
    if(req.body.otp === existingOtp.otp){
        const user = await User.findOne({ Email: req.user.Email })
        if(!user){
            return res.status(500).json({
                message: 'No user found!',
                success: false,
                code: 500,
            });
        }
        await User.findByIdAndUpdate(user._id, { $set: { Verified: true } });

        const userTokenJSON =  {
            FirstName: user.FirstName,
            Phone: user.Phone,
            UserName: user.UserName,
            InstutionCode: user.InstutionCode,
            UserType: user.UserType,
            PermissionSet: user.PermissionSet,
            Email: user.Email,
            MemberId: user.MemberId,
            userId: user._id,
        }
        const token = jwt.sign(userTokenJSON,'MNPqrst2211MLrtq',{ expiresIn: tokenExpiry});
        const refreshToken = jwt.sign( userTokenJSON,'MNPqrst2211MLrtq', { expiresIn: tokenExpiry } );

             // Prepare user response
           const responseUser = {
            _id: user._id,
            FirstName: user.FirstName,
            LastName: user.LastName,
            email: user.Email,
            UserName: user.UserName,
            InstutionCode: user.InstutionCode,
            token: token,
            refreshtoken: refreshToken,
        };
        res.status(200).json({
            success: true,
            message: 'OTP verified !',
            data: responseUser,
            code: 200,
        });

    }else{
        res.status(500).json({
            message : 'Incorrect OTP !',
            data: '',
            status: 'fail',
            success: false,
            
        }) 
    }
}*/


const verifyOtp = (req, res, next) => {
    var otp = req.body.otp;
    otpVerification.findOne({otp:otp})
    .then(data => {
        if(data){
            let token = jwt.sign({userId:data.userId}, getJwtAccessSecret(), {expiresIn : '10m'})
          //  let refreshtoken = jwt.sign({FirstName: user.FirstName, Phone: user.Phone, UserName: user.UserName, InstutionCode: user.InstutionCode, UserType: user.UserType, PermissionSet: user.PermissionSet, Email: user.Email, MemberId: user.MemberId, userId: user._id}, 'MNPqrst2211MLrtq', {expiresIn : '15m'})
            const response = {
                email: data.userId,
                token: token
            }
        res.status(200).json({
            success: true,
            message: 'OTP Verified!',
            data:token,
            code: 200,
        })
    }else{
        res.status(500).json({
            success: false,
            message: 'Incorrect OTP!',
            data:'',
            code: 500,
        })
    }
    }
    ) .catch(error => {
        res.status(400).json({
            success: false,
            message: error,
            data:error,
            code: 500,
        })
    })

}


const forgotPassword = (req, res, next) => {
    var username = req.body.username
   
    User.findOne({$or: [{Email:username},{UserName:username}]})
    .then(user => {
       
        if(user){
            if(!user.Verified){
                res.json({
                    message: 'Please verify the user !',
                    success: false,
                    code: 500,
                })
            }else{
            sendEmail(user.Email);
            let token = jwt.sign({FirstName: user.FirstName, Phone: user.Phone, UserName: user.UserName, InstutionCode: user.InstutionCode, UserType: user.UserType, PermissionSet: user.PermissionSet, Email: user.Email, MemberId: user.MemberId, MemberCode: user.MemberId, userId: user._id }, getJwtAccessSecret(), {expiresIn : '15m'})
            let refreshtoken = jwt.sign({FirstName: user.FirstName, Phone: user.Phone, UserName: user.UserName, InstutionCode: user.InstutionCode, UserType: user.UserType, PermissionSet: user.PermissionSet, Email: user.Email, MemberId: user.MemberId, MemberCode: user.MemberId, userId: user._id}, getJwtRefreshSecret(), {expiresIn : '15m'})
            const responseUser = {
                _id: user._id,
                FirstName: user.FirstName,
                LastName: user.LastName,
                email: user.Email,
                UserName: user.UserName,
                token: token,
                refreshtoken: refreshtoken,
            }
            res.json({
                success: true,
                message: 'OTP send to registered mail Id',
                data:responseUser,
                code: 200,
            })
        }

        }else{
            res.json({
                message: 'no user found !',
                success: false,
                code: 500,
            })
        }
            })
       
    
}


const updatePasword = async (req, res, next) => {
    let password = req.body.password;
    let emailId = req.body.email;
    //////////////////////////////////
   // const userRecord = await user.findById(req.body.Id);
   const userData = await User.findOne({ Email: emailId });
   if (userData) {
    bcrypt.hash(password, 10, function(err, hashedPass) {
        if(err){
            res.json({
                error: err
            })
        }
    let updateData = {
        Password: hashedPass
    }

   // user.findByIdAndUpdate(req.body.Id, { $set: updateData })
 
   // User.findByIdAndUpdate(userData._id, { $set: { $set: updateData } })
    User.findByIdAndUpdate(userData._id, { $set: updateData })
    .then(user => {
        res.status(200).json({
            success: true,
            message: 'Password Updated Sucessfully!',
            data:'',
            code: 200,
        })
    })  .catch(error => {
        res.status(500).json({
            success: false,
            message : 'Password Updataion Failed !',
            data: error,
            code: 500,
        })
    })

   });

    ///////////////////////////////////
  

     
            
        } 

}

const sendEmail = async (email) => {
    console.log(`email -=-=- ${email}`);
   let otp =  Math.floor(100000 + Math.random() * 900000);

   ////// mail body formater //////////////////////////

   const mailStructure = `
   <html>
   <head>
       <style>
           body {
               font-family: Arial, sans-serif;
               background-color: #f4f4f4;
               margin: 0;
               padding: 0;
           }
           .email-container {
               width: 100%;
               max-width: 600px;
               margin: 20px auto;
               background-color: #ffffff;
               padding: 20px;
               border-radius: 8px;
               box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
           }
           h1 {
               color: #333333;
               font-size: 24px;
               text-align: center;
           }
           p {
               font-size: 16px;
               color: #555555;
               line-height: 1.5;
           }
           .otp {
               font-size: 24px;
               font-weight: bold;
               color: #007bff;
               display: inline-block;
               padding: 10px;
               background-color: #f1f1f1;
               border-radius: 4px;
               margin-top: 10px;
           }
           .cta-button {
               display: inline-block;
               background-color: #007bff;
               color: white;
               padding: 12px 20px;
               text-decoration: none;
               font-size: 16px;
               border-radius: 5px;
               text-align: center;
               margin-top: 20px;
           }
           .footer {
               text-align: center;
               font-size: 14px;
               color: #888888;
               margin-top: 30px;
           }
       </style>
   </head>
   <body>
       <div class="email-container">
           <h1>Password Reset Request</h1>
           <p>Hi there,</p>
           <p>We heard that you lost your password. Sorry about that!</p>
           <p><strong>But don’t worry!</strong> You can use the <strong style="color: #007bff;">One-Time Password</strong> to reset your password.</p>
           <p>Your One-Time Password (OTP) is:</p>
           <p class="otp">${otp}</p>
           <p>Use this OTP to reset your password within the next 15 minutes.</p>
           <div class="footer">
               <p>If you did not request a password reset, please contact your organization.</p>
               <p>&copy; ${new Date().getFullYear()} ${process.env.ORGANIZATION_NAME}. All rights reserved.</p>
           </div>
       </div>
   </body>
   </html>
`;

   /////////////////////////////////////////////////////

if(otpManager(email,otp)){
    const transporter = nodemailer.createTransport({
        service : 'gmail',
        auth : {
            user : process.env.ORGANIZATION_EMAIL,
            pass : process.env.ORGANIZATION_PASSWORD
        }
    });
    const emailOptions = {
        from: process.env.ORGANIZATION_EMAIL,
        to: email,
        subject: 'Password Reset Verification',
        html: mailStructure
    }
    transporter.sendMail(emailOptions, (error, info) => {
        if(error){
            return ; 
        }
    });
} else{
    console.log(` ERROR !`);
}

}

const otpManager = async (usercred, verificationCode) => {
   
    try {
        // Create a new OTP instance
        const otpverify = {
            userId: usercred,
            otp: verificationCode,
        };

        const existingOtp = await otpVerification.findOne({ userId: usercred });
       
        if (existingOtp) {
            await otpVerification.findByIdAndUpdate(existingOtp._id, { $set: { otp: verificationCode } });
        } else {
            const newOtp = new otpVerification(otpverify);
            const otpInfo = await newOtp.save();
        }

        return true; 
    } catch (error) {
        return false; 
    }
};

// // user email verification for sending email
// const nodemailer = require('nodemailer');
const util = require('util');

const emailVerification = async (email, fullName, institutionName, userName, password) => {
    // const otp = Math.floor(100000 + Math.random() * 900000);
    // Email verification template
    let url = 'www.educationaleternity.com';
    const mailStructure = `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>User Credentials</title>
        <style>
            body {
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                margin: 0;
                padding: 0;
                background-color: #f9f9f9;
                color: #333;
            }
            .container {
                max-width: 600px;
                margin: 50px auto;
                background-color: #ffffff;
                border-radius: 10px;
                box-shadow: 0 6px 12px rgba(0, 0, 0, 0.1);
                overflow: hidden;
            }
            .header {
                background-color: #007BFF;
                color: #ffffff;
                text-align: center;
                padding: 25px 10px;
            }
            .header h1 {
                font-size: 28px;
                margin: 0;
                font-weight: bold;
                letter-spacing: 1px;
            }
            .content {
                padding: 30px;
            }
            .content p {
                font-size: 16px;
                margin: 15px 0;
                color: #555;
                line-height: 1.6;
            }
            .credentials {
                margin: 20px 0;
                padding: 15px;
                background-color: #f4f8fc;
                border-radius: 8px;
                font-size: 16px;
                color: #333;
                border: 1px solid #ddd;
            }
            .credentials p {
                margin: 5px 0;
            }
            .footer {
                background-color: #f4f8fc;
                text-align: center;
                padding: 15px;
                font-size: 14px;
                color: #777;
            }
            .footer a {
                color: #007BFF;
                text-decoration: none;
                font-weight: 600;
            }
            .footer a:hover {
                text-decoration: underline;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>Welcome to ${institutionName}</h1>
            </div>
            <div class="content">
                <p>Dear <strong>${fullName}</strong>,</p>
                <p>We are excited to have you on board! Below are your account credentials:</p>
                <div class="credentials">
                    <p><strong>Full Name:</strong> ${fullName}</p>
                    <p><strong>Username:</strong> ${userName}</p>
                    <p><strong>Password:</strong> ${password}</p>
                    <p><strong>Email:</strong> ${email}</p>
                    <p><strong>Institution Name:</strong> ${institutionName}</p>
                    <p><strong>Login URL:</strong> ${url}</p>
                </div>
                <p>Please keep this information secure and do not share your password with anyone. If you have any questions or encounter issues, feel free to contact us.</p>
            </div>
            <div class="footer">
                <p>Need help? Reach out to us at <a href="mailto:support@yourinstitution.com">support@yourinstitution.com</a>.</p>
                <p>&copy; ${new Date().getFullYear()} ${institutionName}. All rights reserved.</p>
            </div>
        </div>
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
            subject: 'Email Verification',
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
    register, login, refreshToken, forgotPassword, verifyOtp, updatePasword, superadminotpVerification
}

