const User = require('../models/User');
const bcrypt = require('bcryptjs');
const { logger } = require('../utils/logger');
const { successResponse, errorResponse } = require('../utils/response');
const { getPermissionSet } = require('./permissionAssinment');
const nodemailer = require('nodemailer');

/**
 * Get all available user types for staff onboarding
 */
const getAvailableUserTypes = async (req, res) => {
  try {
    const permissionsResult = await getPermissionSet(req);
    const allowedRoles = ['Admin', 'SuperAdmin'];
    
    if (!allowedRoles.includes(req.user?.UserType)) {
      return res.status(403).json({
        code: 403,
        success: false,
        message: 'You do not have permission to view user types. Only Admin can access this.'
      });
    }

    const userTypes = [
      { value: 'Teacher', label: 'Teacher', description: 'Teaching staff who manage classes and students' },
      { value: 'Admission Staff', label: 'Admission Staff', description: 'Manages student admissions and inquiries' },
      { value: 'Reception Staff', label: 'Reception Staff', description: 'Handles front desk and initial inquiries' },
      { value: 'Inventory Staff', label: 'Inventory Staff', description: 'Manages school inventory and supplies' },
      { value: 'Library Staff', label: 'Library Staff', description: 'Manages library books and transactions' },
      { value: 'Examination Staff', label: 'Examination Staff', description: 'Manages exams, schedules, and student marksheets' },
      { value: 'Accounts Coordinator', label: 'Accounts Coordinator', description: 'Handles fees, payments, and finances' },
      { value: 'Mentor', label: 'Mentor', description: 'Tracks student progress and manages classes' },
    ];

    return successResponse(res, userTypes, 'User types retrieved successfully');
  } catch (error) {
    logger.error('Error fetching user types:', error);
    return errorResponse(res, 'Failed to fetch user types', 500);
  }
};

/**
 * Onboard new staff member
 */
