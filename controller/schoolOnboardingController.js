const Institution = require('../models/InstutionModel');
const User = require('../models/User');
const { AcademicYear } = require('../models/academicYearModel');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');
const util = require('util');
const { logger } = require('../utils/logger');

/**
 * Generate unique Institution ID
 * Format: [First letters of each word]-[3-digit number]
 * Example: "Educational Eternity" -> "EE-001"
 */
const generateInstitutionId = async (institutionName, session = null) => {
  try {
    const query = Institution.find({});
    const institutions = session ? await query.session(session).exec() : await query.exec();
    
    // Extract first letter of each word
    const initials = institutionName
      .split(' ')
      .map(word => word[0]?.toUpperCase() || '')
      .filter(letter => letter)
      .join('');
    
    let nextNumber = '001';
    
    if (institutions.length > 0) {
      // Find the highest number
      const maxNumber = institutions
        .map(inst => {
          const parts = inst.Instution_Id?.split('-');
          return parts && parts[1] ? parseInt(parts[1], 10) : 0;
        })
        .reduce((max, num) => (num > max ? num : max), 0);
      
      nextNumber = String(maxNumber + 1).padStart(3, '0');
    }
    
    const institutionId = `${initials}-${nextNumber}`;
    logger.info(`Generated Institution ID: ${institutionId}`);
    return institutionId;
  } catch (error) {
    logger.error('Error generating institution ID:', error);
    throw error;
  }
};

/**
 * Validate onboarding request data
 */
const validateOnboardingData = (data) => {
  const errors = [];
  
  // Required fields
  if (!data.institutionName || data.institutionName.trim().length < 3) {
    errors.push('Institution name is required (minimum 3 characters)');
  }
  
  if (!data.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    errors.push('Valid email is required');
  }
  
  if (!data.contactNumber || data.contactNumber.trim().length < 10) {
    errors.push('Valid contact number is required (minimum 10 digits)');
  }
  
  if (!data.state || data.state.trim().length < 2) {
    errors.push('State is required');
  }
  
  if (!data.district || data.district.trim().length < 2) {
    errors.push('District is required');
  }
  
  if (!data.address || data.address.trim().length < 10) {
    errors.push('Address is required (minimum 10 characters)');
  }
  
  // Admin user fields
  if (!data.adminFirstName || data.adminFirstName.trim().length < 2) {
    errors.push('Admin first name is required (minimum 2 characters)');
  }
  
  if (!data.adminLastName || data.adminLastName.trim().length < 2) {
    errors.push('Admin last name is required (minimum 2 characters)');
  }
  
  if (!data.adminEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.adminEmail)) {
    errors.push('Valid admin email is required');
  }
  
  if (!data.adminPassword || data.adminPassword.length < 8) {
    errors.push('Admin password is required (minimum 8 characters)');
  }
  
  if (!data.adminPhone || data.adminPhone.trim().length < 10) {
    errors.push('Valid admin phone number is required (minimum 10 digits)');
  }
  
  return errors;
};

/**
 * Send welcome email to institution admin
 */
