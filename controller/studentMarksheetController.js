const { response } = require('express')
const studentMarksheetModel      = require('../models/studentMarksheetModel')
const mongoErrorMessages = require('./mongoErrors.json');
const { resolveAcademicYearScope } = require('../utils/academicYearScope')
const StudentEnrollment = require('../models/studentEnrollmentModel')
const { resolveOwnStudentRegistration } = require('../utils/studentPortalAccess')

//Show all fee Detiails

const index = async (req, res, next) => {
    try {
        // Permission check if you have role-based access; adjust as needed
        // const permissionsResult = await getPermissionSet(req);
        // if(!permissionsResult.marksheets || !permissionsResult.marksheets.split("-").includes('RA')){
        //     return res.status(401).json({
        //         code: 403,
        //         success: false,
        //         message: 'You do not have the necessary permissions to access this resource. Please contact your administrator'
        //     });
        // }

        const page = parseInt(req.query.PageNumber) || 1;
        const limit = parseInt(req.query.PageSize) || 10;
        const skip = (page - 1) * limit;
        const searchText = req.query.SearchText || '';
        
        // Base condition: always restrict to logged-in user's institution
        let searchCondition = { Instution_Id: req.user.InstutionCode };

        // Academic-year view scoping
        const scope = await resolveAcademicYearScope(req)
        if (scope?.from && scope?.to) {
            // Filter by marksheet creation time for previous-year viewing
            searchCondition.createdAt = { $gte: scope.from, $lte: scope.to }
        }

        // Status filtering - if useful for marksheets
        if (req.query.status === 'Active') {
            searchCondition.Publish = true;
        } else if (req.query.status === 'Inactive') {
            searchCondition.Publish = false;
        }

        // Custom dynamic search (searchText applies as a partial match to several fields)
        if (searchText) {
            searchCondition.$or = [
                { Student_Id: { $regex: searchText, $options: 'i' } },
                { Student_Name: { $regex: searchText, $options: 'i' } },
                { Class: { $regex: searchText, $options: 'i' } },
                { Result: { $regex: searchText, $options: 'i' } },
                { Grade: { $regex: searchText, $options: 'i' } },
                { Year: { $regex: searchText, $options: 'i' } },
                { Exam_type: { $regex: searchText, $options: 'i' } }
            ];
        }

        const [marksheets, totalCount] = await Promise.all([
            studentMarksheetModel.find(searchCondition).skip(skip).limit(limit),
            studentMarksheetModel.countDocuments(searchCondition)
        ]);
        
        res.status(200).json({
            success: true,
            message: 'Marksheets fetched successfully!',
            code: 200,
            totalRecords: totalCount,
            page: page,
            pageSize: limit,
            totalPages: Math.ceil(totalCount / limit),
            data: marksheets.map(marksheet => ({
                _id: marksheet._id,
                Student_Id: marksheet.Student_Id,
                Student_Name: marksheet.Student_Name,
                Class: marksheet.Class,
                Year: marksheet.Year,
                Exam_type: marksheet.Exam_type,
                Total_Marks: marksheet.Total_Marks,
                Obtained_Marks: marksheet.Obtained_Marks,
                Percentage: marksheet.Percentage,
                Result: marksheet.Result,
                Grade: marksheet.Grade,
                CGPA: marksheet.CGPA,
                Remark: marksheet.Remark,
                Publish: marksheet.Publish,
                Marks: marksheet.Marks || [],
                createdAt: marksheet.createdAt
            }))
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
};


// Get single fee Details

const show = (req, res, next) =>{
    let feeDetailId = req.body.feeDetailId
    studentMarksheetModel.findById(feeDetailId)
    .then(response => {
        res.status(200).json({
            message: 'Marks fetch sucessfully!',
            success: true,
            code: 200,
            data : response
        })
    })
    .catch(error => {
        const matchedKey = Object.keys(mongoErrorMessages).find(key => error.message.includes(key));
        const errorMessage = matchedKey ? mongoErrorMessages[matchedKey] : error.message;
        res.status(500).json({
            message: errorMessage,
            success: false,
            code: 500,
            data : [],
            error: errorMessage
        })
    })
}

const calculateCGPA = async (percentage) => {
    let gradePoint;
  
    if (percentage >= 95) gradePoint = 10.0;
    else if (percentage >= 90) gradePoint = 9.5;
    else if (percentage >= 85) gradePoint = 9.0;
    else if (percentage >= 80) gradePoint = 8.5;
    else if (percentage >= 75) gradePoint = 8.0;
    else if (percentage >= 70) gradePoint = 7.5;
    else if (percentage >= 65) gradePoint = 7.0;
    else if (percentage >= 60) gradePoint = 6.5;
    else if (percentage >= 55) gradePoint = 6.0;
    else if (percentage >= 50) gradePoint = 5.5;
    else if (percentage >= 45) gradePoint = 5.0;
    else if (percentage >= 40) gradePoint = 4.5;
    else if (percentage >= 35) gradePoint = 4.0;
    else if (percentage >= 30) gradePoint = 3.5;
    else if (percentage >= 25) gradePoint = 3.0;
    else if (percentage >= 20) gradePoint = 2.5;
    else if (percentage >= 15) gradePoint = 2.0;
    else if (percentage >= 10) gradePoint = 1.5;
    else if (percentage >= 1) gradePoint = 1.0;
    else gradePoint = 0.0;
  
    return gradePoint;
  };

  const calculateGrade = async (percentage) => {
    if (percentage >= 95) return "A+";
    else if (percentage >= 90) return "A";
    else if (percentage >= 85) return "A-";
    else if (percentage >= 80) return "B+";
    else if (percentage >= 75) return "B";
    else if (percentage >= 70) return "B-";
    else if (percentage >= 65) return "C+";
    else if (percentage >= 60) return "C";
    else if (percentage >= 55) return "C-";
    else if (percentage >= 50) return "D+";
    else if (percentage >= 45) return "D";
    else if (percentage >= 40) return "D-";
    else return "Fail";
  }

  const addMarks = async (req, res, next) => {
    const originalData = req.body;
    
    ///////////////
    const updatedData = {
        ...originalData,
        Marks: originalData.Marks.map(mark => ({
            ...mark,
            status: originalData.status
        }))
    };
    
    // Remove `status` from the top level
    delete updatedData.status;
     const scope = await resolveAcademicYearScope(req)
     const currentDate = new Date();
     const year = scope?.yearDoc?.Year_Name || currentDate.getFullYear();
     let status = 'Pass';
     let totalCgpa;
     let greade;
     let obtainedMarks = 0;
     let totalMarks = 0;
     let percentage;
 
 let marks = updatedData.Marks;
 marks.forEach(subjectMarks => {
     for (const key in subjectMarks) {
       if (subjectMarks.hasOwnProperty(key)) {
         const value = subjectMarks[key];
         if(key === 'status' && value === 'Fail'){
             status = value;
         }else if(key === 'total' ){
             totalMarks = totalMarks + parseInt(value);
         }else if(key === 'Obtained' ){
             obtainedMarks = obtainedMarks + parseInt(value);
         }
       }
     }
   });
             percentage = obtainedMarks/totalMarks * 100;
             totalCgpa  = await calculateCGPA(percentage);
             greade     = await calculateGrade(percentage);
             percentage += '%';
 
     let fmarksDetails = new studentMarksheetModel({
             Student_Id : req.body.StudentId,
             Instution_Id : req.user.InstutionCode,
             Marks: req.body.Marks,
             Result: status,
             Percentage: percentage,
             Remark: req.body.Remark,
             Total_Marks :totalMarks,
             Student_Name : req.body.Student_Name,
             Obtained_Marks : obtainedMarks,
             Class:req.body.Class,
             Grade: greade,
             CGPA: totalCgpa,
             Year: year,
             Exam_type: req.body.ExamType,
             Publish : false
     })
     fmarksDetails.save()
     .then(response =>{
         res.status(201).json({
             message: 'Marks added sucessfully!',
             success: true,
             code: 201
         })
     })
     .catch(error => {
        const matchedKey = Object.keys(mongoErrorMessages).find(key => error.message.includes(key));
        const errorMessage = matchedKey ? mongoErrorMessages[matchedKey] : error.message;
         res.status(500).json({
             message: errorMessage,
             success: false,
             code: 500,
             error: errorMessage
         })
     })

    ///////////////////////

  }

const store = async (req, res, next) => {

    const scope = await resolveAcademicYearScope(req)
    const currentDate = new Date();
    const year = scope?.yearDoc?.Year_Name || currentDate.getFullYear();
    let status = 'Pass';
    let totalCgpa;
    let greade;
    let obtainedMarks = 0;
    let totalMarks = 0;
    let percentage;

let marks = req.body.Marks;
marks.forEach(subjectMarks => {
    for (const key in subjectMarks) {
      if (subjectMarks.hasOwnProperty(key)) {
        const value = subjectMarks[key];
        if(key === 'status' && value === 'Fail'){
            status = value;
        }else if(key === 'total' ){
            totalMarks = totalMarks + parseInt(value);
        }else if(key === 'Obtained' ){
            obtainedMarks = obtainedMarks + parseInt(value);
        }
      }
    }
  });
            percentage = obtainedMarks/totalMarks * 100;
            totalCgpa  = await calculateCGPA(percentage);
            greade     = await calculateGrade(percentage);
            percentage += '%';

    // Resolve enrollment for this student and academic year (optional link)
    let enrollmentId = null
    if (scope?.yearDoc?._id) {
        const enrollment = await StudentEnrollment.findOne({
            InstutionCode: req.user.InstutionCode,
            StudentId: req.body.StudentId,
            AcademicYearId: scope.yearDoc._id.toString()
        }).lean()
        if (enrollment) {
            enrollmentId = enrollment._id.toString()
        }
    }

    let fmarksDetails = new studentMarksheetModel({
            Student_Id : req.body.StudentId,
            Instution_Id : req.user.InstutionCode,
            EnrollmentId: enrollmentId,
            AcademicYearId: scope?.yearDoc?._id?.toString() || null,
            Marks: req.body.Marks,
            Result: status,
            Percentage: percentage,
            Remark: req.body.Remark,
            Total_Marks :totalMarks,
            Student_Name : req.body.Student_Name,
            Obtained_Marks : obtainedMarks,
            Class:req.body.Class,
            Grade: greade,
            CGPA: totalCgpa,
            Year: year,
            Exam_type: req.body.ExamType,
            Publish : false
    })
    fmarksDetails.save()
    .then(response =>{
        res.status(201).json({
            message: 'Marks added sucessfully!',
            success: true,
            code: 201
        })
    })
    .catch(error => {
        const matchedKey = Object.keys(mongoErrorMessages).find(key => error.message.includes(key));
        const errorMessage = matchedKey ? mongoErrorMessages[matchedKey] : error.message;
        res.status(500).json({
            message: errorMessage,
            success: false,
            code: 500,
            error: errorMessage
        })
    })
}

const getMarks = async (req, res, next) => {
    const scope = await resolveAcademicYearScope(req)
    const createdAtRange = scope?.from && scope?.to ? { $gte: scope.from, $lte: scope.to } : null
    /////////////////////////////////////////////////
   if(req.query.examType === '' || req.query.examType === undefined){
         const studentmarks = await studentMarksheetModel.find({
        Class: req.query.class,
        Instution_Id: req.user.InstutionCode,
        ...(createdAtRange ? { createdAt: createdAtRange } : {}),

    })
    .then(response => {
        res.status(200).json({
            data : response,
            success: true,
            code: 200
        })
    }
    )
    .catch(error => {
        const matchedKey = Object.keys(mongoErrorMessages).find(key => error.message.includes(key));
        const errorMessage = matchedKey ? mongoErrorMessages[matchedKey] : error.message;
        res.status(500).json({
            message: errorMessage,
            success: false,
            code: 500,
            error: errorMessage

        })
    })

    } else if(req.query.class === '' || req.query.class === undefined){
          const studentmarks = await studentMarksheetModel.find({
        Instution_Id: req.user.InstutionCode,
        Exam_type: req.query.examType,
        ...(createdAtRange ? { createdAt: createdAtRange } : {}),

    })
    .then(response => {
        res.status(200).json({
            data : response,
            success: true,
            code: 200
        })
    }
    )
    .catch(error => {
        const matchedKey = Object.keys(mongoErrorMessages).find(key => error.message.includes(key));
        const errorMessage = matchedKey ? mongoErrorMessages[matchedKey] : error.message;
        res.status(500).json({
            message: errorMessage,
            success: false,
            code: 500,
            error: errorMessage

        })
    })
    }
    else{
        const studentmarks = await studentMarksheetModel.find({
        Class: req.query.class,
        Instution_Id: req.user.InstutionCode,
        
        ...(createdAtRange ? { createdAt: createdAtRange } : {}),

    })
    .then(response => {
        res.status(200).json({
            data : response,
            success: true,
            code: 200
        })
    }
    )
    .catch(error => {
        const matchedKey = Object.keys(mongoErrorMessages).find(key => error.message.includes(key));
        const errorMessage = matchedKey ? mongoErrorMessages[matchedKey] : error.message;
        res.status(500).json({
            message: errorMessage,
            success: false,
            code: 500,
            error: errorMessage

        })
    })
    }
////////////////////////////////////////////////////////////////
    
   

}
// this method is for student mobile app to get marksheet details
const getStudentMarks = async (req, res, next) => {

    try{
    const resolved = resolveOwnStudentRegistration(req, req.query.registrationNumber)
    if (resolved.error) {
        return res.status(resolved.error.status).json({
            success: false,
            code: resolved.error.status,
            message: resolved.error.message
        })
    }
    const regNum = resolved.registrationNumber
    if (!regNum) {
        return res.status(400).json({
            success: false,
            code: 400,
            message: 'registrationNumber is required'
        })
    }

    const scope = await resolveAcademicYearScope(req)
    const createdAtRange = scope?.from && scope?.to ? { $gte: scope.from, $lte: scope.to } : null;

    const isStudentUser = String(req.user?.UserType || '').trim() === 'Student'
    const studentmarks = await studentMarksheetModel.find({
        Student_Id: regNum,
        Instution_Id: req.user.InstutionCode,
        ...(isStudentUser ? { Publish: true } : {}),
        ...(createdAtRange ? { createdAt: createdAtRange } : {}),
    })

        res.status(200).json({
            success: true,
            code: 200,
            data : studentmarks
        })
    
} catch(error){
    const matchedKey = Object.keys(mongoErrorMessages).find(key => error.message.includes(key));
    const errorMessage = matchedKey ? mongoErrorMessages[matchedKey] : error.message;
    res.status(500).json({
        message: errorMessage,
        success: false,
        code: 500,
        error: errorMessage
    })

}

}

// get marks using student Id
const getMarksbyregNum = async (req, res, next) => {
    const scope = await resolveAcademicYearScope(req)
    const createdAtRange = scope?.from && scope?.to ? { $gte: scope.from, $lte: scope.to } : null;

    const studentmarks = await studentMarksheetModel.find({
        Student_Id: req.query.studentId,
        Class: req.query.class,
        Instution_Id: req.user.InstutionCode,
        Exam_type: req.query.examType,
        ...(createdAtRange ? { createdAt: createdAtRange } : {}),

    })
    .then(response => {
        res.status(200).json({
            data : response,
            success: true,
            code: 200
        })
    }
    )
    .catch(error => {
        const matchedKey = Object.keys(mongoErrorMessages).find(key => error.message.includes(key));
        const errorMessage = matchedKey ? mongoErrorMessages[matchedKey] : error.message;
        res.status(500).json({
            message: errorMessage,
            success: false,
            code: 500,
            error: errorMessage

        })
    })
   

}


const publishMarks = async (req, res, next) => {
    try {
        const instutionCode = req.user.InstutionCode;
        let searchCondition = {
            Instution_Id: instutionCode,
            Publish: false
        };

        // Academic-year view default (if Year is not explicitly provided)
        const scope = await resolveAcademicYearScope(req)
        if (!req.body.Year && scope?.from && scope?.to) {
            searchCondition.createdAt = { $gte: scope.from, $lte: scope.to }
        }

        // Class filter (required)
        if (req.body.Class) {
            searchCondition.Class = req.body.Class;
        }

        // ExamType filter (optional)
        if (req.body.ExamType) {
            searchCondition.Exam_type = req.body.ExamType;
        }

        // Year filter (optional)
        if (req.body.Year) {
            searchCondition.Year = req.body.Year.toString();
        }

        // If marksheetId is provided (old method), publish single marksheet
        if (req.body.marksheetId) {
            const updateResult = await studentMarksheetModel.updateOne(
                {
                    _id: req.body.marksheetId,
                    Instution_Id: instutionCode,
                },
                { $set: { Publish: true } }
            );
            return res.status(200).json({
                message: 'Marksheet published successfully',
                success: true,
                code: 200,
                updatedCount: updateResult.modifiedCount
            });
        }

        // Class-wise publishing (new method)
        if (!req.body.Class) {
            return res.status(400).json({
                message: 'Class is required for publishing',
                success: false,
                code: 400
            });
        }

        const updateResult = await studentMarksheetModel.updateMany(
            searchCondition,
            { $set: { Publish: true } }
        );

        let messageText = `Marks published successfully for ${req.body.Class}`;
        if (req.body.ExamType) {
            messageText += ` (${req.body.ExamType})`;
        }
        if (req.body.Year) {
            messageText += ` - Year ${req.body.Year}`;
        }

        res.status(200).json({
            message: messageText,
            success: true,
            code: 200,
            updatedCount: updateResult.modifiedCount
        });
       
    } catch (error) {
        const matchedKey = Object.keys(mongoErrorMessages).find(key => error.message.includes(key));
        const errorMessage = matchedKey ? mongoErrorMessages[matchedKey] : error.message;
        console.error("Error publishing marks:", error);
        res.status(500).json({
            message: errorMessage,
            success: false,
            code: 500,
            error: errorMessage
        });
    }
};


// update fee Details  => Not required as of now
const update = (req, res, next) =>{
    let feeDetailId = req.body.feeDetailId
    let updateData = {
        Student_Name : req.body.Student_Name,
        Class: req.body.Class,
        Student_RollNumber: req.body.Student_RollNumber,
        Month: req.body.Month,
        Total_Pending_Fee: req.body.Total_Pending_Fee,
        Tution_fee:req.body.Tution_fee,
        Payment_status:req.body.Payment_status,
        Lumsum_Amount:req.body.Lumsum_Amount,
        Payment_Date:req.body.Payment_Date,
        Payment_Mode:req.body.Payment_Mode
    }
    studentMarksheetModel.findByIdAndUpdate(feeDetailId, {$set: updateData})
    .then(response =>{
        res.status(200).json({
            success: true,
            code: 200,
            message: 'Marksheet details updated sucessfully',
            data: response
        })
    })
    .catch(error => {
        const matchedKey = Object.keys(mongoErrorMessages).find(key => error.message.includes(key));
        const errorMessage = matchedKey ? mongoErrorMessages[matchedKey] : error.message;
        res.status(500).json({
            message: errorMessage,
            success: false,
            code: 500,
            error: errorMessage

        });
    })
}

// delete fee details  => Not required as of now

const destroy = (req, res, next) =>{
    let feeDetailId = req.body.Id
    studentMarksheetModel.findByIdAndDelete(feeDetailId)
    .then(response => {
        console.log(response);
        res.status(200).json({
            status: true,
            code: 200,
            success: true,
            message : 'Marksheet Deleted sucessfully'
        })
    })
    .catch(error =>{
        const matchedKey = Object.keys(mongoErrorMessages).find(key => error.message.includes(key));
        const errorMessage = matchedKey ? mongoErrorMessages[matchedKey] : error.message;
        res.status(500).json({
            status: false,
            code: 500,
            success: false,
            message: errorMessage,
            error: errorMessage
        })       
    })
}

// Generate marksheets from subject-wise marks
const generateMarksheets = async (req, res, next) => {
  try {
    const permissionsResult = await getPermissionSet(req)
    if (!permissionsResult.studentMarksheet || !permissionsResult.studentMarksheet.split('-').includes('W')) {
      return res.status(403).json({
        code: 403,
        success: false,
        message: 'You do not have the necessary permissions to access this resource. Please contact your administrator',
      })
    }

    const { ClassCode, SectionCode = '', ExamType, Year } = req.body
    const instutionCode = req.user.InstutionCode

    const scope = await resolveAcademicYearScope(req)

    // Validation
    if (!ClassCode || !ExamType) {
      return res.status(400).json({
        success: false,
        code: 400,
        message: 'ClassCode and ExamType are required',
      })
    }

    const examSubjectMarksModel = require('../models/examSubjectMarksModel')
    const currentDate = new Date()
    const year = scope?.yearDoc?.Year_Name || Year || currentDate.getFullYear()

    // Fetch all subject marks for this class/section/exam
    const searchCondition = {
      InstutionCode: instutionCode,
      ClassCode,
      ExamType,
    }

    if (scope?.from && scope?.to) {
      // Subject-wise marks entries are tied to ExamDate; filter by academic session.
      searchCondition.ExamDate = { $gte: scope.from, $lte: scope.to }
    }

    if (SectionCode) {
      searchCondition.SectionCode = SectionCode
    } else {
      // If no section specified, get all sections (empty string or null)
      searchCondition.SectionCode = { $in: ['', null] }
    }

    const allSubjectMarks = await examSubjectMarksModel.find(searchCondition).lean()

    if (!allSubjectMarks || allSubjectMarks.length === 0) {
      return res.status(404).json({
        success: false,
        code: 404,
        message: 'No subject marks found for the specified criteria. Please enter subject marks first.',
      })
    }

    // Get class name
    const classModel = require('../models/classModel')
    const classInfo = await classModel.findOne({
      ClassCode,
      InstutionCode: instutionCode,
    }).select('ClassName').lean()

    if (!classInfo) {
      return res.status(404).json({
        success: false,
        code: 404,
        message: 'Class not found',
      })
    }

    // Group marks by student
    const studentMarksMap = new Map()

    for (const subjectMark of allSubjectMarks) {
      for (const mark of subjectMark.Marks || []) {
        const studentId = mark.Student_Id
        if (!studentMarksMap.has(studentId)) {
          studentMarksMap.set(studentId, {
            Student_Id: studentId,
            Student_Name: mark.Student_Name,
            Class: classInfo.ClassName,
            Marks: [],
            totalMarks: 0,
            obtainedMarks: 0,
          })
        }

        const studentData = studentMarksMap.get(studentId)
        studentData.Marks.push({
          Subject: subjectMark.Subject,
          total: subjectMark.MaxMarks,
          Obtained: mark.Obtained,
          status: mark.Status === 'Fail' ? 'Fail' : 'Pass',
        })
        studentData.totalMarks += subjectMark.MaxMarks
        studentData.obtainedMarks += mark.Obtained
      }
    }

    // Generate marksheets for each student
    let createdCount = 0
    let updatedCount = 0
    const errors = []

    for (const [studentId, studentData] of studentMarksMap) {
      try {
        const percentage = studentData.totalMarks > 0 
          ? (studentData.obtainedMarks / studentData.totalMarks) * 100 
          : 0
        const totalCgpa = await calculateCGPA(percentage)
        const grade = await calculateGrade(percentage)
        const status = studentData.Marks.some(m => m.status === 'Fail') ? 'Fail' : 'Pass'
        const percentageStr = percentage.toFixed(2) + '%'

        // Check if marksheet already exists
        const existingMarksheet = await studentMarksheetModel.findOne({
          Student_Id: studentId,
          Instution_Id: instutionCode,
          Class: studentData.Class,
          Exam_type: ExamType,
          Year: year.toString(),
        })

        const marksheetData = {
          Student_Id: studentId,
          Instution_Id: instutionCode,
          Marks: studentData.Marks,
          Result: status,
          Percentage: percentageStr,
          Total_Marks: studentData.totalMarks,
          Student_Name: studentData.Student_Name,
          Obtained_Marks: studentData.obtainedMarks,
          Class: studentData.Class,
          Grade: grade,
          CGPA: totalCgpa,
          Year: year.toString(),
          Exam_type: ExamType,
          Publish: false,
        }

        if (existingMarksheet) {
          // Update existing
          await studentMarksheetModel.findByIdAndUpdate(
            existingMarksheet._id,
            { $set: marksheetData },
            { new: true, runValidators: true }
          )
          updatedCount++
        } else {
          // Create new
          await studentMarksheetModel.create(marksheetData)
          createdCount++
        }
      } catch (error) {
        console.error(`Error generating marksheet for student ${studentId}:`, error)
        errors.push({
          studentId,
          studentName: studentData.Student_Name,
          error: error.message,
        })
      }
    }

    res.status(200).json({
      success: true,
      message: `Marksheets generated successfully! Created: ${createdCount}, Updated: ${updatedCount}`,
      code: 200,
      data: {
        created: createdCount,
        updated: updatedCount,
        total: createdCount + updatedCount,
        errors: errors.length > 0 ? errors : undefined,
      },
    })
  } catch (error) {
    console.error('Error generating marksheets:', error)
    const matchedKey = Object.keys(mongoErrorMessages).find((key) => error.message.includes(key))
    const errorMessage = matchedKey ? mongoErrorMessages[matchedKey] : error.message
    res.status(500).json({
      success: false,
      message: errorMessage || 'Failed to generate marksheets',
      code: 500,
      error: errorMessage,
    })
  }
}

module.exports = {
    index, show, store, update, destroy, publishMarks,
     getMarks, addMarks, getMarksbyregNum, getStudentMarks, generateMarksheets
}