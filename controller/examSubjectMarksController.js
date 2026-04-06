const examSubjectMarksModel = require('../models/examSubjectMarksModel')
const studentModel = require('../models/studentModel')
const classModel = require('../models/classModel')
const { getPermissionSet } = require('./permissionAssinment')
const mongoErrorMessages = require('./mongoErrors.json')
const { resolveAcademicYearScope } = require('../utils/academicYearScope')

// Get all subject marks entries (with filters)
const index = async (req, res, next) => {
  try {
    const permissionsResult = await getPermissionSet(req)
    if (!permissionsResult.studentMarksheet || !permissionsResult.studentMarksheet.split('-').includes('RA')) {
      return res.status(403).json({
        code: 403,
        success: false,
        message: 'You do not have the necessary permissions to access this resource. Please contact your administrator',
      })
    }

    const page = parseInt(req.query.PageNumber) || 1
    const limit = parseInt(req.query.PageSize) || 10
    const skip = (page - 1) * limit
    const instutionCode = req.user.InstutionCode

    let searchCondition = {
      InstutionCode: instutionCode,
    }

    // Apply filters
    if (req.query.ClassCode) {
      searchCondition.ClassCode = req.query.ClassCode
    }
    if (req.query.SectionCode) {
      searchCondition.SectionCode = req.query.SectionCode
    }
    if (req.query.ExamType) {
      searchCondition.ExamType = { $regex: req.query.ExamType, $options: 'i' }
    }
    if (req.query.Subject) {
      searchCondition.Subject = { $regex: req.query.Subject, $options: 'i' }
    }

    // Academic year view filter (uses ExamDate)
    const scope = await resolveAcademicYearScope(req)
    if (scope?.from && scope?.to) {
      searchCondition.ExamDate = { $gte: scope.from, $lte: scope.to }
    }

    const [subjectMarks, totalCount] = await Promise.all([
      examSubjectMarksModel.find(searchCondition).skip(skip).limit(limit).sort({ createdAt: -1 }),
      examSubjectMarksModel.countDocuments(searchCondition),
    ])

    res.status(200).json({
      success: true,
      message: 'Subject marks fetched successfully!',
      code: 200,
      totalRecords: totalCount,
      data: subjectMarks,
    })
  } catch (error) {
    console.error('Error fetching subject marks:', error)
    const matchedKey = Object.keys(mongoErrorMessages).find((key) => error.message.includes(key))
    const errorMessage = matchedKey ? mongoErrorMessages[matchedKey] : error.message
    res.status(500).json({
      success: false,
      message: errorMessage || 'Failed to fetch subject marks',
      code: 500,
      error: errorMessage,
    })
  }
}

// Get subject marks for a specific class/section/exam/subject
const show = async (req, res, next) => {
  try {
    const permissionsResult = await getPermissionSet(req)
    if (!permissionsResult.studentMarksheet || !permissionsResult.studentMarksheet.split('-').includes('RA')) {
      return res.status(403).json({
        code: 403,
        success: false,
        message: 'You do not have the necessary permissions to access this resource. Please contact your administrator',
      })
    }

    const { ClassCode, SectionCode, ExamType, Subject } = req.query
    const instutionCode = req.user.InstutionCode

    if (!ClassCode || !ExamType || !Subject) {
      return res.status(400).json({
        success: false,
        code: 400,
        message: 'ClassCode, ExamType, and Subject are required',
      })
    }

    const searchCondition = {
      InstutionCode: instutionCode,
      ClassCode,
      ExamType,
      Subject,
    }

    const scope = await resolveAcademicYearScope(req)
    if (scope?.from && scope?.to) {
      searchCondition.ExamDate = { $gte: scope.from, $lte: scope.to }
    }

    if (SectionCode) {
      searchCondition.SectionCode = SectionCode
    } else {
      searchCondition.SectionCode = { $in: ['', null] }
    }

    const subjectMarks = await examSubjectMarksModel.findOne(searchCondition)

    if (!subjectMarks) {
      return res.status(200).json({
        success: true,
        message: 'No marks found for this subject',
        code: 200,
        data: null,
      })
    }

    res.status(200).json({
      success: true,
      message: 'Subject marks fetched successfully!',
      code: 200,
      data: subjectMarks,
    })
  } catch (error) {
    console.error('Error fetching subject marks:', error)
    const matchedKey = Object.keys(mongoErrorMessages).find((key) => error.message.includes(key))
    const errorMessage = matchedKey ? mongoErrorMessages[matchedKey] : error.message
    res.status(500).json({
      success: false,
      message: errorMessage || 'Failed to fetch subject marks',
      code: 500,
      error: errorMessage,
    })
  }
}

