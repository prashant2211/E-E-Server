const { response } = require('express')
const attendenceRecordModel = require('../models/attendenceRecordModel')

const { getPermissionSet } = require('./permissionAssinment');
const studentModel         = require('../models/studentModel')
const StudentEnrollment    = require('../models/studentEnrollmentModel')
const mongoErrorMessages = require('./mongoErrors.json');
const { AcademicYear } = require('../models/academicYearModel')

// Helper to safely parse attendance status
const isPresent = (val) => {
  if (!val) return false
  const v = String(val).toLowerCase()
  return v === 'present' || v === 'p'
}

const tryParseDate = (val) => {
  if (!val) return null
  const d = new Date(val)
  if (Number.isNaN(d.getTime())) return null
  return d
}

const resolveAcademicYearRange = async (req, fromDate, toDate) => {
  if (fromDate && toDate) {
    const from = tryParseDate(fromDate)
    const to = tryParseDate(toDate)
    if (from && to) return { from, to }
  }

  const academicYearId = req.headers?.['x-academic-year-id']
  if (!academicYearId) return null

  const academicYear = await AcademicYear.findOne({
    InstutionCode: req.user?.InstutionCode,
    _id: academicYearId,
    Status: true,
  }).lean()

  if (!academicYear?.Start_Date || !academicYear?.End_Date) return null
  return { from: academicYear.Start_Date, to: academicYear.End_Date }
}

//Show the list of attendence

