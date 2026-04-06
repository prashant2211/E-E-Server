const { response } = require('express')
const teacherModel = require('../models/teacherModel')
const { getPermissionSet } = require('./permissionAssinment');
const userModel           = require('../models/User')
const nodemailer = require('nodemailer');
const util = require('util');
const bcrypt        = require('bcryptjs')
const classModel           = require('../models/classModel');
const mongoErrorMessages = require('./mongoErrors.json');




//Show the list of teacher

const index = async (req, res, next) => {
    const permissionsResult = await getPermissionSet(req);
    if(permissionsResult.teachers.split("-").includes('RA')){

    try {
        const page = parseInt(req.query.PageNumber) || 1;
        const limit = parseInt(req.query.PageSize) || 10;
        const skip = (page - 1) * limit;
        const searchText = req.query.SearchText || '';
        let searchCondition = {
            InstutionCode: req.user.InstutionCode
        };
        
        if (req.query.status === 'Active') {
            searchCondition.Status = true;
        } else if (req.query.status === 'Inactive') {
            searchCondition.Status = false;
        }

        if (searchText) {
            searchCondition.$or = [
                { Staff_Code: { $regex: searchText, $options: 'i' } },
                { First_Name: { $regex: searchText, $options: 'i' } },
                { Last_Name: { $regex: searchText, $options: 'i' } },
                { Email: { $regex: searchText, $options: 'i' } },
                { Contact_Number: { $regex: searchText, $options: 'i' } },
                { Qualification: { $regex: searchText, $options: 'i' } },
                { Experience: { $regex: searchText, $options: 'i' } },
                { InstutionCode: { $regex: searchText, $options: 'i' } },
            ];
        }

        const [teachers, totalCount] = await Promise.all([
            teacherModel.find(searchCondition).skip(skip).limit(limit),
            teacherModel.countDocuments(searchCondition)
        ]);
        res.status(200).json({
            success: true,
            message: "Data retrieved successfully",
            code: 200,
            totalRecords: totalCount,
            data: teachers.map(teacher => ({
                _id: teacher._id,
                Staff_Code: teacher.Staff_Code,
                First_Name: teacher.First_Name,
                Last_Name: teacher.Last_Name,
                Email: teacher.Email,
                Specialised_Subject: teacher.Specialised_Subject,
                Age: teacher.Age,
                Contact_Number: teacher.Contact_Number,
                class_Code: teacher.class_Code,
                Address: teacher.Address,
                Qualification: teacher.Qualification,
                joining_Date: teacher.joining_Date,
                Adhar: teacher.Adhar,
                DOB: teacher.DOB,
                State: teacher.State,
                District: teacher.District,
                Experience: teacher.Experience,
                Status: teacher.Status
            }))
        });
    } catch (error) { //mongoErrorMessages
        const matchedKey = Object.keys(mongoErrorMessages).find(key => error.message.includes(key));
        const errorMessage = matchedKey ? mongoErrorMessages[matchedKey] : error.message;
        res.status(500).json({
            success: false,
            message: errorMessage,
            code: 500,
            error: errorMessage,
            data: []
        });
    }
}else{
    res.status(401).json({
        code: 403,
        success: true,
        message: 'You do not have the necessary permissions to access this resource. Please contact your administrator'
    })
}
    
};



// Get single Teacher Record


