const { response } = require('express')
const sectionModel = require('../models/sectionModel')
const classModel = require('../models/classModel')
const { getPermissionSet } = require('./permissionAssinment')
const studentModel = require('../models/studentModel')
const mongoErrorMessages = require('./mongoErrors.json')

// Get all sections for a class
const index = async (req, res, next) => {
  const permissionsResult = await getPermissionSet(req)
  const classPermissions = String(permissionsResult?.classes || '')
  const classPermissionParts = classPermissions.split('-')

  if (classPermissionParts.includes('RA') || classPermissionParts.includes('R')) {
    try {
      const page = parseInt(req.query.PageNumber) || 1
      const limit = parseInt(req.query.PageSize) || 10
      const skip = (page - 1) * limit
      const classCode = req.query.ClassCode

      let searchCondition = {
        InstutionCode: req.user.InstutionCode,
      }

      if (classCode) {
        searchCondition.ClassCode = classCode
      }

      const [sections, totalCount] = await Promise.all([
        sectionModel.find(searchCondition).skip(skip).limit(limit).sort({ createdAt: -1 }),
        sectionModel.countDocuments(searchCondition),
      ])

      res.status(200).json({
        code: 200,
        success: true,
        message: 'Data retrieved successfully',
        totalRecords: totalCount,
        data: sections,
      })
    } catch (error) {
      const matchedKey = Object.keys(mongoErrorMessages).find((key) =>
        error.message.includes(key)
      )
      const errorMessage = matchedKey
        ? mongoErrorMessages[matchedKey]
        : error.message

      res.status(500).json({
        code: 500,
        success: false,
        message: errorMessage,
        error: errorMessage,
      })
    }
  } else {
    res.status(403).json({
      code: 403,
      success: false,
      message:
        'You do not have the necessary permissions to access this resource. Please contact your administrator.',
    })
  }
}

// Get single section record
const show = async (req, res, next) => {
  try {
    const permissionsResult = await getPermissionSet(req)
    if (!permissionsResult.classes.split('-').includes('R')) {
      return res.status(403).json({
        code: 403,
        success: false,
        message:
          'You do not have the necessary permissions to access this resource. Please contact your administrator.',
      })
    }

    const sectionId = req.params.id || req.body.sectionId || req.query.sectionId
    if (!sectionId) {
      return res.status(400).json({
        success: false,
        message: 'Section ID is required',
        code: 400,
      })
    }

    const section = await sectionModel.findById(sectionId)
    if (!section) {
      return res.status(404).json({
        success: false,
        message: 'Section not found',
        code: 404,
      })
    }

    res.status(200).json({
      success: true,
      message: 'Section fetched successfully',
      code: 200,
      data: section,
    })
  } catch (error) {
    const matchedKey = Object.keys(mongoErrorMessages).find((key) =>
      error.message.includes(key)
    )
    const errorMessage = matchedKey
      ? mongoErrorMessages[matchedKey]
      : error.message

    res.status(500).json({
      success: false,
      message: errorMessage,
      code: 500,
      error: errorMessage,
    })
  }
}

// Create new section
const store = async (req, res, next) => {
  const permissionsResult = await getPermissionSet(req)
  if (permissionsResult.classes.split('-').includes('W')) {
    try {
      // Validate that class exists
      const classRecord = await classModel.findOne({
        ClassCode: req.body.ClassCode,
        InstutionCode: req.user.InstutionCode,
      })

      if (!classRecord) {
        return res.status(404).json({
          success: false,
          code: 404,
          message: 'Class not found',
        })
      }

      // Generate section code
      const sectionCode = `${req.body.ClassCode}_${req.body.SectionName}`

      // Check if section already exists
      const existingSection = await sectionModel.findOne({
        SectionCode: sectionCode,
        InstutionCode: req.user.InstutionCode,
      })

      if (existingSection) {
        return res.status(400).json({
          success: false,
          code: 400,
          message: 'Section with this name already exists for this class',
        })
      }

      const sectionRecord = new sectionModel({
        ClassCode: req.body.ClassCode,
        InstutionCode: req.user.InstutionCode,
        SectionCode: sectionCode,
        SectionName: req.body.SectionName,
        NumberOfStudent: req.body.NumberOfStudent || 0,
        SessionTeacherName: req.body.SessionTeacherName,
      })

      await sectionRecord.save()

      res.status(201).json({
        success: true,
        code: 201,
        message: 'Section added successfully!',
        data: sectionRecord,
      })
    } catch (error) {
      const matchedKey = Object.keys(mongoErrorMessages).find((key) =>
        error.message.includes(key)
      )
      const errorMessage = matchedKey
        ? mongoErrorMessages[matchedKey]
        : error.message

      res.status(500).json({
        success: false,
        code: 500,
        message: errorMessage,
        error: errorMessage,
      })
    }
  } else {
    res.status(403).json({
      code: 403,
      success: false,
      message:
        'You do not have the necessary permissions to access this resource. Please contact your administrator',
    })
  }
}

