const { response }             = require('express')
const permissionAssinment      = require('../models/permissionAssinment')

// Default Permission - Must be defined before functions that use it
const data = {
  SuperAdmin:{
    students: "R-W-E-D-RA",
    teachers: "R-W-E-D-RA",
    admissions: "R-W-E-D-RA",
    classes: "R-W-E-D-RA",
    instutions: "R-W-E-D-RA",
    managementDetails: "R-W-E-D-RA",
    Staff_salary: "R-W-E-D-RA",
    staff_salaryDetails: "R-W-E-D-RA",
    Staff_salary_payment_details: "R-W-E-D-RA",
    staffJobForms: "R-W-E-D-RA",
    users: "R-W-E-D-RA",
    attendenceRecordModels: "R-W-E-D-RA",
    supportTickets: "R-W-E-D-RA",
    scheduleClass: "R-W-E-D-RA",
    timetable: "R-W-E-D-RA",
    admissionInquary: "R-W-E-D-RA",
    Attendance: "R-W-E-D-RA",
    feeStructure: "R-W-E-D-RA",
    feePayment: "R-W-E-D-RA",
    TC: "R-W-E-D-RA",
    Permission:"R-W-E-D-RA",
    galleryimage:"R-W-E-D-RA",
    notifications:"R-W-E-D-RA",
    bank_details:"R-W-E-D-RA",
    // keep camelCase aliases for controllers expecting these keys
    bankDetails:"R-W-E-D-RA",
    feeValidate:"R-W-E-D-RA",
    deposit_request:"R-W-E-D-RA"
  },
  Admin: {
    students: "R-W-E-D-RA",
    teachers: "R-W-E-D-RA",
    admissions: "R-W-E-D-RA",
    classes: "R-W-E-D-RA",
    instutions: "R",
    managementDetails: "R",
    Staff_salary: "R-W-E-D-RA",
    staff_salaryDetails: "R-W-E-D-RA",
    Staff_salary_payment_details: "R-W-RA",
    staffJobForms: "R-W-E-RA",
    users: "R-W-D",
    attendenceRecordModels: "R-W-E-D-RA",
    scheduleClass: "R-W-E-D-RA",
    timetable: "R-W-E-D-RA",
    studentMarksheet: "R-W-E-D-RA",
    admissionInquary: "R-W-E-D-RA",
    Attendance: "R-W-E-D-RA",
    feeStructure: "R-W-E-D-RA",
    feePayment: "R-W-RA",
    galleryimage:"R-W-E-D-RA",
    notifications:"R-W-E-D-RA",
    bankDetails:"R-W-E-D-RA",
    feeValidate:"R-W-E-D-RA"
  },
  "Admission Staff": {
    students: "R",
    teachers: "",
    admissions: "R-W-E-D-RA",
    classes: "R",
    instutions: "R",
    managementDetails: "",
    Staff_salary: "",
    staff_salaryDetails: "",
    Staff_salary_payment_details: "",
    staffJobForms: "",
    users: "",
    attendenceRecordModels: "",
    scheduleClass: "",
    studentMarksheet: "",
    admissionInquary: "R-W-E-D-RA",
    Attendance: "",
    feeStructure: "",
    feePayment: "",
    galleryimage: "",
    notifications: "R",
    bankDetails: "",
    feeValidate: ""
  },
  "Reception Staff": {
    students: "",
    teachers: "",
    admissions: "",
    classes: "R",
    instutions: "R",
    managementDetails: "",
    Staff_salary: "",
    staff_salaryDetails: "",
    Staff_salary_payment_details: "",
    staffJobForms: "",
    users: "",
    attendenceRecordModels: "",
    scheduleClass: "",
    studentMarksheet: "",
    admissionInquary: "R-W",
    Attendance: "",
    feeStructure: "",
    feePayment: "",
    galleryimage: "",
    notifications: "R",
    bankDetails: "",
    feeValidate: ""
  },
  "Inventory Staff": {
    students: "R",
    teachers: "R",
    admissions: "",
    classes: "R",
    instutions: "R",
    managementDetails: "",
    Staff_salary: "",
    staff_salaryDetails: "",
    Staff_salary_payment_details: "",
    staffJobForms: "",
    users: "",
    attendenceRecordModels: "",
    scheduleClass: "",
    studentMarksheet: "",
    admissionInquary: "",
    Attendance: "",
    feeStructure: "",
    feePayment: "",
    galleryimage: "",
    notifications: "R",
    bankDetails: "",
    feeValidate: "",
    inventory: "R-W-E-D-RA",
    library: "R-W",
    transport: "R-W",
    hostel: "R-W",
    reports: "R-RA"
  },
  "Library Staff": {
    students: "R",
    teachers: "R",
    admissions: "",
    classes: "R",
    instutions: "R",
    managementDetails: "",
    Staff_salary: "",
    staff_salaryDetails: "",
    Staff_salary_payment_details: "",
    staffJobForms: "",
    users: "",
    attendenceRecordModels: "",
    scheduleClass: "",
    studentMarksheet: "",
    admissionInquary: "",
    Attendance: "",
    feeStructure: "",
    feePayment: "",
    galleryimage: "",
    notifications: "R",
    bankDetails: "",
    feeValidate: "",
    library: "R-W-E-D-RA",
    reports: "R-RA"
  },
  "Examination Staff": {
    students: "R",
    teachers: "R",
    admissions: "",
    classes: "R",
    instutions: "R",
    managementDetails: "",
    Staff_salary: "",
    staff_salaryDetails: "",
    Staff_salary_payment_details: "",
    staffJobForms: "",
    users: "",
    attendenceRecordModels: "",
    scheduleClass: "R-W-E-D-RA",
    studentMarksheet: "R-W-E-D-RA",
    admissionInquary: "",
    Attendance: "R",
    feeStructure: "",
    feePayment: "",
    galleryimage: "",
    notifications: "R",
    bankDetails: "",
    feeValidate: "",
    library: "",
    transport: "",
    hostel: "",
    reports: "R-RA"
  },
  Organisation: {
    students: "R-W-E-D",
    teachers: "R-W-E-D",
    admissions: "R-W-E-D",
    Classes: "R-W-E-D",
    instutions: "R-W-E-D",
    managementDetails: "R-W-E-D",
    staff_salary: "R-W-E-D",
    staff_salaryDetails: "R-W-E-D",
    Staff_salary_payment_details: "R-W-E-D",
    staffJobForms: "R-W-E-D",
    users: "R-W-E-D",
    attendenceRecordModels: "R-W-E-D-RA",
    scheduleClass: "R-W-E-D-RA",
    admissionInquary: "R-W-E-D-RA",
    Attendance: "R-W-E-D-RA",
    feeStructure: "R-W-E-D-RA",
    feePayment: "R-W-E-D-RA",
    galleryimage:"R-W-E-D-RA",
    notifications:"R-W-E-D-RA",
  },
  Student: {
    students: "R-W-E-D",
    teachers: "",
    admissions: "",
    classes: "R",
    instutions: "",
    managementDetails: "",
    staff_salary: "",
    staff_salaryDetails: "",
    staff_salary_payment_details: "",
    staffJobForms: "",
    users: "R",
    attendenceRecordModels: "R",
    scheduleClass: "",
    timetable: "R-RA",
    TC: "R",
    notifications:"R-W-E-D-RA",
    studentMarksheet: "R-RA",
  },
  /** Parent portal: align read access with Student so attendance/marks APIs work */
  Parent: {
    students: "R",
    teachers: "",
    admissions: "",
    classes: "R",
    instutions: "",
    managementDetails: "",
    staff_salary: "",
    staff_salaryDetails: "",
    staff_salary_payment_details: "",
    staffJobForms: "",
    users: "R",
    attendenceRecordModels: "R",
    scheduleClass: "",
    timetable: "R-RA",
    TC: "R",
    notifications: "R",
    studentMarksheet: "R-RA",
  },
  "Accounts Coordinator": {
    students: "R",
    teachers: "",
    admissions: "",
    classes: "R",
    instutions: "R",
    managementDetails: "",
    staff_salary: "",
    staff_salaryDetails: "",
    staff_salary_payment_details: "",
    staffJobForms: "",
    users: "",
    attendenceRecordModels: "R",
    scheduleClass: "",
    timetable: "",
    studentMarksheet: "R-RA",
    feeStructure: "R-W-RA",
    feePayment: "R-W-RA",
    notifications: "R",
    bankDetails: "R",
  },
  Mentor: {
    students: "R",
    teachers: "R",
    admissions: "",
    classes: "R-RA",
    instutions: "R",
    managementDetails: "R",
    Staff_salary: "R",
    staff_salaryDetails: "R",
    staff_salary_payment_details: "R",
    staffJobForms: "",
    users: "R",
    attendenceRecordModels: "R-W-E-D-RA",
    scheduleClass: "R-RA",
    timetable: "R-RA",
    studentMarksheet: "R-W-E-D-RA",
    admissionInquary: "",
    Attendance: "R-W-E-D-RA",
    feeStructure: "",
    feePayment: "",
    galleryimage: "",
    notifications:"R-W-E-D-RA",
    bankDetails: "",
    feeValidate: ""
  },
  Teacher: {
    students: "R",
    teachers: "R",
    admissions: "",
    classes: "R-RA",
    instutions: "R",
    managementDetails: "R",
    Staff_salary: "R",
    staff_salaryDetails: "R",
    staff_salary_payment_details: "R",
    staffJobForms: "",
    users: "R",
    attendenceRecordModels: "R-W-E-D-RA",
    scheduleClass: "R-RA",
    timetable: "R-RA",
    TC: "R",
    notifications:"R-RA",
    studentMarksheet: "R-W-E-D-RA",
  }
};