const onboardStaff = async (req, res) => {
  try {
    const permissionsResult = await getPermissionSet(req);
    const allowedRoles = ['Admin', 'SuperAdmin'];
    
    if (!allowedRoles.includes(req.user?.UserType)) {
      return res.status(403).json({
        code: 403,
        success: false,
        message: 'You do not have permission to onboard staff. Only Admin can access this.'
      });
    }

    const {
      FirstName,
      LastName,
      Email,
      Phone,
      UserName,
      UserType,
      MemberId,
      Password,
      Department,
      Designation,
      JoiningDate,
      Address,
      EmergencyContact,
      EmergencyPhone,
      Adhar,
    } = req.body;

    // Validation
    if (!FirstName || !LastName || !Email || !Phone || !UserName || !UserType || !Password) {
      return errorResponse(res, 'Please provide all required fields', 400);
    }

    // Get institution details from current user - never hardcode institution name
    const instutionCode = req.user?.InstutionCode;
    const instutionName = req.user?.InstutionName || 'Your Institution';

    if (!instutionCode) {
      return errorResponse(res, 'Institution code not found. Please ensure you are logged in correctly.', 400);
    }

    // Generate Member ID dynamically if not provided
    let finalMemberId = MemberId;
    if (!finalMemberId) {
      // Generate Member ID: INST-CODE-USER-TYPE-XXXX
      // Format: EES-001-INV-0002 (sequential number across all staff)
      const userTypePrefix = UserType.substring(0, 3).toUpperCase();
      
      // Get count of ALL staff (excluding students) for this institution
      // Sequential number across all staff types
      const staffCount = await User.countDocuments({
        InstutionCode: instutionCode,
        UserType: { $ne: 'Student' } // Exclude students
      });
      
      // Sequential number across all staff types
      const sequence = String(staffCount + 1).padStart(4, '0');
      finalMemberId = `${instutionCode}-${userTypePrefix}-${sequence}`;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(Email)) {
      return errorResponse(res, 'Invalid email format', 400);
    }

    // Validate phone format (basic)
    if (Phone.length < 10) {
      return errorResponse(res, 'Invalid phone number', 400);
    }

    // Validate password strength
    if (Password.length < 6) {
      return errorResponse(res, 'Password must be at least 6 characters long', 400);
    }

    // Ensure Member ID is unique - regenerate if needed
    let attempts = 0;
    let existingUser = null;
    
    while (attempts < 10) {
      existingUser = await User.findOne({
        $or: [
          { Email: Email },
          { Phone: Phone },
          { UserName: UserName },
          { MemberId: finalMemberId }
        ]
      });

      if (existingUser) {
        // If Member ID conflict, regenerate it with next sequential number
        if (existingUser.MemberId === finalMemberId && !MemberId) {
          const userTypePrefix = UserType.substring(0, 3).toUpperCase();
          const staffCount = await User.countDocuments({
            InstutionCode: instutionCode,
            UserType: { $ne: 'Student' }
          });
          finalMemberId = `${instutionCode}-${userTypePrefix}-${String(staffCount + attempts + 2).padStart(4, '0')}`;
          attempts++;
          continue;
        } else {
          // Other field conflict (email, phone, username) or manual MemberId conflict
          return errorResponse(res, 'User with this email, phone, username, or member ID already exists', 400);
        }
      }
      break;
    }

    if (attempts >= 10) {
      return errorResponse(res, 'Unable to generate unique Member ID. Please try again or use manual entry.', 500);
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(Password, 10);

    // Generate username if not provided
    const finalUserName = UserName || `${FirstName.toLowerCase()}.${LastName.toLowerCase()}`;


    // Create new user
    const newUser = new User({
      FirstName,
      LastName,
      Email,
      Phone,
      UserName: finalUserName,
      Password: hashedPassword,
      UserType,
      MemberId: finalMemberId,
      InstutionCode: instutionCode,
      InstutionName: instutionName,
      PermissionSet: '', // Will be set based on UserType
      Verified: false, // Will be verified via email
      Department: Department || '',
      Designation: Designation || '',
      JoiningDate: JoiningDate || new Date(),
      Address: Address || '',
      EmergencyContact: EmergencyContact || '',
      EmergencyPhone: EmergencyPhone || '',
      Adhar: Adhar && Adhar.trim() !== '' ? Adhar.trim() : undefined,
    });

    const savedUser = await newUser.save();

    // Send welcome email (optional - configure email settings)
    try {
      await sendWelcomeEmail(savedUser, Password, instutionName);
    } catch (emailError) {
      logger.error('Error sending welcome email:', emailError);
      // Don't fail the request if email fails
    }

    // Remove password from response
    const userResponse = savedUser.toObject();
    delete userResponse.Password;

    return successResponse(res, userResponse, 'Staff member onboarded successfully', 201);
  } catch (error) {
    logger.error('Error onboarding staff:', error);
    
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return errorResponse(res, `${field} already exists`, 400);
    }
    
    return errorResponse(res, 'Failed to onboard staff member', 500);
  }
};

/**
 * Get all staff members
 */
const getAllStaff = async (req, res) => {
  try {
    const permissionsResult = await getPermissionSet(req);
    const allowedRoles = ['Admin', 'SuperAdmin'];
    
    if (!allowedRoles.includes(req.user?.UserType)) {
      return res.status(403).json({
        code: 403,
        success: false,
        message: 'You do not have permission to view staff. Only Admin can access this.'
      });
    }

    const page = parseInt(req.query.PageNumber) || 1;
    const limit = parseInt(req.query.PageSize) || 10;
    const skip = (page - 1) * limit;
    const searchText = req.query.SearchText || '';
    const userTypeFilter = req.query.UserType;

    let searchCondition = {
      InstutionCode: req.user?.InstutionCode,
      UserType: { $ne: 'Student' }, // Exclude students
    };

    if (userTypeFilter) {
      searchCondition.UserType = userTypeFilter;
    }

    if (searchText) {
      searchCondition.$or = [
        { FirstName: { $regex: searchText, $options: 'i' } },
        { LastName: { $regex: searchText, $options: 'i' } },
        { Email: { $regex: searchText, $options: 'i' } },
        { Phone: { $regex: searchText, $options: 'i' } },
        { MemberId: { $regex: searchText, $options: 'i' } },
      ];
    }

    const [staff, totalCount] = await Promise.all([
      User.find(searchCondition)
        .select('-Password -__v')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      User.countDocuments(searchCondition)
    ]);

    const result = {
      staff,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalCount / limit),
        totalItems: totalCount,
        itemsPerPage: limit
      }
    };

    return successResponse(res, result, 'Staff members retrieved successfully');
  } catch (error) {
    logger.error('Error fetching staff:', error);
    return errorResponse(res, 'Failed to fetch staff members', 500);
  }
};

