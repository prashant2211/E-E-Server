const ClassSchedule = require('../models/classScheduleNewModel')
const { getPermissionSet } = require('./permissionAssinment')
const { logger } = require('../utils/logger')

// Helper to normalize schedule type
const normalizeType = (type) => {
  if (!type) return null
  const upper = String(type).toUpperCase()
  if (upper === 'PERMANENT') return 'PERMANENT'
  if (upper === 'TEMPORARY') return 'TEMPORARY'
  return null
}

// Create a new schedule (permanent or temporary)
const store = async (req, res) => {
  try {
    if (!req.user || !req.user.InstutionCode) {
      return res.status(401).json({
        code: 401,
        success: false,
        message: 'User authentication required',
      })
    }

    let permissionsResult
    try {
      permissionsResult = await getPermissionSet(req)
    } catch (err) {
      logger.error('Error getting permissions for class schedule:', err)
      permissionsResult = { timetable: 'R-W-E-D-RA' }
    }

    const timetablePerm = String(permissionsResult.timetable || 'R-W-E-D-RA')
    if (!timetablePerm.split('-').includes('W')) {
      return res.status(403).json({
        code: 403,
        success: false,
        message: 'You do not have permission to schedule classes',
      })
    }

    const {
      ClassCode,
      ClassName,
      SectionCode = '',
      SectionName = '',
      ScheduleType,
      Day,
      ScheduleDate,
      Period,
      StartTime,
      EndTime,
      Subject,
      Teacher_Code = '',
      Teacher_Name = '',
      Teacher_Id = null,
      Room = '',
      Session,
    } = req.body

    const normalizedType = normalizeType(ScheduleType)

    if (!normalizedType) {
      return res.status(400).json({
        code: 400,
        success: false,
        message: 'ScheduleType must be PERMANENT or TEMPORARY',
      })
    }

    if (
      !ClassCode ||
      !ClassName ||
      !Period ||
      !StartTime ||
      !EndTime ||
      !Subject ||
      !Session
    ) {
      return res.status(400).json({
        code: 400,
        success: false,
        message:
          'Missing required fields: ClassCode, ClassName, Period, StartTime, EndTime, Subject, Session',
      })
    }

    if (normalizedType === 'PERMANENT' && !Day) {
      return res.status(400).json({
        code: 400,
        success: false,
        message: 'Day is required for PERMANENT schedules',
      })
    }

    if (normalizedType === 'TEMPORARY' && !ScheduleDate) {
      return res.status(400).json({
        code: 400,
        success: false,
        message: 'ScheduleDate is required for TEMPORARY schedules',
      })
    }

    const doc = new ClassSchedule({
      InstutionCode: req.user.InstutionCode,
      ClassCode,
      ClassName,
      SectionCode,
      SectionName,
      ScheduleType: normalizedType,
      Day: normalizedType === 'PERMANENT' ? Day : undefined,
      ScheduleDate:
        normalizedType === 'TEMPORARY' ? new Date(ScheduleDate) : undefined,
      Period,
      StartTime,
      EndTime,
      Subject,
      Teacher_Code,
      Teacher_Name,
      Teacher_Id,
      Room,
      Session,
      Status: true,
    })

    const saved = await doc.save()

    return res.status(201).json({
      code: 201,
      success: true,
      message: 'Class scheduled successfully',
      data: saved,
    })
  } catch (error) {
    logger.error('Error creating class schedule:', error)
    let message = 'Failed to create class schedule'
    if (error.code === 11000) {
      message =
        'Schedule already exists for this period (duplicate entry). Please adjust period/day/date.'
    }
    return res.status(500).json({
      code: 500,
      success: false,
      message,
      error: error.message,
    })
  }
}