const show = async (req, res, next) => {
    const permissionsResult = await getPermissionSet(req);
    if(permissionsResult.teachers.split("-").includes('R')){

    let teacherId = req.params.id;
    teacherModel.findById(teacherId)
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

// list of teacher name
const getTeacher = async (req, res, next) => {

     await teacherModel.find({ InstutionCode: req.user.InstutionCode })
            .then(data => {
                const nameArray = data.map(teacher => ({
                    teacherName:  teacher.First_Name + ' '+teacher.Last_Name,
                    teacherId: teacher.Staff_Code
                }));

                res.status(200).json({
                        success: true,
                        message: "Data retrieved successfully",
                        code: 200,
                        data:nameArray
                    })
                })
                .catch(error => {
                    const matchedKey = Object.keys(mongoErrorMessages).find(key => error.message.includes(key));
                     const errorMessage = matchedKey ? mongoErrorMessages[matchedKey] : error.message;
                    res.status(500).json({
                        message: errorMessage,
                        status:500,
                        error: errorMessage,
                        data: []
                    
                    })
                })

}

// Add Teacher to dataBase
const store = async (req, res, next) => {
    let teacherId;
    try {
        // Fetch permissions and check if the user has the necessary permissions
        const permissionsResult = await getPermissionSet(req);
        if (!permissionsResult.teachers.split("-").includes('W')) {
            return res.status(403).json({
                code: 403,
                success: false,
                message: 'You do not have the necessary permissions to access this resource. Please contact your administrator'
            });
        }
        // Default employee code if not provided
        let employeeCode = req.body.Staff_Code;
        if (!employeeCode) {
            employeeCode = await generateId(req.user.InstutionCode);
        }
      
        // Validate required fields
        if (!req.body.First_Name || !req.body.Last_Name || !req.body.Email || 
            !req.body.Specialised_Subject || !req.body.Contact_Number || 
            !req.body.Address || !req.body.Qualification || 
            !req.body.State || !req.body.District || !req.body.Experience || 
            !req.body.Adhar) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields. Please fill all required fields.',
                code: 400,
                error: 'Required fields: First_Name, Last_Name, Email, Specialised_Subject, Contact_Number, Address, Qualification, State, District, Experience, Adhar',
                data: []
            });
        }

        // Check if teacher already exists by Email or Staff_Code
        // Also check if a user with this email exists (from staff onboarding) and get their MemberId
        let existingUser = await userModel.findOne({
            Email: req.body.Email,
            InstutionCode: req.user.InstutionCode
        });

        // If user exists from staff onboarding, use their MemberId as Staff_Code if not provided
        if (existingUser && existingUser.MemberId && !req.body.Staff_Code) {
            employeeCode = existingUser.MemberId;
        }

        const existingTeacher = await teacherModel.findOne({
            $or: [
                { Email: req.body.Email, InstutionCode: req.user.InstutionCode },
                { Staff_Code: employeeCode, InstutionCode: req.user.InstutionCode }
            ]
        });

        let teacher;
        if (existingTeacher) {
            // Update existing teacher record
            const updateData = {
                First_Name: req.body.First_Name,
                Last_Name: req.body.Last_Name,
                Email: req.body.Email,
                Specialised_Subject: req.body.Specialised_Subject,
                Contact_Number: req.body.Contact_Number,
                Address: req.body.Address,
                Qualification: req.body.Qualification,
                joining_Date: req.body.joining_Date || existingTeacher.joining_Date || new Date().toISOString().split('T')[0],
                DOB: req.body.DOB || existingTeacher.DOB || new Date().toISOString().split('T')[0],
                State: req.body.State,
                District: req.body.District,
                Experience: req.body.Experience,
                Status: req.body.Status !== undefined ? req.body.Status : existingTeacher.Status,
            };
            
            // Only update Age if provided
            if (req.body.Age) {
                updateData.Age = parseInt(req.body.Age);
            } else if (existingTeacher.Age) {
                updateData.Age = existingTeacher.Age;
            }
            
            // Adhar is required - validate and update it
            if (!req.body.Adhar || req.body.Adhar.trim() === '') {
                // If not provided in update, keep existing value
                if (existingTeacher.Adhar) {
                    updateData.Adhar = existingTeacher.Adhar;
                } else {
                    return res.status(400).json({
                        success: false,
                        message: 'Adhar number is required',
                        code: 400,
                        error: 'Adhar field cannot be empty',
                        data: []
                    });
                }
            } else {
                updateData.Adhar = req.body.Adhar.trim();
            }
            
            Object.assign(existingTeacher, updateData);
            await existingTeacher.save();
            teacher = existingTeacher;
            teacherId = teacher._id;
        } else {
            // Create new teacher object
            const teacherData = {
            Staff_Code: employeeCode,
            First_Name: req.body.First_Name,
            Last_Name: req.body.Last_Name,
            Email: req.body.Email,
            Specialised_Subject: req.body.Specialised_Subject,
            Contact_Number: req.body.Contact_Number,
            Address: req.body.Address,
            Qualification: req.body.Qualification,
            joining_Date: req.body.joining_Date || new Date().toISOString().split('T')[0],
            DOB: req.body.DOB || new Date().toISOString().split('T')[0],
            State: req.body.State,
            District: req.body.District,
            Experience: req.body.Experience,
            InstutionCode: req.user.InstutionCode,
            Status: req.body.Status !== undefined ? req.body.Status : true,
            };
            
            // Only include Age if provided
            if (req.body.Age) {
                teacherData.Age = parseInt(req.body.Age);
            }
            
            // Adhar is required - validate and include it
            if (!req.body.Adhar || req.body.Adhar.trim() === '') {
                return res.status(400).json({
                    success: false,
                    message: 'Adhar number is required',
                    code: 400,
                    error: 'Adhar field cannot be empty',
                    data: []
                });
            }
            teacherData.Adhar = req.body.Adhar.trim();
            
            teacher = new teacherModel(teacherData);

            // Save the teacher object
            await teacher.save();
            teacherId = teacher._id;
        }
       
       ////////////////////////////////////////////////
       // Check if user already exists (e.g., from staff onboarding) - reuse existingUser if already fetched
       if (!existingUser) {
           existingUser = await userModel.findOne({
               Email: req.body.Email,
               InstutionCode: req.user.InstutionCode
           });
       }

       if (!existingUser) {
           // Only create user if it doesn't exist
           const defaultPassword = req.body.Password || 'Teacher@123'; // Default password if not provided
           const hashedPass = await bcrypt.hash(defaultPassword, 10);
       
           const user = new userModel({
               FirstName: req.body.First_Name,
               LastName: req.body.Last_Name,
               Email: req.body.Email,
               InstutionName: req.user.InstutionName,
               Phone: req.body.Contact_Number,
               UserName: req.body.Email,
               InstutionCode: req.user.InstutionCode, 
               MemberId: employeeCode,      
               UserType:  'Teacher',
               PermissionSet: req.body.PermissionSet || '',
               Password: hashedPass
           });
       
           await user.save();
       } else {
           // Update existing user's MemberId if it's different
           if (existingUser.MemberId !== employeeCode) {
               existingUser.MemberId = employeeCode;
               await existingUser.save();
           }
       }

       /////////////////////////////////////////////////

        // Send the verification email (optional - don't fail if email fails)
        try {
            // Use dynamic URL from institution or frontend URL, never hardcode
            const url = req.body.Url || process.env.FRONTEND_URL || 'www.erpsystem.com'; 
            const fullName = `${req.body.First_Name} ${req.body.Last_Name}`;
            const passwordToSend = req.body.Password || 'Teacher@123';
            await emailVerification(req.body.Email, fullName, req.user.InstutionName, req.body.Email, passwordToSend, url);
        } catch (emailError) {
            console.error('Email sending failed (non-critical):', emailError);
            // Don't fail the request if email fails
        }

        // Respond with success
        return res.status(201).json({
            success: true,
            message: 'Teacher added successfully!',
            code: 201
        });
    } catch (error) {
        // Clean up teacher if it was created
        if (teacherId) {
            try {
                await teacherModel.findByIdAndDelete(teacherId);
            } catch (deleteError) {
                console.error('Error deleting teacher on rollback:', deleteError);
            }
        }
        // Handle any errors that occur during the process
        console.error('Teacher registration error:', error);
        const matchedKey = Object.keys(mongoErrorMessages).find(key => error.message.includes(key));
        const errorMessage = matchedKey ? mongoErrorMessages[matchedKey] : error.message;
        return res.status(500).json({
            success: false,
            message: errorMessage || 'Failed to register teacher',
            code: 500,
            error: error.message || errorMessage,
            data: []
        });
    }
};


