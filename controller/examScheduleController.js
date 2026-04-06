const examScheduleModel = require('../models/examScheduleModel')
const { getPermissionSet } = require('./permissionAssinment')
const mongoErrorMessages = require('./mongoErrors.json')
const classModel = require('../models/classModel')
const { resolveAcademicYearScope } = require('../utils/academicYearScope')

// Get all exam schedules with filters
const index = async (req, res, next) => {
    try {
        if (!req.user || !req.user.InstutionCode) {
            return res.status(401).json({
                code: 401,
                success: false,
                message: 'User authentication required'
            })
        }

        const permissionsResult = await getPermissionSet(req)
        const schedulePermissions = typeof permissionsResult.scheduleClass === 'string' 
            ? permissionsResult.scheduleClass 
            : (permissionsResult.scheduleClass?.toString() || 'R-W-E-D-RA')

        if (!schedulePermissions.split('-').includes('RA') && !schedulePermissions.split('-').includes('R')) {
            return res.status(403).json({
                code: 403,
                success: false,
                message: 'You do not have the necessary permissions to access this resource. Please contact your administrator'
            })
        }

        const page = parseInt(req.query.PageNumber) || 1
        const limit = parseInt(req.query.PageSize) || 10
        const skip = (page - 1) * limit
        const searchText = req.query.SearchText || ''

        let searchCondition = {
            InstutionCode: req.user.InstutionCode
        }

        // Filter by ClassCode
        if (req.query.ClassCode) {
            searchCondition.ClassCode = req.query.ClassCode
        }

        // Filter by SectionCode
        if (req.query.SectionCode) {
            searchCondition.SectionCode = req.query.SectionCode
        }

        // Filter by ExamType
        if (req.query.ExamType) {
            searchCondition.ExamType = req.query.ExamType
        }

        // Filter by Subject
        if (req.query.Subject) {
            searchCondition.Subject = { $regex: req.query.Subject, $options: 'i' }
        }

        // Filter by Status
        if (req.query.Status) {
            searchCondition.Status = req.query.Status
        }

        // Filter by date range (query override)
        if (req.query.StartDate || req.query.EndDate) {
            searchCondition.ExamDate = {}
            if (req.query.StartDate) {
                searchCondition.ExamDate.$gte = new Date(req.query.StartDate)
            }
            if (req.query.EndDate) {
                searchCondition.ExamDate.$lte = new Date(req.query.EndDate)
            }
        } else {
            // Academic year view filter
            const scope = await resolveAcademicYearScope(req)
            if (scope?.from && scope?.to) {
              searchCondition.ExamDate = { $gte: scope.from, $lte: scope.to }
            }
        }

        // Search text filter
        if (searchText) {
            searchCondition.$or = [
                { ExamName: { $regex: searchText, $options: 'i' } },
                { Subject: { $regex: searchText, $options: 'i' } },
                { ClassName: { $regex: searchText, $options: 'i' } },
                { Venue: { $regex: searchText, $options: 'i' } }
            ]
        }

        const [exams, totalCount] = await Promise.all([
            examScheduleModel.find(searchCondition)
                .sort({ ExamDate: 1, StartTime: 1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            examScheduleModel.countDocuments(searchCondition)
        ])

        res.status(200).json({
            success: true,
            message: 'Exam schedules retrieved successfully',
            code: 200,
            totalRecords: totalCount,
            data: exams
        })
    } catch (error) {
        console.error('Error fetching exam schedules:', error)
        const matchedKey = Object.keys(mongoErrorMessages).find(key => error.message.includes(key))
        const errorMessage = matchedKey ? mongoErrorMessages[matchedKey] : error.message

        res.status(500).json({
            success: false,
            message: errorMessage || 'Failed to fetch exam schedules',
            code: 500,
            error: error.message
        })
    }
}

// Get single exam schedule by ID
const show = async (req, res, next) => {
    try {
        if (!req.user || !req.user.InstutionCode) {
            return res.status(401).json({
                code: 401,
                success: false,
                message: 'User authentication required'
            })
        }

        const permissionsResult = await getPermissionSet(req)
        const schedulePermissions = typeof permissionsResult.scheduleClass === 'string' 
            ? permissionsResult.scheduleClass 
            : (permissionsResult.scheduleClass?.toString() || 'R-W-E-D-RA')

        if (!schedulePermissions.split('-').includes('RA') && !schedulePermissions.split('-').includes('R')) {
            return res.status(403).json({
                code: 403,
                success: false,
                message: 'You do not have the necessary permissions to access this resource. Please contact your administrator'
            })
        }

        const examId = req.query.examId || req.params.id

        if (!examId) {
            return res.status(400).json({
                code: 400,
                success: false,
                message: 'Exam ID is required'
            })
        }

        const exam = await examScheduleModel.findOne({
            _id: examId,
            InstutionCode: req.user.InstutionCode
        }).lean()

        if (!exam) {
            return res.status(404).json({
                code: 404,
                success: false,
                message: 'Exam schedule not found'
            })
        }

        res.status(200).json({
            success: true,
            message: 'Exam schedule retrieved successfully',
            code: 200,
            data: exam
        })
    } catch (error) {
        console.error('Error fetching exam schedule:', error)
        const matchedKey = Object.keys(mongoErrorMessages).find(key => error.message.includes(key))
        const errorMessage = matchedKey ? mongoErrorMessages[matchedKey] : error.message

        res.status(500).json({
            success: false,
            message: errorMessage || 'Failed to fetch exam schedule',
            code: 500,
            error: error.message
        })
    }
}

// Create new exam schedule
const store = async (req, res, next) => {
    try {
        if (!req.user || !req.user.InstutionCode) {
            return res.status(401).json({
                code: 401,
                success: false,
                message: 'User authentication required'
            })
        }

        const permissionsResult = await getPermissionSet(req)
        const schedulePermissions = typeof permissionsResult.scheduleClass === 'string' 
            ? permissionsResult.scheduleClass 
            : (permissionsResult.scheduleClass?.toString() || 'R-W-E-D-RA')

        if (!schedulePermissions.split('-').includes('W')) {
            return res.status(403).json({
                code: 403,
                success: false,
                message: 'You do not have the necessary permissions to create exam schedules. Please contact your administrator'
            })
        }

        // Validate required fields
        const requiredFields = ['ClassCode', 'ClassName', 'ExamName', 'ExamType', 'Subject', 'ExamDate', 'StartTime', 'EndTime', 'MaxMarks', 'Venue']
        const missingFields = requiredFields.filter(field => !req.body[field])

        if (missingFields.length > 0) {
            return res.status(400).json({
                code: 400,
                success: false,
                message: `Missing required fields: ${missingFields.join(', ')}`
            })
        }

        // Verify class exists and belongs to institution
        const classRecord = await classModel.findOne({
            ClassCode: req.body.ClassCode,
            InstutionCode: req.user.InstutionCode
        })

        if (!classRecord) {
            return res.status(404).json({
                code: 404,
                success: false,
                message: 'Class not found or does not belong to your institution'
            })
        }

        // Parse ExamDate
        let examDate
        if (typeof req.body.ExamDate === 'string') {
            examDate = new Date(req.body.ExamDate)
        } else {
            examDate = req.body.ExamDate
        }

        if (isNaN(examDate.getTime())) {
            return res.status(400).json({
                code: 400,
                success: false,
                message: 'Invalid exam date format'
            })
        }

        // Determine status based on date
        const now = new Date()
        let status = 'Upcoming'
        if (examDate < now) {
            status = 'Completed'
        }

        const examSchedule = new examScheduleModel({
            InstutionCode: req.user.InstutionCode,
            ClassCode: req.body.ClassCode,
            ClassName: req.body.ClassName,
            SectionCode: req.body.SectionCode || '',
            SectionName: req.body.SectionName || '',
            ExamName: req.body.ExamName,
            ExamType: req.body.ExamType,
            Subject: req.body.Subject,
            ExamDate: examDate,
            StartTime: req.body.StartTime,
            EndTime: req.body.EndTime,
            Duration: req.body.Duration || '',
            MaxMarks: req.body.MaxMarks,
            Venue: req.body.Venue,
            Status: req.body.Status || status,
            Instructions: req.body.Instructions || '',
            TeacherName: req.body.TeacherName || '',
            TeacherId: req.body.TeacherId || ''
        })

        await examSchedule.save()

        res.status(201).json({
            success: true,
            message: 'Exam schedule created successfully',
            code: 201,
            data: examSchedule
        })
    } catch (error) {
        console.error('Error creating exam schedule:', error)
        const matchedKey = Object.keys(mongoErrorMessages).find(key => error.message.includes(key))
        const errorMessage = matchedKey ? mongoErrorMessages[matchedKey] : error.message

        res.status(500).json({
            success: false,
            message: errorMessage || 'Failed to create exam schedule',
            code: 500,
            error: error.message
        })
    }
}

// Update exam schedule
const update = async (req, res, next) => {
    try {
        if (!req.user || !req.user.InstutionCode) {
            return res.status(401).json({
                code: 401,
                success: false,
                message: 'User authentication required'
            })
        }

        const permissionsResult = await getPermissionSet(req)
        const schedulePermissions = typeof permissionsResult.scheduleClass === 'string' 
            ? permissionsResult.scheduleClass 
            : (permissionsResult.scheduleClass?.toString() || 'R-W-E-D-RA')

        if (!schedulePermissions.split('-').includes('E')) {
            return res.status(403).json({
                code: 403,
                success: false,
                message: 'You do not have the necessary permissions to update exam schedules. Please contact your administrator'
            })
        }

        const examId = req.body.examId || req.params.id

        if (!examId) {
            return res.status(400).json({
                code: 400,
                success: false,
                message: 'Exam ID is required'
            })
        }

        // Verify exam exists and belongs to institution
        const existingExam = await examScheduleModel.findOne({
            _id: examId,
            InstutionCode: req.user.InstutionCode
        })

        if (!existingExam) {
            return res.status(404).json({
                code: 404,
                success: false,
                message: 'Exam schedule not found or does not belong to your institution'
            })
        }

        // Prepare update data
        const updateData = {}

        if (req.body.ClassCode) {
            // Verify new class exists
            const classRecord = await classModel.findOne({
                ClassCode: req.body.ClassCode,
                InstutionCode: req.user.InstutionCode
            })

            if (!classRecord) {
                return res.status(404).json({
                    code: 404,
                    success: false,
                    message: 'Class not found or does not belong to your institution'
                })
            }
            updateData.ClassCode = req.body.ClassCode
        }

        if (req.body.ClassName) updateData.ClassName = req.body.ClassName
        if (req.body.SectionCode !== undefined) updateData.SectionCode = req.body.SectionCode
        if (req.body.SectionName !== undefined) updateData.SectionName = req.body.SectionName
        if (req.body.ExamName) updateData.ExamName = req.body.ExamName
        if (req.body.ExamType) updateData.ExamType = req.body.ExamType
        if (req.body.Subject) updateData.Subject = req.body.Subject
        if (req.body.StartTime) updateData.StartTime = req.body.StartTime
        if (req.body.EndTime) updateData.EndTime = req.body.EndTime
        if (req.body.Duration !== undefined) updateData.Duration = req.body.Duration
        if (req.body.MaxMarks) updateData.MaxMarks = req.body.MaxMarks
        if (req.body.Venue) updateData.Venue = req.body.Venue
        if (req.body.Status) updateData.Status = req.body.Status
        if (req.body.Instructions !== undefined) updateData.Instructions = req.body.Instructions
        if (req.body.TeacherName !== undefined) updateData.TeacherName = req.body.TeacherName
        if (req.body.TeacherId !== undefined) updateData.TeacherId = req.body.TeacherId

        // Handle ExamDate
        if (req.body.ExamDate) {
            let examDate
            if (typeof req.body.ExamDate === 'string') {
                examDate = new Date(req.body.ExamDate)
            } else {
                examDate = req.body.ExamDate
            }

            if (isNaN(examDate.getTime())) {
                return res.status(400).json({
                    code: 400,
                    success: false,
                    message: 'Invalid exam date format'
                })
            }

            updateData.ExamDate = examDate

            // Update status based on new date if not explicitly set
            if (!req.body.Status) {
                const now = new Date()
                if (examDate < now) {
                    updateData.Status = 'Completed'
                } else {
                    updateData.Status = 'Upcoming'
                }
            }
        }

        const updatedExam = await examScheduleModel.findByIdAndUpdate(
            examId,
            { $set: updateData },
            { new: true, runValidators: true }
        )

        res.status(200).json({
            success: true,
            message: 'Exam schedule updated successfully',
            code: 200,
            data: updatedExam
        })
    } catch (error) {
        console.error('Error updating exam schedule:', error)
        const matchedKey = Object.keys(mongoErrorMessages).find(key => error.message.includes(key))
        const errorMessage = matchedKey ? mongoErrorMessages[matchedKey] : error.message

        res.status(500).json({
            success: false,
            message: errorMessage || 'Failed to update exam schedule',
            code: 500,
            error: error.message
        })
    }
}

// Delete exam schedule
const destroy = async (req, res, next) => {
    try {
        if (!req.user || !req.user.InstutionCode) {
            return res.status(401).json({
                code: 401,
                success: false,
                message: 'User authentication required'
            })
        }

        const permissionsResult = await getPermissionSet(req)
        const schedulePermissions = typeof permissionsResult.scheduleClass === 'string' 
            ? permissionsResult.scheduleClass 
            : (permissionsResult.scheduleClass?.toString() || 'R-W-E-D-RA')

        if (!schedulePermissions.split('-').includes('D')) {
            return res.status(403).json({
                code: 403,
                success: false,
                message: 'You do not have the necessary permissions to delete exam schedules. Please contact your administrator'
            })
        }

        const examId = req.body.examId || req.params.id

        if (!examId) {
            return res.status(400).json({
                code: 400,
                success: false,
                message: 'Exam ID is required'
            })
        }

        // Verify exam exists and belongs to institution
        const exam = await examScheduleModel.findOne({
            _id: examId,
            InstutionCode: req.user.InstutionCode
        })

        if (!exam) {
            return res.status(404).json({
                code: 404,
                success: false,
                message: 'Exam schedule not found or does not belong to your institution'
            })
        }

        await examScheduleModel.findByIdAndDelete(examId)

        res.status(200).json({
            success: true,
            message: 'Exam schedule deleted successfully',
            code: 200
        })
    } catch (error) {
        console.error('Error deleting exam schedule:', error)
        const matchedKey = Object.keys(mongoErrorMessages).find(key => error.message.includes(key))
        const errorMessage = matchedKey ? mongoErrorMessages[matchedKey] : error.message

        res.status(500).json({
            success: false,
            message: errorMessage || 'Failed to delete exam schedule',
            code: 500,
            error: error.message
        })
    }
}

module.exports = {
    index,
    show,
    store,
    update,
    destroy
}