const index = async (req, res, next) => {
  const permissionsResult = await getPermissionSet(req)
  const attPerms =
    (permissionsResult.attendenceRecordModels && permissionsResult.attendenceRecordModels.split('-')) || []
  if (!attPerms.includes('RA') && !attPerms.includes('R')) {
    return res.status(403).json({
      code: 403,
      success: false,
      message:
        'You do not have the necessary permissions to access this resource. Please contact your administrator',
    })
  }

    try {
        const page = parseInt(req.query.PageNumber) || 1;
        const limit = parseInt(req.query.PageSize) || 10;
        const skip = (page - 1) * limit;
        const searchText = req.query.SearchText || '';

        let searchCondition = {
            InstutionId: req.user.InstutionCode // Always filter by institution
        };

        // Filter by Class
        if (req.query.ClassCode) {
            searchCondition.Class_Code = req.query.ClassCode;
        }

        // Filter by Date
        if (req.query.Date) {
            // Date can be in various formats, try to match it
            searchCondition.Date = { $regex: req.query.Date, $options: 'i' };
        }

        // Filter by Subject
        if (req.query.Subject) {
            searchCondition.Subject = { $regex: req.query.Subject, $options: 'i' };
        }

        // Filter by Section (need to check if attendance records have section info)
        // For now, we'll filter by checking if any student in the attendance belongs to that section
        // This requires checking the student records, so we'll handle it after fetching

        // Filter by Student Registration Number
        if (req.query.StudentId) {
            // We'll filter this after fetching by checking the Attendence array
            searchCondition['Attendence.StudentId'] = { $regex: req.query.StudentId, $options: 'i' };
        }

        if (req.query.Availability === 'P') {
            searchCondition.Availability = true;
        } else if (req.query.Availability === 'A') {
            searchCondition.Availability = false;
        }

        if (searchText) {
            searchCondition.$or = [
                { Time: { $regex: searchText, $options: 'i' } },
                { Class_Code: { $regex: searchText, $options: 'i' } },
                { Subject: { $regex: searchText, $options: 'i' } },
                { Subject_Teacher: { $regex: searchText, $options: 'i' } },
                { Date: { $regex: searchText, $options: 'i' } }
            ];
        }

        let attendences = await attendenceRecordModel.find(searchCondition).skip(skip).limit(limit).sort({ Date: -1, Time: -1 });
        let totalCount = await attendenceRecordModel.countDocuments(searchCondition);

        // Filter by Section if provided (check students in attendance records)
        if (req.query.Section) {
            const sectionCode = req.query.Section;
            // Get students in this section
            const studentsInSection = await studentModel.find({
                InstutionCode: req.user.InstutionCode,
                SectionCode: sectionCode
            }).select('Registration_Number').lean();

            const sectionStudentIds = studentsInSection.map(s => s.Registration_Number);

            // Filter attendance records to only include those with students from this section
            attendences = attendences.filter(att => {
                if (!att.Attendence || !Array.isArray(att.Attendence)) return false;
                return att.Attendence.some(a => sectionStudentIds.includes(a.StudentId));
            });

            // Re-count after section filter
            totalCount = attendences.length;
        }

        // Filter by Student Registration Number if provided (more precise)
        if (req.query.StudentId && !searchCondition['Attendence.StudentId']) {
            const studentId = req.query.StudentId;
            attendences = attendences.filter(att => {
                if (!att.Attendence || !Array.isArray(att.Attendence)) return false;
                return att.Attendence.some(a => 
                    a.StudentId && a.StudentId.toString().toLowerCase().includes(studentId.toLowerCase())
                );
            });
            totalCount = attendences.length;
        }

        res.status(200).json({
            success: true,
            message: "Data retrieved successfully",
            code: 200,
            totalRecords: totalCount,
            data: attendences.map(attendence => ({
                _id: attendence._id,
                ClassCode: attendence.Class_Code,
                Attendence: attendence.Attendence,
                Subject: attendence.Subject,
                SubjectTeacher: attendence.Subject_Teacher,
                InstutionId: attendence.InstutionId,
                Date: attendence.Date,
                Time: attendence.Time,
            }))
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


// Get single attendence Record

const show = async (req, res, next) => {
  const permissionsResult = await getPermissionSet(req)
  const attPerms =
    (permissionsResult.attendenceRecordModels && permissionsResult.attendenceRecordModels.split('-')) || []
  if (!attPerms.includes('R')) {
    return res.status(403).json({
      code: 403,
      success: false,
      message:
        'You do not have the necessary permissions to access this resource. Please contact your administrator',
    })
  }
    const currentDate = new Date();
    const date = currentDate.toLocaleDateString();  
    const time = currentDate.toLocaleTimeString(); 

 try{

    let formattedRecords = []
  const attendenceRecord = await attendenceRecordModel.find({ Class_Code:req.query.Class, InstutionId: req.user.InstutionCode, Date: date});
  formattedRecords = attendenceRecord.map(stuAttendence => ({
        studentName: stuAttendence.Attendence,           
    }))
    
  res.status(200).json({
    success: true,
    message: "Data retrieved successfully",
    code: 200,
    data:attendenceRecord
})


} catch(error){
    const matchedKey = Object.keys(mongoErrorMessages).find(key => error.message.includes(key));
    const errorMessage = matchedKey ? mongoErrorMessages[matchedKey] : error.message;
    res.status(401).json({
        message: errorMessage,
        status:401
    })
    
}
}

const getAllStudent = async (req, res, next) => {
    const permissionsResult = await getPermissionSet(req);
    const attPerms =
      (permissionsResult.attendenceRecordModels && permissionsResult.attendenceRecordModels.split('-')) || []
    if(attPerms.includes('R')){
        const query = {
            Class: req.query.Class,
            InstutionCode: req.user.InstutionCode
        };

        // Add section filter if provided
        if (req.query.Section) {
            query.SectionCode = req.query.Section;
        }

        const studentRecord = await studentModel.find(query);

        let formattedRecords = studentRecord.map(student => ({
            StudentName: student.First_Name+' '+student.Last_Name, 
            StudentId: student.Registration_Number,  
            attendance: "Absent"           
        }));

      
        res.status(200).json({
            success: true,
            message: 'Student record retrieved successfully!',
            code: 200,
            data:formattedRecords
        });


     } else{
            res.status(401).json({
                code: 401,
                success: false,
                message: 'You do not have the necessary permissions to access this resource. Please contact your administrator'
            })
        }

}



// Add attendence to dataBase
const store = async (req, res, next) => {
   const permissionsResult = await getPermissionSet(req);
   const attPermsStore =
     (permissionsResult.attendenceRecordModels && permissionsResult.attendenceRecordModels.split('-')) || []
   if(attPermsStore.includes('W')){

        // Get the current date and time
        const currentDate = new Date();
        const date = currentDate.toLocaleDateString();  
        const time = currentDate.toLocaleTimeString(); 

        // Resolve academic year for this attendance batch (optional)
        let academicYearId = null
        let academicYearName = ''
        const academicYearHeaderId = req.headers['x-academic-year-id']
        if (academicYearHeaderId) {
            const yearDoc = await AcademicYear.findOne({
                _id: academicYearHeaderId,
                InstutionCode: req.user.InstutionCode,
                Status: true,
            }).lean()
            if (yearDoc) {
                academicYearId = yearDoc._id.toString()
                academicYearName = yearDoc.Year_Name || ''
            }
        }

        if(req.body.InstutionId === ''){
            req.body.InstutionId = req.user.InstutionCode
        }

        if(req.body.TeacherId === ''){
            req.body.TeacherId = req.user.MemberId;
        }

        for (let student of req.body.Attendance) {
            const studentRecord = await studentModel.find({ Registration_Number: { $in: student.StudentId } });
            if (studentRecord && studentRecord.length > 0) {
                if(student.attendance === 'Present'){
                let students = await updateStudentAttendence(studentRecord[0]._id, studentRecord[0].Attended_Classes + 1, studentRecord[0].Total_Classes + 1)

                } else if(student.attendance === 'Absent'){
            let students = await updateStudentAttendence(studentRecord[0]._id, studentRecord[0].Attended_Classes, studentRecord[0].Total_Classes + 1)
                }
            }
        }
     

    let attendence = new attendenceRecordModel({
        Class_Code: req.body.ClassCode,
        Attendence: req.body.Attendance,
        Subject: req.body.Subject,
        Subject_Teacher:  req.body.TeacherId,
        InstutionId: req.body.InstutionId,
        Date: date,
        Time: time,
        AcademicYearId: academicYearId,
        AcademicYearName: academicYearName
    })
    attendence.save()
        .then(response => {
            res.status(200).json({
                success: true,
                message: 'attendence added successfully!',
                code: 200
            });
        })
        .catch(error => {
            const matchedKey = Object.keys(mongoErrorMessages).find(key => error.message.includes(key));
            const errorMessage = matchedKey ? mongoErrorMessages[matchedKey] : error.message;
            res.status(401).json({
                code: 401,
                success: false,
                message: errorMessage
            });
        });
   }else{
        res.status(403).json({
            code: 403,
            success: false,
            message: 'You do not have the necessary permissions to access this resource. Please contact your administrator'
        })
    }
}


const updateStudentAttendence = async (studentId, attendendClass, totalClass) => {

    let updateData = {
        Attended_Classes : attendendClass,
        Total_Classes    : totalClass
    }

    studentModel.findByIdAndUpdate(studentId, { $set: updateData })
    .then(response => {
       return response;
    })
    .catch(error => {
       return error;
    });
}


// Get attendance records for a specific student
const getStudentAttendance = async (req, res, next) => {
    const permissionsResult = await getPermissionSet(req);
    const attPermsStudent =
      (permissionsResult.attendenceRecordModels && permissionsResult.attendenceRecordModels.split('-')) || []
    if(attPermsStudent.includes('R')){
        try {
            const studentId = req.query.StudentId || req.query.RegistrationNumber;
            
            if (!studentId) {
                return res.status(400).json({
                    success: false,
                    code: 400,
                    message: 'Student Registration Number is required'
                });
            }

            // Get all attendance records for this institution
            const allRecords = await attendenceRecordModel.find({
                InstutionId: req.user.InstutionCode
            }).sort({ Date: -1, Time: -1 });

            // Filter records that contain this student
            const studentRecords = allRecords.filter(record => {
                if (!record.Attendence || !Array.isArray(record.Attendence)) return false;
                return record.Attendence.some(a => 
                    a.StudentId && a.StudentId.toString().toLowerCase() === studentId.toLowerCase()
                );
            });

            // Extract student's attendance from each record
            const studentAttendance = studentRecords.map(record => {
                const studentAtt = record.Attendence.find(a => 
                    a.StudentId && a.StudentId.toString().toLowerCase() === studentId.toLowerCase()
                );
                return {
                    _id: record._id,
                    Date: record.Date,
                    Time: record.Time,
                    ClassCode: record.Class_Code,
                    Subject: record.Subject,
                    Attendance: studentAtt ? studentAtt.attendance : 'Absent',
                    SubjectTeacher: record.Subject_Teacher
                };
            });

            // Get student info
            const student = await studentModel.findOne({
                Registration_Number: studentId,
                InstutionCode: req.user.InstutionCode
            }).select('First_Name Last_Name Registration_Number Class Section SectionCode').lean();

            res.status(200).json({
                success: true,
                message: 'Student attendance retrieved successfully!',
                code: 200,
                data: {
                    student: student || null,
                    attendance: studentAttendance,
                    totalRecords: studentAttendance.length,
                    presentCount: studentAttendance.filter(a => a.Attendance === 'Present' || a.Attendance === 'P').length,
                    absentCount: studentAttendance.filter(a => a.Attendance === 'Absent' || a.Attendance === 'A').length
                }
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
    } else {
        res.status(403).json({
            code: 403,
            success: false,
            message: 'You do not have the necessary permissions to access this resource. Please contact your administrator'
        });
    }
}

// Analytics: institution and class-wise overview
const getAttendanceOverview = async (req, res, next) => {
    try {
        const instutionId = req.user?.InstutionCode
        if (!instutionId) {
            return res.status(401).json({
                success: false,
                code: 401,
                message: 'Institution context not found'
            })
        }

        const { ClassCode, fromDate, toDate } = req.query

        const matchCondition = {
            InstutionId: instutionId
        }

        if (ClassCode) {
            matchCondition.Class_Code = ClassCode
        }

        let records = await attendenceRecordModel.find(matchCondition)

        // Optional: date range filter from query or selected academic year header
        const range = await resolveAcademicYearRange(req, fromDate, toDate)
        if (range) {
          records = records.filter((rec) => {
            const d = tryParseDate(rec.Date)
            if (!d) return false
            return d >= range.from && d <= range.to
          })
        }

        let totalMarks = 0
        let presentMarks = 0

        const classStats = new Map()

        records.forEach(rec => {
            const cls = rec.Class_Code || 'Unknown'
            const list = Array.isArray(rec.Attendence) ? rec.Attendence : []

            if (!classStats.has(cls)) {
                classStats.set(cls, {
                    totalMarks: 0,
                    presentMarks: 0,
                    sessions: 0
                })
            }
            const stat = classStats.get(cls)

            list.forEach(a => {
                stat.totalMarks += 1
                totalMarks += 1
                if (isPresent(a.attendance)) {
                    stat.presentMarks += 1
                    presentMarks += 1
                }
            })
            stat.sessions += 1
        })

        const overallPercent = totalMarks ? (presentMarks * 100) / totalMarks : 0

        const classSummary = Array.from(classStats.entries()).map(([classCode, stat]) => {
            const percent = stat.totalMarks ? (stat.presentMarks * 100) / stat.totalMarks : 0
            return {
                classCode,
                sessions: stat.sessions,
                totalMarks: stat.totalMarks,
                presentMarks: stat.presentMarks,
                absentMarks: stat.totalMarks - stat.presentMarks,
                attendancePercent: parseFloat(percent.toFixed(1))
            }
        })

        res.status(200).json({
            success: true,
            code: 200,
            message: 'Attendance overview fetched successfully',
            data: {
                institution: {
                    totalMarks,
                    presentMarks,
                    absentMarks: totalMarks - presentMarks,
                    attendancePercent: parseFloat(overallPercent.toFixed(1))
                },
                classes: classSummary
            }
        })
    } catch (error) {
        const matchedKey = Object.keys(mongoErrorMessages).find(key => error.message.includes(key))
        const errorMessage = matchedKey ? mongoErrorMessages[matchedKey] : error.message
        res.status(500).json({
            success: false,
            message: errorMessage,
            code: 500,
            error: errorMessage
        })
    }
}

// Analytics: student-wise summary including subject breakdown
const getStudentAttendanceSummary = async (req, res, next) => {
    try {
        const instutionId = req.user?.InstutionCode
        if (!instutionId) {
            return res.status(401).json({
                success: false,
                code: 401,
                message: 'Institution context not found'
            })
        }

        const studentId = req.query.StudentId || req.query.RegistrationNumber
        if (!studentId) {
            return res.status(400).json({
                success: false,
                code: 400,
                message: 'Student Registration Number is required'
            })
        }

        const allRecords = await attendenceRecordModel.find({
            InstutionId: instutionId
        }).sort({ Date: -1, Time: -1 })

        // Optional: filter by selected academic year header or fromDate/toDate
        const range = await resolveAcademicYearRange(
          req,
          req.query.fromDate,
          req.query.toDate
        )
        const filteredRecords = range
          ? allRecords.filter((rec) => {
            const d = tryParseDate(rec.Date)
            if (!d) return false
            return d >= range.from && d <= range.to
          })
          : allRecords

        const studentRecords = filteredRecords.filter(record => {
            if (!record.Attendence || !Array.isArray(record.Attendence)) return false
            return record.Attendence.some(a =>
                a.StudentId && a.StudentId.toString().toLowerCase() === studentId.toLowerCase()
            )
        })

        let totalSessions = 0
        let presentCount = 0
        let absentCount = 0
        const subjectMap = new Map()

        const attendanceList = studentRecords.map(record => {
            const studentAtt = record.Attendence.find(a =>
                a.StudentId && a.StudentId.toString().toLowerCase() === studentId.toLowerCase()
            )
            const status = studentAtt ? studentAtt.attendance : 'Absent'
            const present = isPresent(status)

            totalSessions += 1
            if (present) {
                presentCount += 1
            } else {
                absentCount += 1
            }

            const subject = record.Subject || 'Unknown'
            if (!subjectMap.has(subject)) {
                subjectMap.set(subject, { total: 0, present: 0, absent: 0 })
            }
            const s = subjectMap.get(subject)
            s.total += 1
            if (present) s.present += 1
            else s.absent += 1

            return {
                _id: record._id,
                Date: record.Date,
                Time: record.Time,
                ClassCode: record.Class_Code,
                Subject: record.Subject,
                Attendance: status,
                SubjectTeacher: record.Subject_Teacher
            }
        })

        const subjectWise = Array.from(subjectMap.entries()).map(([subject, stat]) => {
            const percent = stat.total ? (stat.present * 100) / stat.total : 0
            return {
                subject,
                totalSessions: stat.total,
                present: stat.present,
                absent: stat.absent,
                attendancePercent: parseFloat(percent.toFixed(1))
            }
        })

        const student = await studentModel.findOne({
            Registration_Number: studentId,
            InstutionCode: instutionId
        }).select('First_Name Last_Name Registration_Number Class Section SectionCode').lean()

        // In academic-year view, student enrollment may have changed.
        // We show the class code from attendance records to avoid confusion.
        const displayClassCode = studentRecords[0]?.Class_Code
        if (student && displayClassCode) {
            student.Class = displayClassCode
        }

        const overallPercent = totalSessions ? (presentCount * 100) / totalSessions : 0

        res.status(200).json({
            success: true,
            code: 200,
            message: 'Student attendance summary fetched successfully',
            data: {
                student: student || null,
                overall: {
                    totalSessions,
                    presentCount,
                    absentCount,
                    attendancePercent: parseFloat(overallPercent.toFixed(1))
                },
                subjectWise,
                records: attendanceList
            }
        })
    } catch (error) {
        const matchedKey = Object.keys(mongoErrorMessages).find(key => error.message.includes(key))
        const errorMessage = matchedKey ? mongoErrorMessages[matchedKey] : error.message
        res.status(500).json({
            success: false,
            message: errorMessage,
            code: 500,
            error: errorMessage
        })
    }
}

module.exports = {
    index,
    show,
    store,
    getAllStudent,
    getStudentAttendance,
    getAttendanceOverview,
    getStudentAttendanceSummary,
}