// Create or update subject marks (upsert)
const store = async (req, res, next) => {
  try {
    const permissionsResult = await getPermissionSet(req)
    if (!permissionsResult.studentMarksheet || !permissionsResult.studentMarksheet.split('-').includes('W')) {
      return res.status(403).json({
        code: 403,
        success: false,
        message: 'You do not have the necessary permissions to access this resource. Please contact your administrator',
      })
    }

    const {
      ClassCode,
      SectionCode = '',
      ExamType,
      Subject,
      ExamDate,
      MaxMarks,
      Marks, // Array of { Student_Id, Student_Name, Obtained, Status }
    } = req.body

    const instutionCode = req.user.InstutionCode

    // Validation
    if (!ClassCode || !ExamType || !Subject || !MaxMarks || !Marks || !Array.isArray(Marks)) {
      return res.status(400).json({
        success: false,
        code: 400,
        message: 'ClassCode, ExamType, Subject, MaxMarks, and Marks array are required',
      })
    }

    // Get class name
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

    // Get section name if SectionCode provided
    let sectionName = ''
    if (SectionCode) {
      const sectionModel = require('../models/sectionModel')
      const sectionInfo = await sectionModel.findOne({
        SectionCode,
        ClassCode,
        InstutionCode: instutionCode,
      }).select('SectionName').lean()
      sectionName = sectionInfo?.SectionName || ''
    }

    // Validate marks
    for (const mark of Marks) {
      if (!mark.Student_Id || mark.Obtained === undefined || mark.Obtained === null) {
        return res.status(400).json({
          success: false,
          code: 400,
          message: 'Each mark entry must have Student_Id and Obtained marks',
        })
      }
      if (mark.Obtained > MaxMarks) {
        return res.status(400).json({
          success: false,
          code: 400,
          message: `Obtained marks (${mark.Obtained}) cannot exceed MaxMarks (${MaxMarks}) for student ${mark.Student_Id}`,
        })
      }
    }

    // Upsert: find existing or create new
    const searchCondition = {
      InstutionCode: instutionCode,
      ClassCode,
      SectionCode: SectionCode || '',
      ExamType,
      Subject,
    }

    const existingMarks = await examSubjectMarksModel.findOne(searchCondition)

    const marksData = {
      InstutionCode: instutionCode,
      ClassCode,
      ClassName: classInfo.ClassName,
      SectionCode: SectionCode || '',
      SectionName: sectionName,
      ExamType,
      Subject,
      ExamDate: ExamDate ? new Date(ExamDate) : undefined,
      MaxMarks,
      Marks,
      CreatedBy: req.user.MemberId || req.user._id?.toString() || '',
      CreatedByName: req.user.Name || req.user.UserName || '',
    }

    let result
    if (existingMarks) {
      // Update existing
      result = await examSubjectMarksModel.findOneAndUpdate(
        searchCondition,
        { $set: marksData },
        { new: true, runValidators: true }
      )
    } else {
      // Create new
      result = await examSubjectMarksModel.create(marksData)
    }

    res.status(existingMarks ? 200 : 201).json({
      success: true,
      message: existingMarks ? 'Subject marks updated successfully!' : 'Subject marks created successfully!',
      code: existingMarks ? 200 : 201,
      data: result,
    })
  } catch (error) {
    console.error('Error saving subject marks:', error)
    const matchedKey = Object.keys(mongoErrorMessages).find((key) => error.message.includes(key))
    const errorMessage = matchedKey ? mongoErrorMessages[matchedKey] : error.message
    res.status(500).json({
      success: false,
      message: errorMessage || 'Failed to save subject marks',
      code: 500,
      error: errorMessage,
    })
  }
}

// Delete subject marks
const destroy = async (req, res, next) => {
  try {
    const permissionsResult = await getPermissionSet(req)
    if (!permissionsResult.studentMarksheet || !permissionsResult.studentMarksheet.split('-').includes('D')) {
      return res.status(403).json({
        code: 403,
        success: false,
        message: 'You do not have the necessary permissions to access this resource. Please contact your administrator',
      })
    }

    const { id } = req.body
    const instutionCode = req.user.InstutionCode

    if (!id) {
      return res.status(400).json({
        success: false,
        code: 400,
        message: 'Subject marks ID is required',
      })
    }

    const deleted = await examSubjectMarksModel.findOneAndDelete({
      _id: id,
      InstutionCode: instutionCode,
    })

    if (!deleted) {
      return res.status(404).json({
        success: false,
        code: 404,
        message: 'Subject marks not found',
      })
    }

    res.status(200).json({
      success: true,
      message: 'Subject marks deleted successfully!',
      code: 200,
    })
  } catch (error) {
    console.error('Error deleting subject marks:', error)
    const matchedKey = Object.keys(mongoErrorMessages).find((key) => error.message.includes(key))
    const errorMessage = matchedKey ? mongoErrorMessages[matchedKey] : error.message
    res.status(500).json({
      success: false,
      message: errorMessage || 'Failed to delete subject marks',
      code: 500,
      error: errorMessage,
    })
  }
}

module.exports = {
  index,
  show,
  store,
  destroy,
}