const sendWelcomeEmail = async (adminData, institutionData, loginUrl) => {
  try {
    const mailStructure = `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome to ${institutionData.name}</title>
        <style>
            body {
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                margin: 0;
                padding: 0;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: #333;
            }
            .container {
                max-width: 600px;
                margin: 50px auto;
                background-color: #ffffff;
                border-radius: 15px;
                box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
                overflow: hidden;
            }
            .header {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: #ffffff;
                text-align: center;
                padding: 30px 20px;
            }
            .header h1 {
                font-size: 28px;
                margin: 0;
                font-weight: bold;
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
            .credentials-box {
                margin: 25px 0;
                padding: 20px;
                background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
                border-radius: 10px;
                border-left: 4px solid #667eea;
            }
            .credentials-box h3 {
                margin-top: 0;
                color: #667eea;
                font-size: 18px;
            }
            .credential-item {
                margin: 10px 0;
                padding: 8px 0;
                border-bottom: 1px solid rgba(102, 126, 234, 0.2);
            }
            .credential-item:last-child {
                border-bottom: none;
            }
            .credential-label {
                font-weight: 600;
                color: #333;
                display: inline-block;
                width: 150px;
            }
            .credential-value {
                color: #667eea;
                font-weight: 500;
            }
            .login-button {
                display: inline-block;
                margin: 20px 0;
                padding: 12px 30px;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                text-decoration: none;
                border-radius: 8px;
                font-weight: 600;
                text-align: center;
            }
            .footer {
                background-color: #f4f8fc;
                text-align: center;
                padding: 20px;
                font-size: 14px;
                color: #777;
            }
            .footer a {
                color: #667eea;
                text-decoration: none;
                font-weight: 600;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🎓 Welcome to ${institutionData.name}!</h1>
            </div>
            <div class="content">
                <p>Dear <strong>${adminData.firstName} ${adminData.lastName}</strong>,</p>
                <p>Congratulations! Your institution <strong>${institutionData.name}</strong> has been successfully onboarded to the ERP System.</p>
                
                <div class="credentials-box">
                    <h3>📋 Institution Details</h3>
                    <div class="credential-item">
                        <span class="credential-label">Institution ID:</span>
                        <span class="credential-value">${institutionData.institutionId}</span>
                    </div>
                    <div class="credential-item">
                        <span class="credential-label">Institution Name:</span>
                        <span class="credential-value">${institutionData.name}</span>
                    </div>
                    <div class="credential-item">
                        <span class="credential-label">Registration ID:</span>
                        <span class="credential-value">${institutionData.registrationId || 'N/A'}</span>
                    </div>
                </div>
                
                <div class="credentials-box">
                    <h3>🔐 Your Admin Credentials</h3>
                    <div class="credential-item">
                        <span class="credential-label">Email:</span>
                        <span class="credential-value">${adminData.email}</span>
                    </div>
                    <div class="credential-item">
                        <span class="credential-label">Password:</span>
                        <span class="credential-value">${adminData.password}</span>
                    </div>
                    <div class="credential-item">
                        <span class="credential-label">User Type:</span>
                        <span class="credential-value">Admin</span>
                    </div>
                </div>
                
                <p style="text-align: center;">
                    <a href="${loginUrl}" class="login-button">Login to Your Dashboard</a>
                </p>
                
                <p><strong>⚠️ Important:</strong> Please change your password after first login for security purposes.</p>
                <p>If you have any questions or need assistance, please contact our support team.</p>
            </div>
            <div class="footer">
                <p>Need help? Contact us at <a href="mailto:${process.env.SUPPORT_EMAIL || 'support@erpsystem.com'}">${process.env.SUPPORT_EMAIL || 'support@erpsystem.com'}</a></p>
                <p>&copy; ${new Date().getFullYear()} ${institutionData.name}. All rights reserved.</p>
            </div>
        </div>
    </body>
    </html>`;

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.ORGANIZATION_EMAIL,
        pass: process.env.ORGANIZATION_PASSWORD,
      },
    });

    const sendMail = util.promisify(transporter.sendMail).bind(transporter);

    const emailOptions = {
      from: process.env.ORGANIZATION_EMAIL,
      to: adminData.email,
      subject: `Welcome to ERP System - ${institutionData.name}`,
      html: mailStructure,
    };

    await sendMail(emailOptions);
    logger.info(`Welcome email sent to ${adminData.email}`);
    return true;
  } catch (error) {
    logger.error('Error sending welcome email:', error);
    return false;
  }
};

/**
 * Main onboarding function
 * Creates institution and admin user in a single transaction
 */