// This method is user to show the permissions list to the user
const givePermissionAccess = async (req, res, next) => {
    const permissionData = {
        "students": "Students",
        "teachers": "Teachers",
        "classes": "Classes",
        "instutions": "Instutions",
        "admissions": "Admissions",
        "staffjobforms": "Staff Job Forms",
        "staff_salary_payments": "Staff Salary Payments",
        "staff_salary_details": "Staff Salary Details",
        "staff_salaries": "Staff Salaries",
        "managementdetails": "Management Details",
        "feestructures": "Fee Structures"
    }

    return res.status(200).json({
        success: true,
        code: 200,
        message: 'Permissions retrieved successfully.',
        data: permissionData
    });
}

const permissionAccess = async (req, res, next) => {
    let user = req.user;
    let permissionType = user.PermissionSet;
   
    const isBlank = (permissionType) => permissionType == null || permissionType.trim() === '';
    let permissionData;
    if (isBlank(permissionType)) {
        permissionData = data[user.UserType];  
        if (permissionData.length > 0) {
            return res.status(200).json({
                success: true,
                code: 200,
                message: 'Permissions retrieved successfully.',
                data: permissionData
            });
    } }else {
          try {
            const permissionSets = await permissionAssinment.find({ MemberCode: req.body.MemberCode  });
            if (permissionSets.length > 0) {
                return res.status(200).json({
                    code: 200,
                    success: true,
                    message: 'Permissions retrieved successfully.',
                    data: permissionSets
                });
            } else {
                return res.status(500).json({
                    code: 500,
                    success: false,
                    message: 'No permissions found for this user.',
                    data: []
                });
            }
        } catch (error) {
            console.error(`Error retrieving permission set: ${error}`);
            return res.status(500).json({
                code: 500,
                message: 'An error occurred while retrieving the permission set.',
                data:[],
                error: error.message

            });
        }
    }

    next();

};
///////////////////////////////////
const checkPermissions = async (req, res) => {
    let user = req.user;
   

    try {

       // const permissionSets = await permissionAssinment.findOne({ MemberCode: req.body.MemberCode });

        const permissionSets = await permissionAssinment.findOne({ MemberCode: user.MemberId }); // Fetch all records
        if (permissionSets !== undefined && permissionSets !== null) {
            return res.status(200).json({
                success: true,
                code: 200,
                message: 'All permissions retrieved successfully.',
                data: permissionSets
            });
        } else if(permissionSets === null){

            return res.status(200).json({
                success: true,
                code: 200,
                message: 'All permissions retrieved successfully.',
                data: data[user.UserType]
            });

        } else {
            return res.status(404).json({
                success: false,
                code: 404,
                message: 'No permissions found.',
                data: []
            });
        }
    } catch (error) {
        return res.json({
            success: false,
            code: 500,
            message: 'An error occurred while retrieving permissions.',
            error: error.message
        });
    }
};

