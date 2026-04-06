const { response } = require('express')
const instutionModel = require('../models/InstutionModel')
const { getPermissionSet } = require('./permissionAssinment');
const userModel           = require('../models/User')
const nodemailer = require('nodemailer');
const bcrypt        = require('bcryptjs')
const util = require('util');



//Show the list of instution

const index = async (req, res, next) => {
   
    const permissionsResult = await getPermissionSet(req);
   // if(permissionsResult.instutions.split("-").includes('RA')){

    try {
        const page = parseInt(req.query.PageNumber) || 1;
        const limit = parseInt(req.query.PageSize) || 10;
        const skip = (page - 1) * limit;
        const searchText = req.query.SearchText || '';

        let searchCondition = {};

        if (req.query.status === 'Active') {
            searchCondition.Status = true;
        } else if (req.query.status === 'Inactive') {
            searchCondition.Status = false;
        }

        if (searchText) {
            searchCondition = {
                ...searchCondition,
                $or: [
                    { InstutionId: { $regex: searchText, $options: 'i' } },
                    { Instution_Name: { $regex: searchText, $options: 'i' } },
                    { Contact_Number: { $regex: searchText, $options: 'i' } },
                    { District: { $regex: searchText, $options: 'i' } },
                ]
            };
        }

        const [instution, totalCount] = await Promise.all([
            instutionModel.find(searchCondition).skip(skip).limit(limit),
            instutionModel.countDocuments(searchCondition)
        ]);

        res.json({
            success: true,
            message: "Data retrieved successfully",
            code: 200,
            totalRecords: totalCount,
            data: instution.map(instution => ({
                _id: instution._id,
                InstutionId: instution.Instution_Id,
                InstutionName: instution.Instution_Name,
                ChairManName: instution.ChairMan_Name,
                RegistrationId: instution.Registration_Id,
                ContactNumber: instution.Contact_Number,
                SecondaryContact: instution.Secondary_Contact,
                Affiliation: instution.Affiliation,
                Address: instution.Address,
                instutionType: instution.instution_Type,
                DirectorName: instution.Director_Name,
                RegistarName: instution.Registar_Name,
                ManagementMember: instution.Management_Member,
                State: instution.State,
                District: instution.District,
                Status: instution.Status,
                createdAt: instution.createdAt
            }))
        });
    } catch (error) {
        res.json({
            success: false,
            message: 'An error occurred!',
            code: 500,
            error: error.message
        });
    }
// }else{
//     res.json({
//         code: 401,
//         success: true,
//         message: 'You do not have the necessary permissions to access this resource. Please contact your administrator'
//     })
// }

};


// Get single instution Record

const show = async (req, res, next) => {
    const permissionsResult = await getPermissionSet(req);
    if(permissionsResult.instutions.split("-").includes('R')){


    let instutionId = req.query.instutionId;
    instutionModel.findById(instutionId)
        .then(data => {
            res.json({
                success: true,
                message: "Data retrieved successfully",
                code: 200,
                data:data
            })
        })
        .catch(error => {
            res.json({
                message: `${error}`,
                status:401
            })
        })
    }else{
        res.json({
            code: 401,
            success: true,
            message: 'You do not have the necessary permissions to access this resource. Please contact your administrator'
        })
    }
}

const generateInstitutionId = async (instutionName) => {
   // const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
   // const numeric = '0123456789';
    const instutionRecord = await instutionModel.find({})

    let instutionId = `${instutionName.split(' ').map(word => word[0]).join('')}`;
    console.log(`instutionId -=-- ${instutionId}`);
    
    let nextRegistrationNumber;
    
    if (!instutionRecord || instutionRecord.length === 0) {
        nextRegistrationNumber = `${instutionId}-000`;
    } else {
        const maxNumber = instutionRecord
            .map(student => {
                const parts = student.Instution_Id?.split('-');
                return parts && parts[1] ? parseInt(parts[1], 10) : 0;
            })
            .reduce((max, num) => (num > max ? num : max), 0);
    
        const nextNumber = String(maxNumber + 1).padStart(3, '0');
        nextRegistrationNumber = `${instutionId}-${nextNumber}`;
    }    
    return nextRegistrationNumber;
    
};




// Add Instution to dataBase
const store = async (req, res, next) => {
    const permissionsResult = await getPermissionSet(req);
    // if (!permissionsResult.teachers.split("-").includes('W')) {
    //     return res.json({
    //         code: 401,
    //         success: false,
    //         message: 'You do not have the necessary permissions to access this resource. Please contact your administrator'
    //     });
    // }
    try {
        // Generate institution ID
        const instutionId = await generateInstitutionId(req.body.InstutionName);
    
        // Save institution
        const instution = new instutionModel({
            Instution_Id: instutionId,
            Email: req.body.Email,
            Instution_Name: req.body.InstutionName,
            ChairMan_Name: req.body.ChairManName,
            Registration_Id: req.body.RegistrationId,
            Contact_Number: req.body.ContactNumber,
            Secondary_Contact: req.body.SecondaryContact,
            Affiliation: req.body.Affiliation,
            Address: req.body.Address,
            instution_Type: req.body.instutionType,
            Director_Name: req.body.DirectorName,
            Registar_Name: req.body.RegistarName,
            Management_Member: req.body.ManagementMember,
            State: req.body.State,
            District: req.body.District,
            Url: req.body.InstudionUrl,
            Status: true,
        });
        await instution.save();
         // Compare password
      
        // Hash password and create user
        const hashedPass = await bcrypt.hash(req.body.Password, 10);
    
        const user = new userModel({
            FirstName: req.body.InstutionName,
            LastName: req.body.InstutionName,
            Email: req.body.Email,
            InstutionName: req.body.InstutionName,
            Phone: req.body.ContactNumber,
            UserName: req.body.Email,
            InstutionCode: instutionId, // Use generated code
            MemberId: instutionId,      // Use generated code
            UserType:  'Admin',
            PermissionSet: req.body.PermissionSet || '',
            Password: hashedPass
        });
    
        await user.save();
   
    
        // Send the verification email
        const url = req.body.InstudionUrl;
        const fullName = req.body.InstutionName;

        await emailVerification(
            req.body.Password,
            fullName,
            req.body.Email,
            instutionId,
            req.body.RegistrationId,
            
            req.body.ContactNumber,
            req.body.District,
            req.body.State,
            req.body.InstudionUrl
        );
    
        // Success response
        res.json({
            success: true,
            message: 'Institution registered successfully!',
            code: 200
        });
    
    } catch (error) {
        // Error response
        res.status(500).json({
            success: false,
            message: error.message || 'Something went wrong while registering the institution'
        });
    }
}    