const onboardSchool = async (req, res) => {
  const mongoose = require('mongoose');
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const data = req.body;

    // Validate input data
    const validationErrors = validateOnboardingData(data);
    if (validationErrors.length > 0) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: validationErrors,
        code: 400
      });
    }

    // Check if email or contact already exists
    const existingInstitution = await Institution.findOne({
      $or: [
        { Email: data.email },
        { Contact_Number: data.contactNumber }
      ]
    }).session(session);

    if (existingInstitution) {
      await session.abortTransaction();
      return res.status(409).json({
        success: false,
        message: 'Institution with this email or contact number already exists',
        code: 409
      });
    }

    // Check if admin email already exists
    const existingUser = await User.findOne({ Email: data.adminEmail }).session(session);
    if (existingUser) {
      await session.abortTransaction();
      return res.status(409).json({
        success: false,
        message: 'Admin user with this email already exists',
        code: 409
      });
    }

    // Generate Institution ID
    const institutionId = await generateInstitutionId(data.institutionName);

    // Create Institution
    const institution = new Institution({
      Instution_Id: institutionId,
      Instution_Name: data.institutionName,
      Email: data.email,
      Contact_Number: data.contactNumber,
      Secondary_Contact: data.secondaryContact || '',
      Address: data.address,
      State: data.state,
      District: data.district,
      Registration_Id: data.registrationId || '',
      Affiliation: data.affiliation || '',
      ChairMan_Name: data.chairmanName || '',
      Director_Name: data.directorName || '',
      Registar_Name: data.registrarName || '',
      instution_Type: data.institutionType || 'School',
      Management_Member: data.managementMembers && data.managementMembers.length > 0 ? data.managementMembers : ['System Admin'],
      Url: data.institutionUrl || `${process.env.FRONTEND_URL || 'http://localhost:3000'}/login`,
      Status: true
    });

    await institution.save({ session });

    // Hash admin password
    const hashedPassword = await bcrypt.hash(data.adminPassword, 10);

    // Generate admin member ID
    const adminMemberId = `${institutionId}-ADMIN-001`;

    // Create Admin User
    const adminUser = new User({
      FirstName: data.adminFirstName,
      LastName: data.adminLastName,
      Email: data.adminEmail,
      Phone: data.adminPhone,
      UserName: data.adminEmail, // Username is same as email
      Password: hashedPassword,
      InstutionCode: institutionId,
      InstutionName: data.institutionName,
      MemberId: adminMemberId,
      UserType: 'Admin',
      PermissionSet: data.permissionSet || 'all', // Default to all permissions for admin
      Verified: true // Admin is auto-verified
    });

    await adminUser.save({ session });

    // Create default academic year (optional)
    if (data.createDefaultAcademicYear !== false) {
      try {
        const currentYear = new Date().getFullYear();
        const academicYear = new AcademicYear({
          InstutionCode: institutionId,
          Year_Name: `${currentYear}-${currentYear + 1}`,
          Start_Date: new Date(currentYear, 0, 1), // January 1
          End_Date: new Date(currentYear + 1, 11, 31), // December 31
          Is_Current: true,
          Status: true,
          Terms: [
            {
              Term_Name: 'First Term',
              Start_Date: new Date(currentYear, 0, 1),
              End_Date: new Date(currentYear, 5, 30),
              Status: 'Active'
            },
            {
              Term_Name: 'Second Term',
              Start_Date: new Date(currentYear, 6, 1),
              End_Date: new Date(currentYear, 11, 31),
              Status: 'Upcoming'
            }
          ]
        });

        await academicYear.save({ session });
        logger.info('Default academic year created');
      } catch (academicYearError) {
        logger.warn('Failed to create academic year, continuing without it:', academicYearError.message);
        // Don't fail the whole onboarding if academic year creation fails
      }
    }

    // Commit transaction
    await session.commitTransaction();
    session.endSession();

    // Send welcome email (non-blocking)
    const loginUrl = data.institutionUrl || `${process.env.FRONTEND_URL || 'http://localhost:3000'}/login`;
    sendWelcomeEmail(
      {
        firstName: data.adminFirstName,
        lastName: data.adminLastName,
        email: data.adminEmail,
        password: data.adminPassword
      },
      {
        name: data.institutionName,
        institutionId: institutionId,
        registrationId: data.registrationId || ''
      },
      loginUrl
    ).catch(err => logger.error('Email sending failed:', err));

    logger.info(`School onboarded successfully: ${institutionId} - ${data.institutionName}`);

    // Return success response
    return res.status(201).json({
      success: true,
      message: 'School onboarded successfully!',
      code: 201,
      data: {
        institution: {
          id: institution._id,
          institutionId: institutionId,
          name: institution.Instution_Name,
          email: institution.Email,
          status: institution.Status
        },
        admin: {
          id: adminUser._id,
          email: adminUser.Email,
          memberId: adminUser.MemberId,
          userType: adminUser.UserType
        },
        loginUrl: loginUrl
      }
    });

  } catch (error) {
    if (session && session.inTransaction()) {
      await session.abortTransaction();
    }
    if (session) {
      session.endSession();
    }
    
    logger.error('Error onboarding school:', error);
    logger.error('Error stack:', error.stack);
    logger.error('Error name:', error.name);
    
    // Return detailed error in development
    const errorMessage = process.env.NODE_ENV === 'development' 
      ? error.message 
      : 'Internal server error';
    
    return res.status(500).json({
      success: false,
      message: 'Failed to onboard school',
      error: errorMessage,
      code: 500,
      ...(process.env.NODE_ENV === 'development' && {
        details: error.stack,
        errorName: error.name
      })
    });
  }
};

