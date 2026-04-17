const teacherAttendanceModel = require('../models/teacherAttendanceModel')
const holidaysModel = require('../models/holidayModel')
const mongoErrorMessages = require('./mongoErrors.json')

const IST_TIMEZONE = 'Asia/Kolkata'

const toDateKey = (date = new Date()) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: IST_TIMEZONE }).format(date)

const isAdminUser = (userType) => {
  const v = String(userType || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
  return v === 'admin' || v === 'superadmin'
}

const isTeacherLikeUser = (userType) => {
  const v = String(userType || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
  return v === 'teacher' || v === 'mentor' || v === 'examinationstaff'
}

const parseDateInput = (value) => {
  if (!value) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

const escapeRegex = (str) => String(str || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const getHolidayDateSet = async (instutionCode, fromDate, toDate) => {
  const out = new Set()
  const docs = await holidaysModel.find({ InstutionId: instutionCode }).lean()
  for (const doc of docs) {
    const list = Array.isArray(doc?.Holidays) ? doc.Holidays : []
    for (const item of list) {
      const candidate =
        typeof item === 'string'
          ? item
          : item?.Date || item?.date || item?.Day || item?.day || item?.holidayDate || null
      const d = parseDateInput(candidate)
      if (!d) continue
      if (fromDate && d < fromDate) continue
      if (toDate && d > toDate) continue
      out.add(toDateKey(d))
    }
  }
  return out
}

const getWorkingDaysCount = async (instutionCode, fromDate, toDate) => {
  const start = parseDateInput(fromDate) || new Date(new Date().getFullYear(), 0, 1)
  const end = parseDateInput(toDate) || new Date()
  if (start > end) return 0

  const holidaySet = await getHolidayDateSet(instutionCode, start, end)
  let count = 0
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const day = d.getDay()
    // Sunday excluded
    if (day === 0) continue
    if (holidaySet.has(toDateKey(d))) continue
    count++
  }
  return count
}

const safeServerError = (error) => {
  const matchedKey = Object.keys(mongoErrorMessages).find((key) => error?.message?.includes(key))
  return matchedKey ? mongoErrorMessages[matchedKey] : error?.message || 'Unexpected server error'
}

const markTeacherAttendance = async (req, res) => {
  try {
    const user = req.user || {}
    if (!isTeacherLikeUser(user.UserType)) {
      return res.status(403).json({
        success: false,
        code: 403,
        message: 'Only teacher users can mark teacher attendance.',
      })
    }

    const requestedDayType =
      req.body?.RequestedDayType === 'Half Day' ? 'Half Day' : 'Full Day'
    const requestedHalf =
      requestedDayType === 'Half Day' &&
      (req.body?.RequestedHalf === '1st Half' || req.body?.RequestedHalf === '2nd Half')
        ? req.body.RequestedHalf
        : ''
    const teacherRemark = String(req.body?.TeacherRemark || '').trim()

    const instutionCode = String(user.InstutionCode || '').trim()
    const teacherMemberId = String(user.MemberId || '').trim()
    if (!instutionCode || !teacherMemberId) {
      return res.status(400).json({
        success: false,
        code: 400,
        message: 'Teacher identity/institution context missing.',
      })
    }

    const now = new Date()
    const attendanceDate = toDateKey(now)
    const teacherName =
      `${user.FirstName || ''} ${user.LastName || ''}`.trim() ||
      String(user.Name || user.UserName || teacherMemberId)

    const existing = await teacherAttendanceModel.findOne({
      InstutionCode: instutionCode,
      TeacherMemberId: teacherMemberId,
      AttendanceDate: attendanceDate,
    })

    if (existing && existing.RequestStatus === 'Approved') {
      return res.status(200).json({
        success: true,
        code: 200,
        message: 'Attendance already approved for today.',
        data: existing,
      })
    }

    const payload = {
      InstutionCode: instutionCode,
      TeacherMemberId: teacherMemberId,
      TeacherUserId: String(user.userId || user._id || ''),
      TeacherName: teacherName,
      TeacherUserType: String(user.UserType || 'Teacher'),
      AttendanceDate: attendanceDate,
      PunchInAt: now,
      RequestedDayType: requestedDayType,
      RequestedHalf: requestedHalf,
      RequestStatus: 'Pending',
      FinalAttendanceStatus: 'Pending',
      TeacherRemark: teacherRemark,
      AdminRemark: '',
      ApprovedByMemberId: '',
      ApprovedByName: '',
      ApprovedAt: null,
      ApprovedDayType: '',
      ApprovedHalf: '',
    }

    const saved = await teacherAttendanceModel.findOneAndUpdate(
      {
        InstutionCode: instutionCode,
        TeacherMemberId: teacherMemberId,
        AttendanceDate: attendanceDate,
      },
      { $set: payload },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    )

    return res.status(201).json({
      success: true,
      code: 201,
      message: 'Attendance request submitted for admin approval.',
      data: saved,
    })
  } catch (error) {
    return res.status(500).json({
      success: false,
      code: 500,
      message: safeServerError(error),
    })
  }
}

const getMyTeacherAttendanceHistory = async (req, res) => {
  try {
    const user = req.user || {}
    const instutionCode = String(user.InstutionCode || '').trim()
    const teacherMemberId = String(user.MemberId || '').trim()
    if (!instutionCode || !teacherMemberId) {
      return res.status(400).json({
        success: false,
        code: 400,
        message: 'Teacher identity/institution context missing.',
      })
    }

    const page = parseInt(req.query.PageNumber, 10) || 1
    const pageSize = parseInt(req.query.PageSize, 10) || 50
    const skip = (page - 1) * pageSize
    const fromDate = String(req.query.FromDate || '').trim()
    const toDate = String(req.query.ToDate || '').trim()
    const status = String(req.query.Status || '').trim()

    const cond = {
      InstutionCode: instutionCode,
      TeacherMemberId: teacherMemberId,
    }
    if (fromDate || toDate) {
      cond.AttendanceDate = {}
      if (fromDate) cond.AttendanceDate.$gte = fromDate
      if (toDate) cond.AttendanceDate.$lte = toDate
    }
    if (status) {
      cond.RequestStatus = status
    }

    const [records, totalRecords] = await Promise.all([
      teacherAttendanceModel.find(cond).sort({ AttendanceDate: -1, createdAt: -1 }).skip(skip).limit(pageSize).lean(),
      teacherAttendanceModel.countDocuments(cond),
    ])

    return res.status(200).json({
      success: true,
      code: 200,
      message: 'Teacher attendance history fetched successfully.',
      totalRecords,
      data: records,
    })
  } catch (error) {
    return res.status(500).json({
      success: false,
      code: 500,
      message: safeServerError(error),
    })
  }
}

const getMyTeacherAttendanceSummary = async (req, res) => {
  try {
    const user = req.user || {}
    const instutionCode = String(user.InstutionCode || '').trim()
    const teacherMemberId = String(user.MemberId || '').trim()
    if (!instutionCode || !teacherMemberId) {
      return res.status(400).json({
        success: false,
        code: 400,
        message: 'Teacher identity/institution context missing.',
      })
    }

    const fromDate = String(req.query.FromDate || '').trim() || undefined
    const toDate = String(req.query.ToDate || '').trim() || undefined

    const cond = {
      InstutionCode: instutionCode,
      TeacherMemberId: teacherMemberId,
      RequestStatus: 'Approved',
    }
    if (fromDate || toDate) {
      cond.AttendanceDate = {}
      if (fromDate) cond.AttendanceDate.$gte = fromDate
      if (toDate) cond.AttendanceDate.$lte = toDate
    }

    const approvedRecords = await teacherAttendanceModel.find(cond).lean()
    const presentCount = approvedRecords.filter((r) => r.FinalAttendanceStatus === 'Present').length
    const absentCount = approvedRecords.filter((r) => r.FinalAttendanceStatus === 'Absent').length
    const workingDays = await getWorkingDaysCount(instutionCode, fromDate, toDate)

    return res.status(200).json({
      success: true,
      code: 200,
      message: 'Teacher attendance summary fetched successfully.',
      data: {
        presentCount,
        absentCount,
        workingDays,
        approvedCount: approvedRecords.length,
      },
    })
  } catch (error) {
    return res.status(500).json({
      success: false,
      code: 500,
      message: safeServerError(error),
    })
  }
}

const listTeacherAttendanceRequests = async (req, res) => {
  try {
    if (!isAdminUser(req.user?.UserType)) {
      return res.status(403).json({
        success: false,
        code: 403,
        message: 'Only admin can access teacher attendance approvals.',
      })
    }

    const page = parseInt(req.query.PageNumber, 10) || 1
    const pageSize = parseInt(req.query.PageSize, 10) || 50
    const skip = (page - 1) * pageSize
    const teacherName = String(req.query.TeacherName || '').trim()
    const teacherMemberId = String(req.query.TeacherMemberId || '').trim()
    const requestStatus = String(req.query.RequestStatus || '').trim()
    const finalStatus = String(req.query.FinalAttendanceStatus || '').trim()
    const fromDate = String(req.query.FromDate || '').trim()
    const toDate = String(req.query.ToDate || '').trim()

    const cond = { InstutionCode: req.user.InstutionCode }
    if (teacherName) cond.TeacherName = { $regex: escapeRegex(teacherName), $options: 'i' }
    if (teacherMemberId) cond.TeacherMemberId = teacherMemberId
    if (requestStatus) cond.RequestStatus = requestStatus
    if (finalStatus) cond.FinalAttendanceStatus = finalStatus
    if (fromDate || toDate) {
      cond.AttendanceDate = {}
      if (fromDate) cond.AttendanceDate.$gte = fromDate
      if (toDate) cond.AttendanceDate.$lte = toDate
    }

    const [records, totalRecords] = await Promise.all([
      teacherAttendanceModel.find(cond).sort({ AttendanceDate: -1, createdAt: -1 }).skip(skip).limit(pageSize).lean(),
      teacherAttendanceModel.countDocuments(cond),
    ])

    const approved = records.filter((r) => r.RequestStatus === 'Approved')
    const present = approved.filter((r) => r.FinalAttendanceStatus === 'Present').length
    const absent = approved.filter((r) => r.FinalAttendanceStatus === 'Absent').length
    const pending = records.filter((r) => r.RequestStatus === 'Pending').length

    return res.status(200).json({
      success: true,
      code: 200,
      message: 'Teacher attendance requests fetched successfully.',
      totalRecords,
      summary: { present, absent, pending },
      data: records,
    })
  } catch (error) {
    return res.status(500).json({
      success: false,
      code: 500,
      message: safeServerError(error),
    })
  }
}

const decideTeacherAttendanceRequest = async (req, res) => {
  try {
    if (!isAdminUser(req.user?.UserType)) {
      return res.status(403).json({
        success: false,
        code: 403,
        message: 'Only admin can approve/reject teacher attendance.',
      })
    }

    const id = String(req.params.id || '').trim()
    const decision = String(req.body?.Decision || '').trim()
    const adminRemark = String(req.body?.AdminRemark || '').trim()
    const approvedStatus = String(req.body?.FinalAttendanceStatus || '').trim()
    const approvedDayType =
      req.body?.ApprovedDayType === 'Half Day' ? 'Half Day' : 'Full Day'
    const approvedHalf =
      approvedDayType === 'Half Day' &&
      (req.body?.ApprovedHalf === '1st Half' || req.body?.ApprovedHalf === '2nd Half')
        ? req.body.ApprovedHalf
        : ''

    if (!id || !['Approve', 'Reject'].includes(decision)) {
      return res.status(400).json({
        success: false,
        code: 400,
        message: 'Valid id and Decision (Approve/Reject) are required.',
      })
    }

    const existing = await teacherAttendanceModel.findOne({
      _id: id,
      InstutionCode: req.user.InstutionCode,
    })
    if (!existing) {
      return res.status(404).json({
        success: false,
        code: 404,
        message: 'Attendance request not found.',
      })
    }

    let finalStatus = 'Absent'
    if (decision === 'Approve') {
      finalStatus = approvedStatus === 'Absent' ? 'Absent' : 'Present'
    }

    const updated = await teacherAttendanceModel.findByIdAndUpdate(
      id,
      {
        $set: {
          RequestStatus: decision === 'Approve' ? 'Approved' : 'Rejected',
          FinalAttendanceStatus: decision === 'Approve' ? finalStatus : 'Absent',
          AdminRemark: adminRemark,
          ApprovedByMemberId: String(req.user?.MemberId || ''),
          ApprovedByName:
            `${req.user?.FirstName || ''} ${req.user?.LastName || ''}`.trim() ||
            String(req.user?.UserName || req.user?.MemberId || ''),
          ApprovedAt: new Date(),
          ApprovedDayType: decision === 'Approve' ? approvedDayType : '',
          ApprovedHalf: decision === 'Approve' && approvedDayType === 'Half Day' ? approvedHalf : '',
        },
      },
      { new: true }
    )

    return res.status(200).json({
      success: true,
      code: 200,
      message: `Attendance request ${decision === 'Approve' ? 'approved' : 'rejected'} successfully.`,
      data: updated,
    })
  } catch (error) {
    return res.status(500).json({
      success: false,
      code: 500,
      message: safeServerError(error),
    })
  }
}

const getTeacherAttendanceHistoryForAdmin = async (req, res) => {
  try {
    if (!isAdminUser(req.user?.UserType)) {
      return res.status(403).json({
        success: false,
        code: 403,
        message: 'Only admin can view teacher attendance history.',
      })
    }

    const memberId = String(req.query.TeacherMemberId || '').trim()
    if (!memberId) {
      return res.status(400).json({
        success: false,
        code: 400,
        message: 'TeacherMemberId is required.',
      })
    }
    const fromDate = String(req.query.FromDate || '').trim()
    const toDate = String(req.query.ToDate || '').trim()
    const cond = {
      InstutionCode: req.user.InstutionCode,
      TeacherMemberId: memberId,
    }
    if (fromDate || toDate) {
      cond.AttendanceDate = {}
      if (fromDate) cond.AttendanceDate.$gte = fromDate
      if (toDate) cond.AttendanceDate.$lte = toDate
    }

    const records = await teacherAttendanceModel
      .find(cond)
      .sort({ AttendanceDate: -1, createdAt: -1 })
      .limit(500)
      .lean()

    const approved = records.filter((r) => r.RequestStatus === 'Approved')
    const presentCount = approved.filter((r) => r.FinalAttendanceStatus === 'Present').length
    const absentCount = approved.filter((r) => r.FinalAttendanceStatus === 'Absent').length

    return res.status(200).json({
      success: true,
      code: 200,
      message: 'Teacher history fetched successfully.',
      summary: {
        presentCount,
        absentCount,
        approvedCount: approved.length,
        pendingCount: records.filter((r) => r.RequestStatus === 'Pending').length,
      },
      data: records,
    })
  } catch (error) {
    return res.status(500).json({
      success: false,
      code: 500,
      message: safeServerError(error),
    })
  }
}

module.exports = {
  markTeacherAttendance,
  getMyTeacherAttendanceHistory,
  getMyTeacherAttendanceSummary,
  listTeacherAttendanceRequests,
  decideTeacherAttendanceRequest,
  getTeacherAttendanceHistoryForAdmin,
}