const getTeacherProfile = async (req, res, next) => {

    const permissionsResult = await getPermissionSet(req);
    if(!permissionsResult.students.split("-").includes('R')){
        res.status(403).json({
            code: 403,
            success: true,
            message: 'You do not have the necessary permissions to access this resource. Please contact your administrator'
        })
    }


    const teacherRecord = await teacherModel.find({
        Staff_Code: req.query.Id,
        InstutionCode: req.user.InstutionCode
    });
    if(teacherRecord.length === 0){
        res.status(500).json({
            code: 500,
            success: false,
            message: 'Record Not Found'
        })
    }

    let formattedRecords = teacherRecord.map(teachet => ({
        teachetName: teachet.First_Name+' '+teachet.Last_Name, 
        teachetId: teachet.Staff_Code,  
        Fathers_Name: teachet.Father_Name,
        Mothers_Name: teachet.Mother_Name,
        Class: teachet.Class_Name,
        DOB: teachet.DOB,
        Adhar: teachet.Adhar,
        State: teachet.State,
        District: teachet.District,
        Address: teachet.Address,
        Address: teachet.Address,
        Contact_Number: teachet.Contact_Number,
        Experience: teachet.Experience,
        Qualification: teachet.Qualification,
        Joining_Date: teachet.joining_Date,
        Age: teachet.Age,
        Email: teachet.Email,
        Specialised_Subject: teachet.Specialised_Subject,
        Teacher_Id: teachet.Staff_Code
                        
    }));
    return res.status(200).json({
        code: 200,
        success: false,
        message: 'Record get Sucessfully',
        data:formattedRecords
    })



}


