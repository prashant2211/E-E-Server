const studentModel = require('../models/studentModel');
const attendanceModel = require('../models/attendenceRecordModel');
const feePaymentModel = require('../models/feePaymentModel');
const marksheetModel = require('../models/studentMarksheetModel');
const classModel = require('../models/classModel');
const examSubjectMarksModel = require('../models/examSubjectMarksModel');
const examScheduleModel = require('../models/examScheduleModel');

// Helper function to parse date string in various formats
const parseDateString = (dateStr) => {
  if (!dateStr) return null;
  
  const str = String(dateStr).trim();
  let date = null;
  
  try {
    // Try DD/MM/YYYY format
    if (str.includes('/')) {
      const parts = str.split('/');
      if (parts.length === 3) {
        // Try DD/MM/YYYY first
        if (parts[0].length === 2 && parts[1].length === 2) {
          date = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
        } else {
          // Try MM/DD/YYYY
          date = new Date(`${parts[2]}-${parts[0]}-${parts[1]}`);
        }
      }
    } else if (str.includes('-')) {
      // Try YYYY-MM-DD format
      date = new Date(str);
    } else {
      // Try parsing as-is
      date = new Date(str);
    }
    
    // Check if date is valid
    if (date && !isNaN(date.getTime())) {
      return date;
    }
  } catch (e) {
    // Parsing failed
    return null;
  }
  
  return null;
};

// Helper function to check if date is in range
const isDateInRange = (dateStr, startDate, endDate) => {
  const recordDate = parseDateString(dateStr);
  if (!recordDate) return false;
  
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);
  
  return recordDate >= start && recordDate <= end;
};

let mongoErrorMessages = {};
try {
  mongoErrorMessages = require('./mongoErrors.json');
} catch (e) {
  console.warn('Could not load mongoErrors.json, using empty error messages');
}

let successResponse, errorResponse;
try {
  const responseUtils = require('../utils/response');
  successResponse = responseUtils.successResponse;
  errorResponse = responseUtils.errorResponse;
} catch (e) {
  // Fallback response functions
  successResponse = (res, data, message = 'Operation successful', code = 200) => {
    return res.status(code).json({ success: true, message, code, data });
  };
  errorResponse = (res, message = 'Operation failed', code = 400) => {
    return res.status(code).json({ success: false, message, code });
  };
}

/**
 * Get attendance report - Class-wise summary
 */