/**
 * Update staff member
 */
const updateStaff = async (req, res) => {
  try {
    const permissionsResult = await getPermissionSet(req);
    const allowedRoles = ['Admin', 'SuperAdmin'];
    
    if (!allowedRoles.includes(req.user?.UserType)) {
      return res.status(403).json({
        code: 403,
        success: false,
        message: 'You do not have permission to update staff. Only Admin can access this.'
      });
    }

    const staffId = req.params.id || req.body.staffId;
    const updateData = { ...req.body };

    // Remove fields that shouldn't be updated
    delete updateData.Password;
    delete updateData._id;
    delete updateData.InstutionCode;
    delete updateData.createdAt;
    delete updateData.updatedAt;

    // If password is being updated, hash it
    if (req.body.Password) {
      updateData.Password = await bcrypt.hash(req.body.Password, 10);
    }

    const updatedStaff = await User.findOneAndUpdate(
      { _id: staffId, InstutionCode: req.user?.InstutionCode },
      { $set: updateData },
      { new: true, runValidators: true }
    ).select('-Password -__v');

    if (!updatedStaff) {
      return errorResponse(res, 'Staff member not found', 404);
    }

    return successResponse(res, updatedStaff, 'Staff member updated successfully');
  } catch (error) {
    logger.error('Error updating staff:', error);
    return errorResponse(res, 'Failed to update staff member', 500);
  }
};

/**
 * Delete staff member
 */
const deleteStaff = async (req, res) => {
  try {
    const permissionsResult = await getPermissionSet(req);
    const allowedRoles = ['Admin', 'SuperAdmin'];
    
    if (!allowedRoles.includes(req.user?.UserType)) {
      return res.status(403).json({
        code: 403,
        success: false,
        message: 'You do not have permission to delete staff. Only Admin can access this.'
      });
    }

    const staffId = req.params.id || req.body.staffId;

    // Prevent deleting own account
    if (staffId === req.user?._id?.toString()) {
      return errorResponse(res, 'You cannot delete your own account', 400);
    }

    const deletedStaff = await User.findOneAndDelete({
      _id: staffId,
      InstutionCode: req.user?.InstutionCode,
      UserType: { $ne: 'Student' }
    });

    if (!deletedStaff) {
      return errorResponse(res, 'Staff member not found', 404);
    }

    return successResponse(res, null, 'Staff member deleted successfully');
  } catch (error) {
    logger.error('Error deleting staff:', error);
    return errorResponse(res, 'Failed to delete staff member', 500);
  }
};

/**
 * Send welcome email to new staff member
 */
const sendWelcomeEmail = async (user, password, institutionName = 'Your Institution') => {
  try {
    // Configure email transporter (update with your email settings)
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: process.env.SMTP_PORT || 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    const mailOptions = {
      from: process.env.SMTP_USER || process.env.ORGANIZATION_EMAIL || 'noreply@erpsystem.com',
      to: user.Email,
      subject: `Welcome to ${institutionName} ERP`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1890ff;">Welcome to ${institutionName} ERP!</h2>
          <p>Dear ${user.FirstName} ${user.LastName},</p>
          <p>Your account has been created successfully. Here are your login credentials:</p>
          <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p><strong>Username:</strong> ${user.UserName}</p>
            <p><strong>Email:</strong> ${user.Email}</p>
            <p><strong>Password:</strong> ${password}</p>
            <p><strong>User Type:</strong> ${user.UserType}</p>
          </div>
          <p>Please login and change your password after first login.</p>
          <p>Login URL: ${process.env.FRONTEND_URL || 'http://localhost:3000/login'}</p>
          <p>Best regards,<br>${institutionName} Team</p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    logger.info(`Welcome email sent to ${user.Email}`);
  } catch (error) {
    logger.error('Error sending welcome email:', error);
    throw error;
  }
};

module.exports = {
  getAvailableUserTypes,
  onboardStaff,
  getAllStaff,
  updateStaff,
  deleteStaff
};