// update Teacher record          
const update = async (req, res, next) => {
    const permissionsResult = await getPermissionSet(req);
    if(permissionsResult.students.split("-").includes('E')){

    let teacherId = req.body.teacherId;
    let updateData = {
        Staff_Code: req.body.Staff_Code,
        First_Name: req.body.First_Name,
        Last_Name: req.body.Last_Name,
        Email: req.body.Email,
        Specialised_Subject: req.body.Specialised_Subject,
        Age: req.body.Age,
        Contact_Number: req.body.Contact_Number,
        class_Code: req.body.class_Code,
        Address: req.body.Address,
        Qualification: req.body.Qualification,
        joining_Date: req.body.joining_Date,
        Adhar: req.body.Adhar,
        DOB: req.body.DOB,
        State: req.body.State,
        District: req.body.District,
        Experience: req.body.Experience,
    };
    teacherModel.findByIdAndUpdate(teacherId, { $set: updateData })
        .then(response => {
            res.status(200).json({
                success: true,
                message: 'Teacher added successfully!',
                code: 200
            });
        })
        .catch(error => {
            const matchedKey = Object.keys(mongoErrorMessages).find(key => error.message.includes(key));
        const errorMessage = matchedKey ? mongoErrorMessages[matchedKey] : error.message;
            res.status(500).json({
                success: false,
                message: errorMessage,
                error: errorMessage,
                code: 500
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

// deactivate  Teacher record
const remove = async (req, res, next) => {
    const permissionsResult = await getPermissionSet(req);
    if(permissionsResult.students.split("-").includes('D')){

    let teacherId = req.body.teacherId;
    let removeData = {
        Status: req.body.status
    };
    teacherModel.findByIdAndUpdate(teacherId, { $set: removeData })
        .then(response => {
            res.status(200).json({
                success: true,
                message: req.body.status ? 'Teacher Activeted Successfully!':'Teacher InActiveted Successfully!',
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





// This is only for super admin delete an Teacher


const destroy = async (req, res, next) => {
    const permissionsResult = await getPermissionSet(req);
    if(permissionsResult.students.split("-").includes('R')){

    let teacherId = req.body.teacherId
    teacherModel.findByIdAndDelete(teacherId)
        .then(response => {
            res.status(200).json({
                success: true,
                message: 'Teacher deleted successfully!',
                code: 200
            });
        })
        .catch(error => {
            const matchedKey = Object.keys(mongoErrorMessages).find(key => error.message.includes(key));
            const errorMessage = matchedKey ? mongoErrorMessages[matchedKey] : error.message;
            res.json({
                message: errorMessage,
                code:500,
                error: errorMessage,
                success: false
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

const generateId = async (instutionCode) => {
    const teacherRecord = await teacherModel.find({
        InstutionCode: instutionCode
    });
    
    let nextRegistrationNumber;
    
    if (!teacherRecord || teacherRecord.length === 0) {
        nextRegistrationNumber = `${instutionCode}_001`;
    } else {
        const maxNumber = teacherRecord
            .map(teacher => {
                const parts = teacher.Staff_Code?.split('_');
                return parts && parts[1] ? parseInt(parts[1], 10) : 0;
            })
            .reduce((max, num) => (num > max ? num : max), 0);
    
        const nextNumber = String(maxNumber + 1).padStart(3, '0');
        nextRegistrationNumber = `${instutionCode}_${nextNumber}`;
    }    
    return nextRegistrationNumber;
};

const emailVerification = async (email, fullName, institutionName, userName, password,url) => {
    // const otp = Math.floor(100000 + Math.random() * 900000);
    // Email verification template
   
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
                <p>Need help? Reach out to us at <a href="${email}">${email}</a>.</p>
                <p>&copy;${institutionName}. All rights reserved.</p>
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
            subject: `Email Welcome to ${institutionName} - Your Journey Begins Here!n`,
            html: mailStructure,
        };

        await sendMail(emailOptions); // Await email sending
        return true; // Success
    } catch (error) {
        console.error('Error sending email:', error);
        return false; // Failure
    }
};



// Get available teacher users (UserType="Teacher" but not in Teacher collection)
const getAvailableTeacherUsers = async (req, res, next) => {
    const permissionsResult = await getPermissionSet(req);
    if(permissionsResult.teachers.split("-").includes('RA')){
        try {
            const instutionCode = req.user.InstutionCode;
            
            // Get all users with UserType="Teacher" for this institution
            const teacherUsers = await userModel.find({
                InstutionCode: instutionCode,
                UserType: 'Teacher'
            }).select('FirstName LastName Email Phone MemberId Address State District Experience Adhar').lean();
            
            // Get all existing teachers' emails and memberIds
            const existingTeachers = await teacherModel.find({
                InstutionCode: instutionCode
            }).select('Email Staff_Code').lean();
            
            const existingEmails = new Set(existingTeachers.map(t => t.Email?.toLowerCase()));
            const existingStaffCodes = new Set(existingTeachers.map(t => t.Staff_Code));
            
            // Filter out users who already have Teacher records
            const availableUsers = teacherUsers.filter(user => {
                const emailMatch = user.Email && existingEmails.has(user.Email.toLowerCase());
                const staffCodeMatch = user.MemberId && existingStaffCodes.has(user.MemberId);
                return !emailMatch && !staffCodeMatch;
            });
            
            // Format response
            const formattedUsers = availableUsers.map(user => ({
                _id: user._id,
                name: `${user.FirstName || ''} ${user.LastName || ''}`.trim(),
                email: user.Email,
                phone: user.Phone,
                memberId: user.MemberId,
                address: user.Address || '',
                state: user.State || '',
                district: user.District || '',
                experience: user.Experience || '',
                adhar: user.Adhar || '',
                displayName: `${user.FirstName || ''} ${user.LastName || ''} (${user.Email}) - ${user.MemberId}`
            }));
            
            res.status(200).json({
                success: true,
                message: "Available teacher users retrieved successfully",
                code: 200,
                data: formattedUsers
            });
        } catch (error) {
            const matchedKey = Object.keys(mongoErrorMessages).find(key => error.message.includes(key));
            const errorMessage = matchedKey ? mongoErrorMessages[matchedKey] : error.message;
            res.status(500).json({
                success: false,
                message: errorMessage,
                code: 500,
                error: errorMessage,
                data: []
            });
        }
    } else {
        res.status(401).json({
            code: 403,
            success: true,
            message: 'You do not have the necessary permissions to access this resource. Please contact your administrator'
        })
    }
};

module.exports = {
    index, show, store, update, destroy, remove, getTeacher, getTeacherProfile, getAvailableTeacherUsers
}