// Update section record
const update = async (req, res, next) => {
  const permissionsResult = await getPermissionSet(req)
  if (permissionsResult.classes.split('-').includes('RA')) {
    try {
      const sectionId = req.body.sectionId
      if (!sectionId) {
        return res.status(400).json({
          success: false,
          code: 400,
          message: 'Section ID is required',
        })
      }

      const updateData = {
        SectionName: req.body.SectionName,
        NumberOfStudent: req.body.NumberOfStudent,
        SessionTeacherName: req.body.SessionTeacherName,
      }

      // If ClassCode or SectionName changed, update SectionCode
      if (req.body.ClassCode || req.body.SectionName) {
        const section = await sectionModel.findById(sectionId)
        if (!section) {
          return res.status(404).json({
            success: false,
            code: 404,
            message: 'Section not found',
          })
        }
        const newClassCode = req.body.ClassCode || section.ClassCode
        const newSectionName = req.body.SectionName || section.SectionName
        updateData.ClassCode = newClassCode
        updateData.SectionCode = `${newClassCode}_${newSectionName}`
      }

      const updatedSection = await sectionModel.findByIdAndUpdate(
        sectionId,
        { $set: updateData },
        { new: true }
      )

      if (!updatedSection) {
        return res.status(404).json({
          success: false,
          code: 404,
          message: 'Section not found',
        })
      }

      res.status(200).json({
        success: true,
        code: 200,
        message: 'Section updated successfully!',
        data: updatedSection,
      })
    } catch (error) {
      const matchedKey = Object.keys(mongoErrorMessages).find((key) =>
        error.message.includes(key)
      )
      const errorMessage = matchedKey
        ? mongoErrorMessages[matchedKey]
        : error.message

      res.status(500).json({
        success: false,
        code: 500,
        message: errorMessage,
        error: errorMessage,
      })
    }
  } else {
    res.status(403).json({
      code: 403,
      success: false,
      message:
        'You do not have the necessary permissions to access this resource. Please contact your administrator',
    })
  }
}

// Delete section
const destroy = async (req, res, next) => {
  const permissionsResult = await getPermissionSet(req)
  if (permissionsResult.classes.split('-').includes('RA')) {
    try {
      const sectionId = req.body.sectionId
      if (!sectionId) {
        return res.status(400).json({
          success: false,
          code: 400,
          message: 'Section ID is required',
        })
      }

      const deletedSection = await sectionModel.findByIdAndDelete(sectionId)

      if (!deletedSection) {
        return res.status(404).json({
          success: false,
          code: 404,
          message: 'Section not found',
        })
      }

      res.status(200).json({
        success: true,
        code: 200,
        message: 'Section deleted successfully',
      })
    } catch (error) {
      const matchedKey = Object.keys(mongoErrorMessages).find((key) =>
        error.message.includes(key)
      )
      const errorMessage = matchedKey
        ? mongoErrorMessages[matchedKey]
        : error.message

      res.status(500).json({
        success: false,
        code: 500,
        message: errorMessage,
        error: errorMessage,
      })
    }
  } else {
    res.status(403).json({
      code: 403,
      success: false,
      message:
        'You do not have the necessary permissions to access this resource. Please contact your administrator',
    })
  }
}

module.exports = {
  index,
  show,
  store,
  update,
  destroy,
}