const getAttendanceReport = async (req, res) => {
  try {
    const { startDate, endDate, ClassCode, SectionCode } = req.query;
    const instutionCode = req.user?.InstutionCode;

    if (!instutionCode) {
      return res.status(400).json({
        success: false,
        message: 'Institution code is required',
        code: 400
      });
    }

    let matchCondition = { InstutionId: instutionCode };

    // Date filtering - Date is stored as string, so we need to handle it carefully
    // If dates are provided, we'll filter after fetching or use a more flexible approach
    // Since Date is stored as string in format like "DD/MM/YYYY" or "YYYY-MM-DD", we'll fetch all and filter
    if (ClassCode) {
      matchCondition.Class_Code = ClassCode;
    }

    let attendanceRecords = await attendanceModel.find(matchCondition).lean();
    
    // If no records found, return empty result
    if (!attendanceRecords || attendanceRecords.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'Attendance report generated successfully',
        code: 200,
        data: []
      });
    }

    // Filter by date range if provided (Date is stored as string)
    if (startDate && endDate) {
      try {
        attendanceRecords = attendanceRecords.filter(record => {
          if (!record.Date) return false;
          return isDateInRange(record.Date, startDate, endDate);
        });
      } catch (dateError) {
        console.error('Error filtering by date:', dateError);
        // Continue without date filtering if there's an error
      }
    }

    // Process attendance data
    const classSummary = {};
    const studentAttendanceMap = {};

    attendanceRecords.forEach(record => {
      const classCode = record.Class_Code || 'Unknown';
      if (!classSummary[classCode]) {
        classSummary[classCode] = {
          classCode,
          totalRecords: 0,
          totalPresent: 0,
          totalAbsent: 0,
          uniqueStudents: new Set()
        };
      }

      if (record.Attendence && Array.isArray(record.Attendence)) {
        record.Attendence.forEach(att => {
          const studentId = att.StudentId;
          if (studentId) {
            classSummary[classCode].uniqueStudents.add(studentId);
            
            if (!studentAttendanceMap[studentId]) {
              studentAttendanceMap[studentId] = {
                studentId,
                present: 0,
                absent: 0
              };
            }

            if (att.attendance === 'Present' || att.attendance === 'P') {
              classSummary[classCode].totalPresent++;
              studentAttendanceMap[studentId].present++;
            } else {
              classSummary[classCode].totalAbsent++;
              studentAttendanceMap[studentId].absent++;
            }
          }
        });
        classSummary[classCode].totalRecords++;
      }
    });

    // Get class names
    const classCodes = Object.keys(classSummary);
    const classes = await classModel.find({
      InstutionCode: instutionCode,
      ClassCode: { $in: classCodes }
    }).select('ClassCode ClassName').lean();

    const classMap = {};
    classes.forEach(c => {
      classMap[c.ClassCode] = c.ClassName;
    });

    const result = Object.values(classSummary).map(summary => {
      const total = summary.totalPresent + summary.totalAbsent;
      const percentage = total > 0 ? ((summary.totalPresent / total) * 100).toFixed(2) : 0;
      
      return {
        classCode: summary.classCode,
        className: classMap[summary.classCode] || summary.classCode,
        totalStudents: summary.uniqueStudents.size,
        totalPresent: summary.totalPresent,
        totalAbsent: summary.totalAbsent,
        attendancePercentage: parseFloat(percentage)
      };
    });

    res.status(200).json({
      success: true,
      message: 'Attendance report generated successfully',
      code: 200,
      data: result
    });
  } catch (error) {
    console.error('Error generating attendance report:', error);
    console.error('Error stack:', error.stack);
    
    // Try to get error message safely
    let errorMessage = 'Failed to generate attendance report';
    try {
      if (mongoErrorMessages && typeof mongoErrorMessages === 'object') {
        const matchedKey = Object.keys(mongoErrorMessages).find(key => error.message && error.message.includes(key));
        errorMessage = matchedKey ? mongoErrorMessages[matchedKey] : (error.message || errorMessage);
      } else {
        errorMessage = error.message || errorMessage;
      }
    } catch (e) {
      errorMessage = error.message || errorMessage;
    }
    
    res.status(500).json({
      success: false,
      message: errorMessage,
      code: 500,
      error: error.message || errorMessage,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

/**
 * Get student-wise attendance report
 */
const getStudentAttendanceReport = async (req, res) => {
  try {
    const { startDate, endDate, ClassCode, SectionCode, StudentId } = req.query;
    const instutionCode = req.user.InstutionCode;

    let matchCondition = { InstutionId: instutionCode };

    if (ClassCode) {
      matchCondition.Class_Code = ClassCode;
    }

    // Get students filter
    let studentFilter = { InstutionCode: instutionCode };
    if (ClassCode) {
      studentFilter.Class_Code = ClassCode;
    }
    if (SectionCode) {
      studentFilter.SectionCode = SectionCode;
    }
    if (StudentId) {
      studentFilter.Registration_Number = { $regex: StudentId, $options: 'i' };
    }

    const students = await studentModel.find(studentFilter)
      .select('Registration_Number First_Name Last_Name Class Section')
      .lean();

    let attendanceRecords = await attendanceModel.find(matchCondition).lean();

    // Filter by date range if provided (Date is stored as string)
    if (startDate && endDate) {
      try {
        attendanceRecords = attendanceRecords.filter(record => {
          if (!record.Date) return false;
          return isDateInRange(record.Date, startDate, endDate);
        });
      } catch (dateError) {
        console.error('Error filtering by date:', dateError);
        // Continue without date filtering if there's an error
      }
    }

    // Calculate attendance for each student
    const studentAttendanceData = students.map(student => {
      const studentId = student.Registration_Number;
      let present = 0;
      let absent = 0;

      attendanceRecords.forEach(record => {
        if (record.Attendence && Array.isArray(record.Attendence)) {
          const studentAtt = record.Attendence.find(a => 
            a.StudentId && a.StudentId.toString() === studentId.toString()
          );
          if (studentAtt) {
            if (studentAtt.attendance === 'Present' || studentAtt.attendance === 'P') {
              present++;
            } else {
              absent++;
            }
          }
        }
      });

      const total = present + absent;
      const percentage = total > 0 ? ((present / total) * 100).toFixed(2) : 0;

      return {
        studentId,
        studentName: `${student.First_Name || ''} ${student.Last_Name || ''}`.trim(),
        class: student.Class || '',
        section: student.Section || '',
        present,
        absent,
        total,
        percentage: parseFloat(percentage)
      };
    });

    res.status(200).json({
      success: true,
      message: 'Student attendance report generated successfully',
      code: 200,
      data: studentAttendanceData
    });
  } catch (error) {
    console.error('Error generating student attendance report:', error);
    const matchedKey = Object.keys(mongoErrorMessages).find(key => error.message.includes(key));
    const errorMessage = matchedKey ? mongoErrorMessages[matchedKey] : error.message;
    res.status(500).json({
      success: false,
      message: errorMessage || 'Failed to generate student attendance report',
      code: 500,
      error: errorMessage
    });
  }
};

/**
 * Get fee collection report
 */
const getFeeCollectionReport = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const instutionCode = req.user.InstutionCode;

    let matchCondition = {
      InstutionCode: instutionCode,
      Status: 'Paid'
    };

    if (startDate && endDate) {
      matchCondition.Payment_Date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    const feeData = await feePaymentModel.aggregate([
      { $match: matchCondition },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: '$Amount' },
          totalPayments: { $sum: 1 },
          averageAmount: { $avg: '$Amount' }
        }
      },
      {
        $project: {
          _id: 0,
          totalAmount: 1,
          totalPayments: 1,
          averageAmount: { $round: ['$averageAmount', 2] }
        }
      }
    ]);

    return successResponse(res, feeData[0] || {}, 'Fee collection report generated successfully');
  } catch (error) {
    logger.error('Error generating fee report:', error);
    return errorResponse(res, 'Failed to generate fee report', 500);
  }
};

