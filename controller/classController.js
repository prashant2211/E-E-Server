const { response }         = require('express')
const mongoose             = require('mongoose')
const classModel           = require('../models/classModel')
const { getPermissionSet } = require('./permissionAssinment');
const studentModel = require('../models/studentModel')
const mongoErrorMessages = require('./mongoErrors.json');



//Show the list of class

const index = async (req, res, next) => {
    try {
        if (!req.user || !req.user.InstutionCode) {
            return res.status(401).json({
                code: 401,
                success: false,
                message: 'User authentication required'
            });
        }

        let permissionsResult;
        try {
            permissionsResult = await getPermissionSet(req);
        } catch (permError) {
            console.error('Error getting permissions:', permError);
            // Default to Admin permissions if permission check fails
            permissionsResult = {
                classes: 'R-W-E-D-RA'
            };
        }

        // Safety check for permissions
        if (!permissionsResult || !permissionsResult.classes) {
            console.error('Permission check failed:', { 
                permissionsResult, 
                userType: req.user?.UserType,
                hasPermissionSet: !!req.user?.PermissionSet
            });
            // Default to Admin permissions if no permissions found
            permissionsResult = {
                classes: 'R-W-E-D-RA'
            };
        }

        const classPermissions = typeof permissionsResult.classes === 'string' 
            ? permissionsResult.classes 
            : (permissionsResult.classes?.toString() || 'R-W-E-D-RA');

        // Ensure classPermissions is a string before splitting
        const permissionsArray = String(classPermissions).split("-");
        if (!permissionsArray.includes('RA') && !permissionsArray.includes('R')) {
            return res.status(403).json({
                code: 403,
                success: false,
                message: 'You do not have the necessary permissions to access this resource. Please contact your administrator.'
            });
        }

        const page = parseInt(req.query.PageNumber) || 1;
        const limit = parseInt(req.query.PageSize) || 10;
        const skip = (page - 1) * limit;
        
        // Build search condition to only get classes for the logged-in user's institution
        let searchCondition = {
            InstutionCode: req.user.InstutionCode
        };
        
        console.log('Fetching classes with condition:', searchCondition);
        console.log('User info:', { 
            InstutionCode: req.user.InstutionCode, 
            UserType: req.user.UserType 
        });
        
        // Fetch filtered classes and count in parallel with pagination
        let classes, totalCount;
        try {
            [classes, totalCount] = await Promise.all([
                classModel.find(searchCondition).skip(skip).limit(limit).sort({ createdAt: -1 }).lean(),
                classModel.countDocuments(searchCondition)
            ]);
            console.log(`Found ${classes.length} classes, total: ${totalCount}`);
        } catch (dbError) {
            console.error('Database query error:', dbError);
            throw dbError;
        }

        // Convert to plain objects (already done with .lean(), but ensure clean data)
        const classesData = classes.map(cls => {
            try {
                const cleanClass = { ...cls };
                // Ensure Subject_List_Teacher_Code exists and is an array (backward compatibility)
                if (!cleanClass.Subject_List_Teacher_Code || !Array.isArray(cleanClass.Subject_List_Teacher_Code)) {
                    cleanClass.Subject_List_Teacher_Code = [];
                }
                return cleanClass;
            } catch (err) {
                console.error('Error processing class:', err, cls);
                return {
                    ...cls,
                    Subject_List_Teacher_Code: []
                };
            }
        });

        res.status(200).json({
            code: 200,
            success: true,
            message: "Data retrieved successfully",
            totalRecords: totalCount,
            data: classesData
        });
    } catch (error) {
        console.error('Error fetching classes - Full error:', error);
        console.error('Error stack:', error.stack);
        console.error('Error name:', error.name);
        console.error('Error message:', error.message);
        
        const matchedKey = Object.keys(mongoErrorMessages).find(key => error.message.includes(key));
        const errorMessage = matchedKey ? mongoErrorMessages[matchedKey] : error.message;

        res.status(500).json({
            code: 500,
            success: false,
            message: errorMessage || 'Failed to fetch classes',
            error: error.message || errorMessage,
            details: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
};

// Get single Class Record

const show = async (req, res, next) =>{
    try {
        const permissionsResult = await getPermissionSet(req);
        if (!permissionsResult.classes.split("-").includes('R')) {
            return res.status(403).json({
                code: 403,
                success: false,
                message: 'You do not have the necessary permissions to access this resource. Please contact your administrator.'
            });
        }
        
        let classId = req.params.id || req.body.classId || req.query.classId
        if (!classId) {
            return res.status(400).json({
                success: false,
                message: 'Class ID is required',
                code: 400
            });
        }
        
        // Verify class belongs to user's institution
        const classRecord = await classModel.findOne({
            _id: classId,
            InstutionCode: req.user.InstutionCode
        });
        
        if (!classRecord) {
            return res.status(404).json({
                success: false,
                message: 'Class not found or access denied',
                code: 404
            });
        }
        
        res.status(200).json({  
            success: true,
            message: "Class fetched Successfully",
            code: 200,
            data: classRecord
        });
    } catch (error) {
        const matchedKey = Object.keys(mongoErrorMessages).find(key => error.message.includes(key));
        const errorMessage = matchedKey ? mongoErrorMessages[matchedKey] : error.message;

        res.status(500).json({
            success: false,
            message: errorMessage,
            code: 500,
            error: errorMessage
        });
    }
}

// TODO this is not required need to remove => Prashant
const getAllClasses = async (req, res, next) => {
    try {
        if (!req.user || !req.user.InstutionCode) {
            return res.status(401).json({
                code: 401,
                success: false,
                message: 'User authentication required'
            });
        }
        
        let finalResponse = {};
        const classList = await classModel.find({ InstutionCode: req.user.InstutionCode });
        for (const classItem of classList) {
            let subjectList = [];
            const subjectListTeacherCode = classItem.Subject_List_Teacher_Code;
            if (subjectListTeacherCode && Array.isArray(subjectListTeacherCode)) {
                for (const subjectItem of subjectListTeacherCode) {
                    if (subjectItem && subjectItem.Subject) {
                        subjectList.push(subjectItem.Subject);
                    }
                }
            }
            finalResponse[classItem.ClassName] = subjectList;
        }
        return res.status(200).json({
            success: true,
            message: "Classes fetched successfully",
            code: 200,
            data: finalResponse
        });
    } catch (error) {
        const matchedKey = Object.keys(mongoErrorMessages).find(key => error.message.includes(key));
        const errorMessage = matchedKey ? mongoErrorMessages[matchedKey] : error.message;
        return res.status(500).json({
            success: false,
            message: errorMessage,
            error: errorMessage
        });
    }
};
// TODO this is not required need to remove => Prashant
const getSubjectDetails = async (req, res, next) => {
    try {
        const permissionsResult = await getPermissionSet(req);
        if(!permissionsResult || !permissionsResult.classes || !permissionsResult.classes.split("-").includes('R')){
            return res.status(403).json({
                code: 403,
                success: false,
                message: 'You do not have the necessary permissions to access this resource. Please contact your administrator'
            });
        }

        const classList = await classModel.find({ 
            InstutionCode: req.user.InstutionCode, 
            ClassName: req.query.Class || req.body.Class
        });
        
        let subjectrec;
        for (const classItem of classList) {
            // Safely get subjects (handle backward compatibility)
            const subjectListTeacherCode = Array.isArray(classItem.Subject_List_Teacher_Code) 
                ? classItem.Subject_List_Teacher_Code 
                : [];

            for (const subjectItem of subjectListTeacherCode) {
                if(subjectItem && subjectItem.Subject === req.query.Subject){
                    subjectrec = subjectItem;
                    break;
                }
            }
            if (subjectrec) break;
        }
        
        if(subjectrec){
            return res.status(200).json({
                success: true,
                message: "Subject fetched successfully",
                code: 200,
                data: subjectrec
            });
        } else {
            return res.status(200).json({
                success: true,
                message: "Subject Not found",
                code: 200,
                data: []
            });
        }
    } catch (error) {
        console.error('Error getting subject details:', error);
        res.status(500).json({
            code: 500,
            success: false,
            message: 'Failed to fetch subject details',
            error: error.message
        });
    }
}

// TODO this is not required need to remove => Prashant

// delete subject data
const deleteSubjectDetails = async (req, res, next) => {
    try {
        const permissionsResult = await getPermissionSet(req);
        if(!permissionsResult.classes.split("-").includes('W')){
            return res.status(403).json({
                code: 403,
                success: false,
                message: 'You do not have the necessary permissions to access this resource. Please contact your administrator'
            });
        }

        const classList = await classModel.find({ InstutionCode: req.user.InstutionCode, ClassName: req.body.Class});
        if (!classList.length) {
            return res.status(404).json({
                success: false,
                code: 404,
                message: 'Class not found',
            });
        }

        let subjectrecId;
        let subjectListTeacherCode;
        for (const classItem of classList) {
            subjectListTeacherCode = classItem.Subject_List_Teacher_Code || [];
            subjectrecId = classItem._id;
            
            if (subjectListTeacherCode && Array.isArray(subjectListTeacherCode)) {
                subjectListTeacherCode = subjectListTeacherCode.filter(element => element.Subject !== req.body.Subject);
            }
        }
        
        const updatedClass = await classModel.findByIdAndUpdate(subjectrecId, { $set: {Subject_List_Teacher_Code : subjectListTeacherCode} }, { new: true });

        if (!updatedClass) {
            return res.status(404).json({
                success: false,
                code: 404,
                message: 'Subject Delition failed!',
                error: 'Subject Delition failed!'
            });
        }

        res.status(201).json({
            success: true,
            code: 201,
            message: 'Subject Deleted sucessfully',
        });
    } catch (error) {
        console.error('Error deleting subject:', error);
        const matchedKey = Object.keys(mongoErrorMessages).find(key => error.message.includes(key));
        const errorMessage = matchedKey ? mongoErrorMessages[matchedKey] : error.message;
        
        res.status(500).json({
            success: false,
            code: 500,
            message: errorMessage || 'Failed to delete subject',
            error: errorMessage
        });
    }
}
// get class based on class name
const getClassByName = async (req, res, next) => {
    try {
        const permissionsResult = await getPermissionSet(req);
        if(permissionsResult.classes.split("-").includes('R')){
            const classList = await classModel.find({ InstutionCode: req.user.InstutionCode, ClassName: req.query.Class});
            if(classList.length > 0){
                return res.status(200).json({
                    success: true,
                    message: "Classes fetched successfully",
                    code: 200,
                    data: classList
                });
            }else{
                return res.status(200).json({
                    success: true,
                    message: "Classes Not found",
                    code: 200,
                    data: []
                });
            }
        } else{
            return res.status(403).json({
                code: 403,
                success: true,
                message: 'You do not have the necessary permissions to access this resource. Please contact your administrator'
            });
        }
    } catch (error) {
        console.error('Error in getClassByName:', error);
        res.status(500).json({
            code: 500,
            success: false,
            message: 'Failed to fetch classes',
            error: error.message
        });
    }
}

// need to see weather it's required or not
// this method is create for mobile app to view the subject list
const assignedClassStudent = async (req, res, next) => {

    try{

    const studentRecord = await studentModel.find({ InstutionCode: req.user.InstutionCode,  Registration_Number: req.query.registrationNumber});

    if (!studentRecord || studentRecord.length === 0) {
        return res.status(404).json({
            success: false,
            message: 'Student not found',
            code: 404,
            data: []
        });
    }

    const classList = await classModel.find({ InstutionCode: req.user.InstutionCode, ClassName: studentRecord[0].Class});
    res.status(200).json({
        success: false,
        message: `Classes fetched successfully`,
        code: 200,
        data: classList
    });

} catch(error){
    const matchedKey = Object.keys(mongoErrorMessages).find(key => error.message.includes(key));
    const errorMessage = matchedKey ? mongoErrorMessages[matchedKey] : error.message;
         res.status(400).json({
        success: false,
        message: errorMessage,
        error: errorMessage,
        code: 400,
        data: []
    });

}


}


// Add Classes to dataBase
const store = async (req, res, next) => {
    try {
        const permissionsResult = await getPermissionSet(req);
        if(!permissionsResult.classes.split("-").includes('W')){
            return res.status(403).json({
                code: 403,
                success: false,
                message: 'You do not have the necessary permissions to access this resource. Please contact your administrator'
            });
        }

        // Validate required fields
        if (!req.body.Class_Name || !req.body.Session) {
            return res.status(400).json({
                success: false,
                code: 400,
                message: 'Class Name and Session are required fields',
                error: 'Missing required fields: Class_Name, Session'
            });
        }

        const instutionCode = req.user.InstutionCode;
        const className = req.body.Class_Name.trim();
        const session = (req.body.Session || '').trim();
        
        // Validate required fields
        if (!className) {
            return res.status(400).json({
                success: false,
                code: 400,
                message: 'Class Name is required',
                error: 'Class_Name field cannot be empty'
            });
        }

        if (!session) {
            return res.status(400).json({
                success: false,
                code: 400,
                message: 'Session is required',
                error: 'Session field cannot be empty'
            });
        }
        
        // Generate ClassCode: instutionCode-className-last2digiOfTheYear
        // Format: EES-001-5th-24 (for year 2024)
        const currentYear = new Date().getFullYear();
        const last2Digits = currentYear.toString().slice(-2);
        
        // Clean className: remove spaces, special chars, convert to lowercase for consistency
        const cleanClassName = className.replace(/\s+/g, '').toLowerCase();
        const classCode = `${instutionCode}-${cleanClassName}-${last2Digits}`;
        console.log('-=-=-=- classCode -=-=- '+classCode);
        // console.log('Creating class:', {
        //     instutionCode,
        //     className,
        //     cleanClassName,
        //     session,
        //     classCode,
        //     year: last2Digits
        // });

        // Check if ClassCode already exists for this institution (only duplicate if entire ClassCode matches exactly)
        // console.log('Checking for duplicate ClassCode:', {
        //     classCode: classCode,
        //     instutionCode: instutionCode,
        //     className: className
        // });
       // console.log('-=-=-=- existingClass -=-=- '+existingClass);
        console.log('-=-=-=- instutionCode -=-=- '+instutionCode);
        console.log('-=-=-=- classCode -=-=- '+classCode);
        const existingClass = await classModel.findOne({
            ClassCode: classCode,
            InstutionCode: instutionCode  // Also check institution to ensure proper isolation
        });
        console.log('-=-=-=- existingClass -=-=- '+existingClass);

        if (existingClass) {
            console.log(' inside deplicate if condition');
            console.log('Duplicate ClassCode found:', {
                requested: classCode,
                existing: existingClass.ClassCode,
                existingClassName: existingClass.ClassName,
                existingSession: existingClass.Session,
                existingInstutionCode: existingClass.InstutionCode,
                requestedInstutionCode: instutionCode
            });
            return res.status(400).json({
                success: false,
                code: 400,
                message: `ClassCode "${classCode}" already exists for your institution`,
                error: `A class with ClassCode "${classCode}" already exists. Existing class: "${existingClass.ClassName}" (Session: "${existingClass.Session}"). Please use a different class name.`,
                existingClass: {
                    ClassName: existingClass.ClassName,
                    ClassCode: existingClass.ClassCode,
                    Session: existingClass.Session,
                    InstutionCode: existingClass.InstutionCode
                },
                requestedClassCode: classCode
            });
        }
        
        console.log('No duplicate found, proceeding with class creation');

        // Validate ClassCode is not null/empty before saving
        if (!classCode || classCode.trim() === '') {
            console.log(`Inside 2nd condition -=-=-=`);
            return res.status(400).json({
                success: false,
                code: 400,
                message: 'Failed to generate ClassCode',
                error: 'ClassCode cannot be null or empty. Please check Class_Name and InstutionCode.'
            });
        }
        console.log(`before structuring -=-=-=`);
        console.log(`classCode1 -=-=- `+classCode.trim());
        console.log(`instutionCode1 -=-=- `+instutionCode);
        console.log(`className1 -=-=- `+className); 
        console.log(`Session_Start_Day1 -=-=- `+req.body.Session_Start_Day);
        console.log(`Session_End_Day1 -=-=- `+req.body.Session_End_Day);
        console.log(`Session1 -=-=- `+req.body.Session);
        let classRecord = new classModel({
            ClassCode: classCode.trim(),
            InstutionCode: instutionCode,
            ClassName: className,
            Session_Start_Day: req.body.Session_Start_Day,
            Session_End_Day: req.body.Session_End_Day,
            Session: req.body.Session 
        });
        console.log(`classRecord -=-=- `+JSON.stringify(classRecord));
        await classRecord.save();
        console.log(`status  -=-=-=${res.status}`);;
        res.status(201).json({
            success: true,
            code: 201,
            message: 'Class Added Successfully!',
            data: classRecord
        });
    } catch (error) {
        console.error('Error creating class:', error);
        console.error('Error details:', {
            code: error.code,
            keyPattern: error.keyPattern,
            keyValue: error.keyValue,
            message: error.message
        });
        
        // Handle duplicate key error specifically (MongoDB E11000)
        console.log(`error.keyValue -=-=-=- ${error.keyValue}`);
        if (error.code === 11000) {
            const duplicateFields = Object.keys(error.keyPattern || {});
            const duplicateValues = error.keyValue || {};
            
            // Get the actual duplicate ClassCode value
            // Try multiple ways to extract the duplicate value
            let duplicateClassCode = null;
            
            // MongoDB error.keyValue might have different field name formats
            if (duplicateValues.ClassCode) {
                duplicateClassCode = duplicateValues.ClassCode;
            } else if (duplicateValues.classCode) {
                duplicateClassCode = duplicateValues.classCode;
            } else if (duplicateValues.Class_Code) {  // Handle underscore version
                duplicateClassCode = duplicateValues.Class_Code;
            } else if (duplicateValues.class_code) {
                duplicateClassCode = duplicateValues.class_code;
            } else if (duplicateFields.includes('ClassCode') || duplicateFields.includes('Class_Code')) {
                // Get first value from keyValue object
                duplicateClassCode = Object.values(duplicateValues)[0];
            }
            
            // If still not found, try to extract from error message
            if (!duplicateClassCode && error.message) {
                const match = error.message.match(/ClassCode[:\s]+["']?([^"'\s}]+)["']?/i);
                if (match) {
                    duplicateClassCode = match[1];
                }
            }
            
            // Last resort: reconstruct from the request
            if (!duplicateClassCode) {
                const instutionCode = req.user?.InstutionCode;
                const className = req.body?.Class_Name?.trim();
                if (instutionCode && className) {
                    const currentYear = new Date().getFullYear();
                    const last2Digits = currentYear.toString().slice(-2);
                    const cleanClassName = className.replace(/\s+/g, '').toLowerCase();
                    duplicateClassCode = `${instutionCode}-${cleanClassName}-${last2Digits}`;
                }
            }
            
            // console.error('MongoDB Duplicate Key Error:', {
            //     duplicateFields,
            //     duplicateValues,
            //     duplicateClassCode,
            //     keyPattern: error.keyPattern,
            //     keyValue: error.keyValue,
            //     errorMessage: error.message
            // });
            
            // Find the existing class that's causing the conflict
            // Query database directly using ClassName + InstutionCode + Session (most reliable)
            let existingClassInfo = null;
            try {
                const instutionCode = req.user?.InstutionCode;
                const className = req.body?.Class_Name?.trim();
                const session = req.body?.Session;
                
                // First, try to find by ClassName + InstutionCode + Session (most reliable)
                if (instutionCode && className && session) {
                    existingClassInfo = await classModel.findOne({
                        InstutionCode: instutionCode,
                        ClassName: className,
                        Session: session
                    }).select('ClassName ClassCode Session InstutionCode').lean();
                    
                    if (existingClassInfo) {
                        duplicateClassCode = existingClassInfo.ClassCode;
                        console.log(`Found existing class by name + session: "${className}" → ClassCode: "${duplicateClassCode}"`);
                    }
                }
                
                // If not found, try by ClassCode + InstutionCode
                if (!existingClassInfo && duplicateClassCode && instutionCode) {
                    existingClassInfo = await classModel.findOne({
                        ClassCode: duplicateClassCode,
                        InstutionCode: instutionCode
                    }).select('ClassName ClassCode Session InstutionCode').lean();
                }
                
                // Last resort: search by ClassName only (same institution)
                if (!existingClassInfo && instutionCode && className) {
                    const existingClasses = await classModel.find({
                        InstutionCode: instutionCode,
                        ClassName: className
                    }).select('ClassName ClassCode Session InstutionCode').lean();
                    
                    if (existingClasses.length > 0) {
                        existingClassInfo = existingClasses[0];
                        duplicateClassCode = existingClassInfo.ClassCode;
                        console.log(`Found existing class by name: "${className}" → ClassCode: "${duplicateClassCode}"`);
                    }
                }
            } catch (lookupError) {
                console.error('Error looking up existing class:', lookupError);
            }
            
            // Build error message
            let errorMessage = duplicateClassCode 
                ? `ClassCode "${duplicateClassCode}" already exists.`
                : 'A class with this ClassCode already exists.';
                
            if (existingClassInfo) {
                errorMessage = `ClassCode "${duplicateClassCode || existingClassInfo.ClassCode}" already exists. Existing class: "${existingClassInfo.ClassName}" (Session: "${existingClassInfo.Session}"). Please use a different class name or session.`;
            } else if (duplicateClassCode) {
                errorMessage = `ClassCode "${duplicateClassCode}" already exists. Please use a different class name.`;
            }
            
            return res.status(400).json({
                success: false,
                code: 400,
                message: errorMessage,
                error: errorMessage,
                duplicateField: duplicateFields[0] || 'ClassCode',
                duplicateValue: duplicateClassCode || 'unknown',
                existingClass: existingClassInfo,
                requestedClassCode: duplicateClassCode || 'unknown',
                debug: {
                    keyPattern: error.keyPattern,
                    keyValue: error.keyValue,
                    duplicateFields: duplicateFields
                }
            });
        }

        const matchedKey = Object.keys(mongoErrorMessages).find(key => error.message.includes(key));
        const errorMessage = matchedKey ? mongoErrorMessages[matchedKey] : error.message;

        res.status(500).json({
            success: false,
            code: 500,
            message: errorMessage || 'Failed to create class',
            error: error.message || errorMessage
        });
    }
}
// TODO need to remove it from here
const addClassSubjectListDetails = async (req, res, next) => {
    try {
        const permissionsResult = await getPermissionSet(req);

        if (!permissionsResult.classes.split("-").includes('W')) {
            return res.status(403).json({
                code: 403,
                success: false,
                message: 'You do not have the necessary permissions to access this resource. Please contact your administrator'
            });
        }

        const classList = await classModel.find({
            InstutionCode: req.user.InstutionCode,
            ClassName: req.body.Class
        });

        if (!classList.length) {
            return res.status(404).json({
                success: false,
                code: 404,
                message: 'No class found with the provided details.',
            });
        }

        let updateResults = [];

        for (const classItem of classList) {
            const classId = classItem._id;

            // Safely get existing subjects (handle backward compatibility)
            const existingSubjects = Array.isArray(classItem.Subject_List_Teacher_Code) 
                ? classItem.Subject_List_Teacher_Code 
                : [];
            
            // Get new subjects and check for duplicates
            const newSubjects = Array.isArray(req.body.subjectDetails) ? req.body.subjectDetails : [];
            
            // Filter out duplicates - only add subjects that don't already exist
            const existingSubjectNames = existingSubjects.map(s => s.Subject?.toLowerCase());
            const uniqueNewSubjects = newSubjects.filter(newSub => {
                const subjectName = newSub.Subject?.toLowerCase();
                return subjectName && !existingSubjectNames.includes(subjectName);
            });
            
            const updatedSubjects = [...existingSubjects, ...uniqueNewSubjects];

            const updatedClass = await classModel.findByIdAndUpdate(
                classId,
                { $set: { Subject_List_Teacher_Code: updatedSubjects } },
                { new: true }
            );

            updateResults.push(updatedClass);
        }

        return res.status(201).json({
            success: true,
            code: 201,
            message: 'Class subjects updated successfully!',
            data: updateResults
        });

    } catch (err) {
        console.error(err);
        next(err);
    }
};


///////////////////////////
// todo need to remove it from here
const addClassSubjectDetails = async (req, res, next) =>{
    try {
        const permissionsResult = await getPermissionSet(req);
        if(!permissionsResult || !permissionsResult.classes || !permissionsResult.classes.split("-").includes('W')){
            return res.status(403).json({
                code: 403,
                success: false,
                message: 'You do not have the necessary permissions to access this resource. Please contact your administrator'
            });
        }

        if (!req.body.Class || !req.body.Subject) {
            return res.status(400).json({
                success: false,
                code: 400,
                message: 'Class name and Subject are required',
            });
        }

        const classList = await classModel.find({ InstutionCode: req.user.InstutionCode, ClassName: req.body.Class });
        if (!classList.length) {
            return res.status(404).json({
                success: false,
                code: 404,
                message: 'Class not found',
            });
        }

        let classId;
        let finalArray = [];
        
        for (const classItem of classList) {
            classId = classItem._id;
            const subjectData = {
                Subject: req.body.Subject,
                Teacher_Code: req.body.Teacher_Code || '',
                Teacher_Name: req.body.Teacher_Name || '',
                Teacher_Id: req.body.Teacher_Id || null,
            };
            
            // Safely get existing subjects (handle backward compatibility)
            const existingSubjects = Array.isArray(classItem.Subject_List_Teacher_Code) 
                ? classItem.Subject_List_Teacher_Code 
                : [];
            
            // Check if subject already exists
            const subjectExists = existingSubjects.some(s => s.Subject === req.body.Subject);
            if (subjectExists) {
                return res.status(400).json({
                    success: false,
                    code: 400,
                    message: 'Subject already exists in this class',
                });
            }
            
            finalArray = [subjectData, ...existingSubjects];
            break; // Only update the first matching class
        }

        if (!classId) {
            return res.status(404).json({
                success: false,
                code: 404,
                message: 'Class not found',
            });
        }

        const updatedClass = await classModel.findByIdAndUpdate(
            classId, 
            { $set: { Subject_List_Teacher_Code: finalArray } }, 
            { new: true }
        );

        if (!updatedClass) {
            return res.status(404).json({
                success: false,
                code: 404,
                message: 'Class not found or update failed!',
            });
        }

        res.status(201).json({
            success: true,
            code: 201,
            message: 'Subject added successfully!',
            data: updatedClass
        });
    } catch (error) {
        console.error('Error adding subject:', error);
        const matchedKey = Object.keys(mongoErrorMessages).find(key => error.message.includes(key));
        const errorMessage = matchedKey ? mongoErrorMessages[matchedKey] : error.message;
        
        res.status(500).json({
            success: false,
            code: 500,
            message: errorMessage || 'Failed to add subject',
            error: errorMessage
        });
    }
}


// update Class record
const update = async (req, res, next) =>{
    try {
        const permissionsResult = await getPermissionSet(req);
        if(!permissionsResult.classes.split("-").includes('RA')){
            return res.status(403).json({
                code: 403,
                success: false,
                message: 'You do not have the necessary permissions to access this resource. Please contact your administrator'
            });
        }

        if (!req.user || !req.user.InstutionCode) {
            return res.status(401).json({
                code: 401,
                success: false,
                message: 'User authentication required'
            });
        }

        let classId = req.body.classId;
        if (!classId) {
            return res.status(400).json({
                success: false,
                code: 400,
                message: 'Class ID is required'
            });
        }

        // Verify class exists and belongs to user's institution
        const existingClass = await classModel.findOne({
            _id: classId,
            InstutionCode: req.user.InstutionCode
        });

        if (!existingClass) {
            return res.status(404).json({
                success: false,
                code: 404,
                message: 'Class not found or access denied'
            });
        }

        // Build update data with correct field names
        let updateData = {};
        if (req.body.Number_Of_Student !== undefined) updateData.Number_Of_Student = req.body.Number_Of_Student;
        if (req.body.ClassName !== undefined) updateData.ClassName = req.body.ClassName;
        if (req.body.Session_Start_Day !== undefined) updateData.Session_Start_Day = req.body.Session_Start_Day;
        if (req.body.Session_End_Day !== undefined) updateData.Session_End_Day = req.body.Session_End_Day;
        if (req.body.Session !== undefined) updateData.Session = req.body.Session;

        const updatedClass = await classModel.findByIdAndUpdate(
            classId,
            { $set: updateData },
            { new: true }
        );

        if (!updatedClass) {
            return res.status(404).json({
                success: false,
                code: 404,
                message: 'Class update failed'
            });
        }

        res.status(200).json({
            success: true,
            code: 200,
            message: 'Class updated successfully!',
            data: updatedClass
        });
    } catch (error) {
        const matchedKey = Object.keys(mongoErrorMessages).find(key => error.message.includes(key));
        const errorMessage = matchedKey ? mongoErrorMessages[matchedKey] : error.message;
        res.status(500).json({
            success: false,
            code: 500,
            message: errorMessage || 'Failed to update class',
            error: errorMessage
        });
    }
}

// delete an Class  => Only super admin can access this feature

const destroy = async (req, res, next) =>{
    try {
        const permissionsResult = await getPermissionSet(req);
        if(!permissionsResult.classes.split("-").includes('RA')){
            return res.status(403).json({
                code: 403,
                success: false,
                message: 'You do not have the necessary permissions to access this resource. Please contact your administrator'
            });
        }

        if (!req.user || !req.user.InstutionCode) {
            return res.status(401).json({
                code: 401,
                success: false,
                message: 'User authentication required'
            });
        }

        let classId = req.body.classId;
        if (!classId) {
            return res.status(400).json({
                success: false,
                code: 400,
                message: 'Class ID is required'
            });
        }

        // Verify class exists and belongs to user's institution before deletion
        const existingClass = await classModel.findOne({
            _id: classId,
            InstutionCode: req.user.InstutionCode
        });

        if (!existingClass) {
            return res.status(404).json({
                success: false,
                code: 404,
                message: 'Class not found or access denied'
            });
        }

        const deletedClass = await classModel.findByIdAndDelete(classId);

        if (!deletedClass) {
            return res.status(404).json({
                success: false,
                code: 404,
                message: 'Class deletion failed'
            });
        }

        res.status(200).json({
            success: true,
            code: 200,
            message: 'Class deleted successfully'
        });
    } catch (error) {
        const matchedKey = Object.keys(mongoErrorMessages).find(key => error.message.includes(key));
        const errorMessage = matchedKey ? mongoErrorMessages[matchedKey] : error.message;
        res.status(500).json({
            success: false,
            code: 500,
            message: errorMessage || 'Failed to delete class',
            error: errorMessage
        });
    }
}

module.exports = {
    index, show, store, update, destroy, getAllClasses, getClassByName, addClassSubjectDetails, 
    addClassSubjectListDetails, getSubjectDetails, deleteSubjectDetails, assignedClassStudent
}