/**
 * Get onboarding status/information (SuperAdmin only)
 */
const getOnboardingInfo = async (req, res) => {
  try {
    const totalInstitutions = await Institution.countDocuments({ Status: true });
    const inactiveInstitutions = await Institution.countDocuments({ Status: false });
    const totalAdminUsers = await User.countDocuments({ UserType: 'Admin' });
    const totalSuperAdmins = await User.countDocuments({ UserType: 'SuperAdmin' });
    
    // Get recent institutions
    const recentInstitutions = await Institution.find({ Status: true })
      .sort({ createdAt: -1 })
      .limit(10)
      .select('Instution_Id Instution_Name Email Status createdAt');
    
    return res.json({
      success: true,
      message: 'Onboarding information retrieved successfully',
      code: 200,
      data: {
        totalInstitutions,
        inactiveInstitutions,
        totalAdminUsers,
        totalSuperAdmins,
        systemStatus: 'Active',
        recentInstitutions: recentInstitutions.map(inst => ({
          institutionId: inst.Instution_Id,
          name: inst.Instution_Name,
          email: inst.Email,
          status: inst.Status,
          createdAt: inst.createdAt
        }))
      }
    });
  } catch (error) {
    logger.error('Error getting onboarding info:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve onboarding information',
      error: error.message,
      code: 500
    });
  }
};

/**
 * Get public onboarding information (no sensitive data)
 */
const getPublicInfo = async (req, res) => {
  try {
    const totalInstitutions = await Institution.countDocuments({ Status: true });
    
    return res.json({
      success: true,
      message: 'Public onboarding information retrieved successfully',
      code: 200,
      data: {
        totalInstitutions,
        systemStatus: 'Active'
      }
    });
  } catch (error) {
    logger.error('Error getting public onboarding info:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve public onboarding information',
      error: error.message,
      code: 500
    });
  }
};

/**
 * Public list of institutions (basic fields only)
 */
const listInstitutionsPublic = async (req, res) => {
  try {
    const institutions = await Institution.find({})
      .sort({ createdAt: -1 })
      .lean();

    // Attach one admin user (email + username) per institution
    const institutionCodes = institutions.map((inst) => inst.Instution_Id).filter(Boolean);
    const admins = await User.find({
      InstutionCode: { $in: institutionCodes },
      UserType: 'Admin',
    })
      .select('Email UserName InstutionCode')
      .lean();

    const adminByCode = {};
    admins.forEach((u) => {
      if (!adminByCode[u.InstutionCode]) {
        adminByCode[u.InstutionCode] = u;
      }
    });

    return res.json({
      success: true,
      message: 'Institutions retrieved successfully',
      code: 200,
      data: institutions.map((inst) => {
        const admin = adminByCode[inst.Instution_Id] || null;
        return {
          ...inst,
          AdminEmail: admin?.Email || null,
          AdminUserName: admin?.UserName || null,
        };
      }),
    });
  } catch (error) {
    logger.error('Error listing institutions (public):', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve institutions',
      error: error.message,
      code: 500,
    });
  }
};

/**
 * Activate/Deactivate institution (SuperAdmin only)
 */
const updateInstitutionStatus = async (req, res) => {
  try {
    const institutionId = String(req.body.institutionId || req.body.Instution_Id || '').trim();
    const status = req.body.status;

    if (!institutionId) {
      return res.status(400).json({
        success: false,
        message: 'institutionId is required',
        code: 400,
      });
    }

    if (typeof status !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'status must be boolean (true/false)',
        code: 400,
      });
    }

    const updated = await Institution.findOneAndUpdate(
      { Instution_Id: institutionId },
      { $set: { Status: status } },
      { new: true }
    ).lean();

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: 'Institution not found',
        code: 404,
      });
    }

    return res.status(200).json({
      success: true,
      message: `Institution ${status ? 'activated' : 'deactivated'} successfully`,
      code: 200,
      data: updated,
    });
  } catch (error) {
    logger.error('Error updating institution status:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update institution status',
      error: error.message,
      code: 500,
    });
  }
};

module.exports = {
  onboardSchool,
  getOnboardingInfo,
  getPublicInfo,
  listInstitutionsPublic,
  updateInstitutionStatus,
};