/**
 * Get academic performance report - Class-wise summary
 */
const getAcademicReport = async (req, res) => {
  try {
    const { ClassCode, ExamType, Year } = req.query;
    const instutionCode = req.user.InstutionCode;

    if (!instutionCode) {
      return res.status(400).json({
        success: false,
        message: 'Institution code is required',
        code: 400
      });
    }

    // Get class name from ClassCode if provided
    let className = null;
    if (ClassCode) {
      const classRecord = await classModel.findOne({
        InstutionCode: instutionCode,
        ClassCode: ClassCode
      }).select('ClassName').lean();
      
      if (classRecord) {
        className = classRecord.ClassName;
      }
    }

    let matchCondition = { Instution_Id: instutionCode };

    // Use className for matching (marksheet stores ClassName in Class field)
    if (className) {
      matchCondition.Class = className;
    }

    if (ExamType) {
      matchCondition.Exam_type = { $regex: ExamType, $options: 'i' };
    }

    if (Year) {
      matchCondition.Year = Year.toString();
    }

    const marksheets = await marksheetModel.find(matchCondition).lean();

    // Log for debugging
    console.log('Academic Report Query:', {
      instutionCode,
      ClassCode,
      className,
      ExamType,
      Year,
      matchCondition,
      marksheetsCount: marksheets.length
    });

    // If no marksheets found, return empty result
    if (!marksheets || marksheets.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'Academic report generated successfully',
        code: 200,
        data: []
      });
    }

    // Group by class
    const classSummary = {};

    marksheets.forEach(marksheet => {
      const className = marksheet.Class || 'Unknown';
      if (!classSummary[className]) {
        classSummary[className] = {
          className,
          totalStudents: new Set(),
          totalMarks: 0,
          obtainedMarks: 0,
          passCount: 0,
          failCount: 0,
          percentages: []
        };
      }

      classSummary[className].totalStudents.add(marksheet.Student_Id);
      classSummary[className].totalMarks += parseFloat(marksheet.Total_Marks) || 0;
      classSummary[className].obtainedMarks += parseFloat(marksheet.Obtained_Marks) || 0;

      // Parse percentage (might be string like "85.50%" or number)
      let percentage = 0;
      if (marksheet.Percentage) {
        if (typeof marksheet.Percentage === 'string') {
          percentage = parseFloat(marksheet.Percentage.replace('%', '').trim()) || 0;
        } else {
          percentage = parseFloat(marksheet.Percentage) || 0;
        }
      }

      classSummary[className].percentages.push(percentage);

      if (percentage >= 40) {
        classSummary[className].passCount++;
      } else {
        classSummary[className].failCount++;
      }
    });

    const result = Object.values(classSummary).map(summary => {
      const totalStudents = summary.totalStudents.size;
      const avgPercentage = summary.percentages.length > 0
        ? (summary.percentages.reduce((a, b) => a + b, 0) / summary.percentages.length).toFixed(2)
        : 0;
      const passPercentage = totalStudents > 0
        ? ((summary.passCount / totalStudents) * 100).toFixed(2)
        : 0;

      return {
        className: summary.className,
        totalStudents,
        averageMarks: summary.totalStudents.size > 0
          ? (summary.obtainedMarks / summary.totalStudents.size).toFixed(2)
          : 0,
        averagePercentage: parseFloat(avgPercentage),
        passCount: summary.passCount,
        failCount: summary.failCount,
        passPercentage: parseFloat(passPercentage)
      };
    });

    res.status(200).json({
      success: true,
      message: 'Academic report generated successfully',
      code: 200,
      data: result
    });
  } catch (error) {
    console.error('Error generating academic report:', error);
    const matchedKey = Object.keys(mongoErrorMessages).find(key => error.message.includes(key));
    const errorMessage = matchedKey ? mongoErrorMessages[matchedKey] : error.message;
    res.status(500).json({
      success: false,
      message: errorMessage || 'Failed to generate academic report',
      code: 500,
      error: errorMessage
    });
  }
};