///////////////////////////////

/////////////////////////////////////////
const getAllPermissions = async (req, res) => {
   
    try {

       // const permissionSets = await permissionAssinment.findOne({ MemberCode: req.body.MemberCode });

        const permissionSets = await permissionAssinment.find(); // Fetch all records
        
        if (permissionSets.length > 0) {
            return res.status(200).json({
                success: true,
                code: 200,
                message: 'All permissions retrieved successfully.',
                data: permissionSets
            });
        } else {
            return res.json({
                success: false,
                code: 404,
                message: 'No permissions found.',
                data: []
            });
        }
    } catch (error) {
        console.error(`Error retrieving permissions: ${error.message}`);
        return res.status(500).json({
            success: false,
            code: 500,
            message: 'An error occurred while retrieving permissions.',
            error: error.message
        });
    }
};


///////////////////////////////////////


const getPermissionSet = async (req) => {
    try {
        const normalizeRole = (role) =>
            String(role || '')
                .trim()
                .toLowerCase()
                .replace(/\s+/g, '');
        const resolvePermissionRoleKey = (userType) => {
            if (data[userType]) return userType;
            const normalizedInput = normalizeRole(userType);
            const matchedKey = Object.keys(data).find(
                (key) => normalizeRole(key) === normalizedInput
            );
            return matchedKey || userType;
        };
        let user = req.user;
        if (!user) {
            console.error('No user found in request');
            return {};
        }

        let permissionType = user.PermissionSet;
        let isBlank = !permissionType || permissionType.trim() === '';

        const basePermissions = data[resolvePermissionRoleKey(user.UserType)] || {};
        const withSafeStrings = (obj) => {
            const out = { ...obj };
            Object.keys(basePermissions).forEach((k) => {
                if (out[k] === undefined || out[k] === null) out[k] = basePermissions[k] || '';
                if (typeof out[k] !== 'string') out[k] = String(out[k] || '');
            });
            // Ensure commonly used keys always exist as strings
            [
                'students',
                'teachers',
                'classes',
                'users',
                'attendenceRecordModels',
                'notifications',
                'scheduleClass',
                'timetable',
                'studentMarksheet',
                'feeStructure',
                'feePayment',
            ].forEach((k) => {
                if (out[k] === undefined || out[k] === null) out[k] = '';
                if (typeof out[k] !== 'string') out[k] = String(out[k] || '');
            });
            return out;
        };

        if (isBlank) {
            // Use default permissions based on UserType
            const permissionData = data[resolvePermissionRoleKey(user.UserType)];
            return withSafeStrings(permissionData || {});  
        } else {
            // Query from the database if PermissionSet is specified
            try {
                if (req.user.hasOwnProperty('MemberCode') && req.user.MemberCode) {
                    const permissionSets = await permissionAssinment.findOne({ MemberCode: req.user.MemberCode });
                    if (permissionSets) {
                        const permissionObj = permissionSets.toObject ? permissionSets.toObject() : permissionSets;
                        // Merge custom permission set over defaults so missing keys never crash controllers.
                        return withSafeStrings({ ...basePermissions, ...permissionObj }); 
                    } else {
                        // Fallback to default permissions
                        return withSafeStrings(data[resolvePermissionRoleKey(req.user.UserType)] || {});
                    }
                } else {
                    return withSafeStrings(data[resolvePermissionRoleKey(req.user.UserType)] || {});
                }
            } catch (error) {
                console.error(`Error retrieving permission set: ${error}`);
                // Fallback to default permissions on error
                return withSafeStrings(data[resolvePermissionRoleKey(req.user.UserType)] || {});
            }
        }
    } catch (error) {
        console.error('Error in getPermissionSet:', error);
        // Return empty object as fallback
        return {};
    }
};

  


  const createPermissionSet = (req, res, next) => {
        let user = req.user;
    
    let permissionSet = new permissionAssinment({
        Assigned_user: user.userId,
        MemberCode : req.body.MemberCode,
        assinment_Date: req.body.assinment_Date,
        assined_by: user.MemberId,
        users: req.body.users,
        teachers: req.body.teachers,
        students: req.body.students,
        staffjobforms:req.body.staffjobforms,
        staff_salary_payments:req.body.staff_salary_payments,
        staff_salary_details:req.body.staff_salary_details,
        staff_salaries:req.body.staff_salaries,
        managementdetails:req.body.managementdetails ,
        instutions:req.body.instutions,
        feestructures:req.body.feestructures ,
        classes:req.body.classes,
        admissions:req.body.admissions   
    })
    permissionSet.save()
    .then(response =>{
        res.status(200).json({
            code: 200,
            success: true,
            data: permissionSet,
            message: 'Permission added sucessfully!'
        })
    })
    .catch(error => {
        res.status(500).json({
            code: 500,
            success: false,
            message: error
        })
    })
}