// Get schedules with filters
const index = async (req, res) => {
  try {
    if (!req.user || !req.user.InstutionCode) {
      return res.status(401).json({
        code: 401,
        success: false,
        message: 'User authentication required',
      })
    }

    let permissionsResult
    try {
      permissionsResult = await getPermissionSet(req)
    } catch (err) {
      logger.error('Error getting permissions for class schedule:', err)
      permissionsResult = { timetable: 'R-W-E-D-RA' }
    }

    const timetablePerm = String(permissionsResult.timetable || 'R-W-E-D-RA')
    if (
      !timetablePerm.split('-').includes('RA') &&
      !timetablePerm.split('-').includes('R')
    ) {
      return res.status(403).json({
        code: 403,
        success: false,
        message: 'You do not have permission to view schedules',
      })
    }

    const {
      ClassCode,
      SectionCode,
      ScheduleType,
      Day,
      ScheduleDate,
      Session,
    } = req.query

    const query = {
      InstutionCode: req.user.InstutionCode,
    }

    if (ClassCode) query.ClassCode = ClassCode
    if (SectionCode) query.SectionCode = SectionCode
    if (ScheduleType) query.ScheduleType = normalizeType(ScheduleType)
    if (Session) query.Session = Session

    if (ScheduleDate) {
      const d = new Date(ScheduleDate)
      const start = new Date(d)
      start.setHours(0, 0, 0, 0)
      const end = new Date(d)
      end.setHours(23, 59, 59, 999)
      query.ScheduleDate = { $gte: start, $lte: end }
    }

    if (Day) query.Day = Day

    const data = await ClassSchedule.find(query)
      .sort({ ScheduleType: 1, Day: 1, ScheduleDate: 1, Period: 1 })
      .lean()

    return res.status(200).json({
      code: 200,
      success: true,
      data,
      message: 'Class schedules fetched successfully',
    })
  } catch (error) {
    logger.error('Error fetching class schedules:', error)
    return res.status(500).json({
      code: 500,
      success: false,
      message: 'Failed to fetch class schedules',
      error: error.message,
    })
  }
}

// Get combined schedule (permanent + temporary) for a given class/date
const getByClassAndDate = async (req, res) => {
  try {
    if (!req.user || !req.user.InstutionCode) {
      return res.status(401).json({
        code: 401,
        success: false,
        message: 'User authentication required',
      })
    }

    const { ClassCode, SectionCode = '', Date: dateStr, Session } = req.query

    if (!ClassCode || !dateStr) {
      return res.status(400).json({
        code: 400,
        success: false,
        message: 'ClassCode and Date are required',
      })
    }

    const d = new Date(dateStr)
    if (isNaN(d.getTime())) {
      return res.status(400).json({
        code: 400,
        success: false,
        message: 'Invalid Date format',
      })
    }

    const dayNames = [
      'Sunday',
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
    ]
    const dayName = dayNames[d.getDay()]

    const baseQuery = {
      InstutionCode: req.user.InstutionCode,
      ClassCode,
      Status: true,
    }
    if (SectionCode) baseQuery.SectionCode = SectionCode
    if (Session) baseQuery.Session = Session

    const start = new Date(d)
    start.setHours(0, 0, 0, 0)
    const end = new Date(d)
    end.setHours(23, 59, 59, 999)

    const [permanent, temporary] = await Promise.all([
      ClassSchedule.find({
        ...baseQuery,
        ScheduleType: 'PERMANENT',
        Day: dayName,
      }).lean(),
      ClassSchedule.find({
        ...baseQuery,
        ScheduleType: 'TEMPORARY',
        ScheduleDate: { $gte: start, $lte: end },
      }).lean(),
    ])

    // Merge with temporary overriding permanent for same period
    const byPeriod = new Map()
    permanent.forEach((p) => {
      byPeriod.set(p.Period, p)
    })
    temporary.forEach((t) => {
      byPeriod.set(t.Period, t)
    })

    const merged = Array.from(byPeriod.values()).sort(
      (a, b) => a.Period - b.Period
    )

    return res.status(200).json({
      code: 200,
      success: true,
      data: {
        permanent,
        temporary,
        merged,
        dayName,
        date: d,
      },
      message: 'Class schedule for date fetched successfully',
    })
  } catch (error) {
    logger.error('Error fetching class schedule by date:', error)
    return res.status(500).json({
      code: 500,
      success: false,
      message: 'Failed to fetch class schedule',
      error: error.message,
    })
  }
}

module.exports = {
  store,
  index,
  getByClassAndDate,
}