// update Instution record
const update = async (req, res, next) => {
    const permissionsResult = await getPermissionSet(req);
    if(permissionsResult.instutions.split("-").includes('E')){

    let instutionId = req.body.InstutionId
    let updateData = {
        Instution_Id: req.body.InstutionId,
        Instution_Name: req.body.InstutionName,
        ChairMan_Name: req.body.ChairManName,
        Registration_Id: req.body.RegistrationId,
        Contact_Number: req.body.ContactNumber,
        Secondary_Contact: req.body.SecondaryContact,
        Affiliation: req.body.Affiliation,
        Address: req.body.Address,
        instution_Type: req.body.instutionType,
        Director_Name: req.body.DirectorName,
        Registar_Name: req.body.RegistarName,
        Management_Member: req.body.ManagementMember,
        State: req.body.State,
        District: req.body.District,
        Status: true,
    }
    instutionModel.findByIdAndUpdate(instutionId, { $set: updateData })
        .then(response => {
            res.json({
                success: true,
                message: 'Instution details updated sucessfully',
                code: 200
            });
        })
        .catch(error => {
            res.json({
                message: `${error}`
            });
        });
    }else{
        res.json({
            code: 401,
            success: true,
            message: 'You do not have the necessary permissions to access this resource. Please contact your administrator'
        })
    }
}

// deactivate instution record
const remove = async (req, res, next) => {
    const permissionsResult = await getPermissionSet(req);
    if(permissionsResult.instutions.split("-").includes('D')){

    let instutionId = req.body.InstutionId
   
    let updateData = {
        // RollNo : req.body.RollNo, // TODO this fild note requered
        Status: req.body.status,
        
    }
    instutionModel.findByIdAndUpdate(instutionId, { $set: updateData })
        .then(response => {
            res.json({
                success: true,
                message: 'Instution DeActivated Successfully!',
                code: 200
            });
        })
        .catch(error => {
            res.json({
                message: `${error}`
            });
        });
    }else{
        res.json({
            code: 401,
            success: true,
            message: 'You do not have the necessary permissions to access this resource. Please contact your administrator'
        })
    }
}

// delete an instution

const destroy = async (req, res, next) => {
    const permissionsResult = await getPermissionSet(req);
    if(permissionsResult.instutions.split("-").includes('D')){

    let instutionId = req.body.InstutionId
    instutionModel.findByIdAndDelete(instutionId)
        .then(response => {
            res.json({
                message: 'Instution Removed sucessfully'
            })
        })
        .catch(error => {
            res.json({
                message: 'An error occured!'
            })
        })
    }else{
        res.json({
            code: 401,
            success: true,
            message: 'You do not have the necessary permissions to access this resource. Please contact your administrator'
        })
    }
}


const emailVerification = async (password, institutionName, email, instutionId, registrationId, contactNumber, district, state, url) => {
   console.log(`url -=- ${url}`)
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
                <p>Dear <strong>${institutionName}</strong>,</p>
                <p>We are excited to have you on board! Below are your account credentials:</p>
                <div class="credentials">
                    <p><strong>Institution Name : </strong> ${institutionName}</p>
                    <p><strong>Instution Id : </strong> ${instutionId}</p>
                    <p><strong>Registration Id : </strong> ${registrationId}</p>  
                    <p><strong>Email : </strong> ${email}</p>
                    <p><strong>Password : </strong> ${password}</p>
                    <p><strong>Contact Number : </strong> ${contactNumber}</p>
                    <p><strong>District : </strong> ${district}</p>
                    <p><strong>State : </strong> ${state}</p>
                    <p><strong>Login URL:</strong> <a href="${url}" target="_blank" style="color: #2b6cb0; text-decoration: underline;">${url}</a></p>
                    </div>
                <p>Please keep this information secure and do not share your password with anyone. If you have any questions or encounter issues, feel free to contact us.</p>
            </div>
            <div class="footer">
                <p>Need help? Reach out to us at <a href="mailto:${process.env.SUPPORT_EMAIL || 'support@erpsystem.com'}">${process.env.SUPPORT_EMAIL || 'support@erpsystem.com'}</a>.</p>
                <p>&copy; ${new Date().getFullYear()} ${institutionName}. All rights reserved.</p>
            </div>
        </div>
    </body>
    </html>
    `;

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
            subject: `Getting Started with ${institutionName}`,
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
    index, show, store, update, destroy, remove
}