// const updatePermissionSet = (req, res, next) =>{
//     let permissionSetId = req.body.permissionSetId
//     let permissionSet = new permissionAssinment({
//         assinment_Date: req.body.assinment_Date,
//         users: req.body.users,
//         teachers: req.body.teachers,
//         students: req.body.students,
//         staffjobforms:req.body.staffjobforms,
//         staff_salary_payments:req.body.staff_salary_payments,
//         staff_salary_details:req.body.staff_salary_details,
//         staff_salaries:req.body.staff_salaries,
//         managementdetails:req.body.managementdetails ,
//         instutions:req.body.instutions,
//         feestructures:req.body.feestructures ,
//         classes:req.body.classes,
//         admissions:req.body.admissions   
//     })
//     permissionAssinment.findByIdAndUpdate(permissionSetId, {$set: permissionSet})
//     .then(response =>{
//         res.status(200).json({
//             message: 'Permission set details updated sucessfully',
//             code: 200,
//             success: true
//         })
//     })
//     .catch(error => {
//         res.status(500).json({
//             message: ' An error occured',
//             code: 500,
//             success: false
//         })
//     })
// }

// // delete an Class  => Only super admin can access this feature

// const deletePermissionSet = (req, res, next) =>{
//     let permissionSetId = req.body.permissionSetId
//     permissionAssinment.findByIdAndDelete(permissionSetId)
//     .then(response => {
//         res.status(200).json({
//             message : 'Permission set Deleted sucessfully',
//             code: 200,
//             success: true,
//             data:[]
//         })
//     })
//     .catch(error =>{
//         res.status(500).json({
//             message: 'An error occured!',
//             code: 500,
//             success: false,
//             data: []
//         })       
//     })
// }

module.exports = {
    createPermissionSet, 
    permissionAccess, 
    getPermissionSet, 
    getAllPermissions, 
    checkPermissions, 
    givePermissionAccess
}