/**
 * Get student-wise academic report
 */
const getStudentAcademicReport = async (req, res) => {
  try {
    const { ClassCode, SectionCode, ExamType, Year, StudentId } = req.query;
    const instutionCode = req.user.InstutionCode;

    if (!instutionCode) {
      return res.status(400).json({
        success: false,
        message: 'Institution code is required',
        code: 400
      });
    }

    // Get class name from ClassCode if provided
    let className = null;
    if (ClassCode) {
      const classRecord = await classModel.findOne({
        InstutionCode: instutionCode,
        ClassCode: ClassCode
      }).select('ClassName').lean();
      
      if (classRecord) {
        className = classRecord.ClassName;
      }
    }

    // Build marksheet match condition
    let matchCondition = { Instution_Id: instutionCode };

    if (className) {
      matchCondition.Class = className;
    }

    if (ExamType) {
      matchCondition.Exam_type = { $regex: ExamType, $options: 'i' };
    }

    if (Year) {
      matchCondition.Year = Year.toString();
    }

    // Get students filter
    let studentFilter = { InstutionCode: instutionCode };
    if (ClassCode) {
      studentFilter.Class_Code = ClassCode;
    }
    if (SectionCode) {
      studentFilter.SectionCode = SectionCode;
    }
    if (StudentId) {
      studentFilter.Registration_Number = { $regex: StudentId, $options: 'i' };
    }

    // Fetch students and marksheets in parallel
    const [students, marksheets] = await Promise.all([
      studentModel.find(studentFilter)
        .select('Registration_Number First_Name Last_Name Class Section')
        .lean(),
      marksheetModel.find(matchCondition).lean()
    ]);

    // If no students found, return empty result
    if (!students || students.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'Student academic report generated successfully',
        code: 200,
        data: []
      });
    }

    // Map marksheets by student ID
    const studentMarksMap = {};
    marksheets.forEach(marksheet => {
      const studentId = marksheet.Student_Id;
      if (studentId) {
        if (!studentMarksMap[studentId]) {
          studentMarksMap[studentId] = [];
        }
        studentMarksMap[studentId].push(marksheet);
      }
    });

    // Process each student
    const result = students.map(student => {
      const studentId = student.Registration_Number;
      const studentMarks = studentMarksMap[studentId] || [];

      if (studentMarks.length === 0) {
        return {
          studentId,
          studentName: `${student.First_Name || ''} ${student.Last_Name || ''}`.trim(),
          class: student.Class || '',
          section: student.Section || '',
          totalMarks: 0,
          obtainedMarks: 0,
          percentage: 0,
          grade: 'N/A',
          cgpa: 0,
          result: 'N/A',
          examType: ExamType || 'All',
          year: Year || 'All'
        };
      }

      // Calculate totals from all marksheets
      const totalMarks = studentMarks.reduce((sum, m) => sum + (parseFloat(m.Total_Marks) || 0), 0);
      const obtainedMarks = studentMarks.reduce((sum, m) => sum + (parseFloat(m.Obtained_Marks) || 0), 0);
      
      // Calculate percentage from total and obtained marks (more accurate than averaging percentages)
      let percentage = 0;
      if (totalMarks > 0) {
        percentage = (obtainedMarks / totalMarks) * 100;
      } else {
        // Fallback to averaging percentages if total marks is 0
        let totalPercentage = 0;
        let validPercentages = 0;
        studentMarks.forEach(m => {
          if (m.Percentage) {
            let pct = 0;
            if (typeof m.Percentage === 'string') {
              pct = parseFloat(m.Percentage.replace('%', '').trim()) || 0;
            } else {
              pct = parseFloat(m.Percentage) || 0;
            }
            if (!isNaN(pct) && pct > 0) {
              totalPercentage += pct;
              validPercentages++;
            }
          }
        });
        if (validPercentages > 0) {
          percentage = totalPercentage / validPercentages;
        }
      }

      // Get latest marksheet for grade, CGPA, and result
      // Sort by creation date (newest first) or use the last one
      const sortedMarksheets = [...studentMarks].sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt) : new Date(0);
        const dateB = b.createdAt ? new Date(b.createdAt) : new Date(0);
        return dateB - dateA;
      });
      const latestMarksheet = sortedMarksheets[0] || studentMarks[studentMarks.length - 1];
      
      const grade = latestMarksheet.Grade || 'N/A';
      let cgpa = 0;
      if (latestMarksheet.CGPA !== undefined && latestMarksheet.CGPA !== null) {
        cgpa = typeof latestMarksheet.CGPA === 'number' 
          ? parseFloat(latestMarksheet.CGPA) 
          : parseFloat(latestMarksheet.CGPA) || 0;
      }
      const result = latestMarksheet.Result || 'N/A';

      return {
        studentId,
        studentName: `${student.First_Name || ''} ${student.Last_Name || ''}`.trim(),
        class: student.Class || latestMarksheet.Class || '',
        section: student.Section || '',
        totalMarks: Math.round(totalMarks * 100) / 100, // Round to 2 decimal places
        obtainedMarks: Math.round(obtainedMarks * 100) / 100,
        percentage: parseFloat(percentage.toFixed(2)),
        grade,
        cgpa: parseFloat(cgpa.toFixed(2)),
        result,
        examType: ExamType || 'All',
        year: Year || 'All'
      };
    });

    // Filter out students with no marks if StudentId filter is applied (to show only matching students)
    // Otherwise, show all students (even those without marks)
    const finalResult = StudentId 
      ? result.filter(r => r.totalMarks > 0 || r.obtainedMarks > 0)
      : result;

    res.status(200).json({
      success: true,
      message: 'Student academic report generated successfully',
      code: 200,
      data: finalResult
    });
  } catch (error) {
    console.error('Error generating student academic report:', error);
    console.error('Error stack:', error.stack);
    
    let errorMessage = 'Failed to generate student academic report';
    try {
      if (mongoErrorMessages && typeof mongoErrorMessages === 'object') {
        const matchedKey = Object.keys(mongoErrorMessages).find(key => error.message && error.message.includes(key));
        errorMessage = matchedKey ? mongoErrorMessages[matchedKey] : (error.message || errorMessage);
      } else {
        errorMessage = error.message || errorMessage;
      }
    } catch (e) {
      errorMessage = error.message || errorMessage;
    }
    
    res.status(500).json({
      success: false,
      message: errorMessage,
      code: 500,
      error: error.message || errorMessage,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

/**
 * Get student statistics
 */
const getStudentStatistics = async (req, res) => {
  try {
    const instutionCode = req.user.InstutionCode;

    const stats = await studentModel.aggregate([
      { $match: { InstutionCode: instutionCode } },
      {
        $group: {
          _id: null,
          totalStudents: { $sum: 1 },
          activeStudents: {
            $sum: { $cond: ['$Status', 1, 0] }
          },
          inactiveStudents: {
            $sum: { $cond: ['$Status', 0, 1] }
          },
          byClass: {
            $push: {
              class: '$Class',
              status: '$Status'
            }
          }
        }
      },
      {
        $project: {
          _id: 0,
          totalStudents: 1,
          activeStudents: 1,
          inactiveStudents: 1
        }
      }
    ]);

    return successResponse(res, stats[0] || {}, 'Statistics retrieved successfully');
  } catch (error) {
    logger.error('Error fetching statistics:', error);
    return errorResponse(res, 'Failed to fetch statistics', 500);
  }
};

/**
 * Get comprehensive dashboard data
 */
const getDashboardData = async (req, res) => {
  try {
    const instutionCode = req.user.InstutionCode;

    const [studentStats, attendanceStats, feeStats] = await Promise.all([
      studentModel.aggregate([
        { $match: { InstutionCode: instutionCode } },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            active: { $sum: { $cond: ['$Status', 1, 0] } }
          }
        }
      ]),
      attendanceModel.aggregate([
        {
          $match: {
            InstutionCode: instutionCode,
            Date: { $gte: new Date(new Date().setDate(new Date().getDate() - 30)) }
          }
        },
        {
          $group: {
            _id: null,
            present: { $sum: { $cond: [{ $eq: ['$Status', 'Present'] }, 1, 0] } },
            absent: { $sum: { $cond: [{ $eq: ['$Status', 'Absent'] }, 1, 0] } }
          }
        }
      ]),
      feePaymentModel.aggregate([
        {
          $match: {
            InstutionCode: instutionCode,
            Payment_Date: { $gte: new Date(new Date().setMonth(new Date().getMonth() - 1)) },
            Status: 'Paid'
          }
        },
        {
          $group: {
            _id: null,
            totalAmount: { $sum: '$Amount' },
            count: { $sum: 1 }
          }
        }
      ])
    ]);

    const dashboardData = {
      students: studentStats[0] || { total: 0, active: 0 },
      attendance: attendanceStats[0] || { present: 0, absent: 0 },
      fees: feeStats[0] || { totalAmount: 0, count: 0 }
    };

    return successResponse(res, dashboardData, 'Dashboard data retrieved successfully');
  } catch (error) {
    logger.error('Error fetching dashboard data:', error);
    return errorResponse(res, 'Failed to fetch dashboard data', 500);
  }
};

/**
 * Get class-wise comprehensive report
 */
const getClassReport = async (req, res) => {
  try {
    const { ClassCode, SectionCode, Year } = req.query;
    const instutionCode = req.user?.InstutionCode;

    if (!instutionCode) {
      return res.status(400).json({
        success: false,
        message: 'Institution code is required',
        code: 400
      });
    }

    if (!ClassCode) {
      return res.status(400).json({
        success: false,
        message: 'ClassCode is required',
        code: 400
      });
    }

    // Get class info
    const classInfo = await classModel.findOne({
      InstutionCode: instutionCode,
      ClassCode: ClassCode
    }).lean();

    if (!classInfo) {
      return res.status(404).json({
        success: false,
        message: `Class with code "${ClassCode}" not found`,
        code: 404
      });
    }

    // Get students
    let studentFilter = { InstutionCode: instutionCode, Class_Code: ClassCode };
    if (SectionCode) {
      studentFilter.SectionCode = SectionCode;
    }

    const students = await studentModel.find(studentFilter)
      .select('Registration_Number First_Name Last_Name Class Section Status')
      .lean();

    // If no students found, return empty result with class info
    if (!students || students.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'Class report generated successfully',
        code: 200,
        data: {
          classInfo: {
            classCode: classInfo.ClassCode,
            className: classInfo.ClassName,
            session: classInfo.Session
          },
          totalStudents: 0,
          activeStudents: 0,
          inactiveStudents: 0,
          students: []
        }
      });
    }

    // Get attendance summary
    const attendanceRecords = await attendanceModel.find({
      InstutionId: instutionCode,
      Class_Code: ClassCode
    }).lean();

    const attendanceSummary = {};
    students.forEach(student => {
      attendanceSummary[student.Registration_Number] = { present: 0, absent: 0 };
    });

    attendanceRecords.forEach(record => {
      if (record.Attendence && Array.isArray(record.Attendence)) {
        record.Attendence.forEach(att => {
          if (attendanceSummary[att.StudentId]) {
            if (att.attendance === 'Present' || att.attendance === 'P') {
              attendanceSummary[att.StudentId].present++;
            } else {
              attendanceSummary[att.StudentId].absent++;
            }
          }
        });
      }
    });

    // Get academic summary
    let marksheetFilter = { Instution_Id: instutionCode, Class: classInfo.ClassName };
    if (Year) {
      marksheetFilter.Year = Year.toString();
    }

    const marksheets = await marksheetModel.find(marksheetFilter).lean();
    const academicSummary = {};
    
    // Initialize academic summary for all students
    students.forEach(student => {
      academicSummary[student.Registration_Number] = {
        totalMarksheets: 0,
        averagePercentage: 0,
        latestGrade: 'N/A',
        totalMarks: 0,
        obtainedMarks: 0
      };
    });

    // Process marksheets
    marksheets.forEach(marksheet => {
      const studentId = marksheet.Student_Id;
      if (academicSummary[studentId]) {
        academicSummary[studentId].totalMarksheets++;
        
        // Add to totals
        academicSummary[studentId].totalMarks += parseFloat(marksheet.Total_Marks) || 0;
        academicSummary[studentId].obtainedMarks += parseFloat(marksheet.Obtained_Marks) || 0;
        
        // Parse percentage
        let percentage = 0;
        if (marksheet.Percentage) {
          if (typeof marksheet.Percentage === 'string') {
            percentage = parseFloat(marksheet.Percentage.replace('%', '').trim()) || 0;
          } else {
            percentage = parseFloat(marksheet.Percentage) || 0;
          }
        }
        academicSummary[studentId].averagePercentage += percentage;
        academicSummary[studentId].latestGrade = marksheet.Grade || 'N/A';
      }
    });

    // Calculate averages
    Object.keys(academicSummary).forEach(studentId => {
      const summary = academicSummary[studentId];
      if (summary.totalMarksheets > 0) {
        // Calculate average percentage
        summary.averagePercentage = parseFloat((summary.averagePercentage / summary.totalMarksheets).toFixed(2));
      } else {
        summary.averagePercentage = 0;
      }
    });

    const result = {
      classInfo: {
        classCode: classInfo.ClassCode,
        className: classInfo.ClassName,
        session: classInfo.Session
      },
      totalStudents: students.length,
      activeStudents: students.filter(s => s.Status).length,
      inactiveStudents: students.filter(s => !s.Status).length,
      students: students.map(student => {
        const att = attendanceSummary[student.Registration_Number] || { present: 0, absent: 0 };
        const total = att.present + att.absent;
        const attPercentage = total > 0 ? ((att.present / total) * 100).toFixed(2) : 0;
        const acad = academicSummary[student.Registration_Number] || { 
          averagePercentage: 0, 
          latestGrade: 'N/A',
          totalMarksheets: 0,
          totalMarks: 0,
          obtainedMarks: 0
        };

        return {
          studentId: student.Registration_Number,
          studentName: `${student.First_Name || ''} ${student.Last_Name || ''}`.trim(),
          section: student.Section || '',
          status: student.Status ? 'Active' : 'Inactive',
          attendance: {
            present: att.present,
            absent: att.absent,
            total,
            percentage: parseFloat(attPercentage)
          },
          academic: {
            averagePercentage: acad.averagePercentage || 0,
            latestGrade: acad.latestGrade || 'N/A',
            totalMarksheets: acad.totalMarksheets || 0,
            totalMarks: acad.totalMarks || 0,
            obtainedMarks: acad.obtainedMarks || 0
          }
        };
      })
    };

    // Ensure students array exists and is properly formatted
    if (!result.students || !Array.isArray(result.students)) {
      result.students = [];
    }

    console.log('Class report result:', {
      classInfo: result.classInfo,
      totalStudents: result.totalStudents,
      studentsCount: result.students.length,
      firstStudent: result.students[0]
    });

    res.status(200).json({
      success: true,
      message: 'Class report generated successfully',
      code: 200,
      data: result
    });
  } catch (error) {
    console.error('Error generating class report:', error);
    const matchedKey = Object.keys(mongoErrorMessages).find(key => error.message.includes(key));
    const errorMessage = matchedKey ? mongoErrorMessages[matchedKey] : error.message;
    res.status(500).json({
      success: false,
      message: errorMessage || 'Failed to generate class report',
      code: 500,
      error: errorMessage
    });
  }
};

module.exports = {
  getAttendanceReport,
  getStudentAttendanceReport,
  getFeeCollectionReport,
  getAcademicReport,
  getStudentAcademicReport,
  getClassReport,
  getStudentStatistics,
  getDashboardData
};

