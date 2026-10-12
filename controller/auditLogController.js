const AuditLog = require('../models/auditLogModel')

const listAuditLogs = async (req, res) => {
  try {
    const instutionCode = req.user?.InstutionCode
    if (!instutionCode) {
      return res.status(401).json({
        success: false,
        code: 401,
        message: 'Institution context not found',
      })
    }

    const page = Math.max(parseInt(req.query.PageNumber || req.query.page || 1, 10), 1)
    const pageSize = Math.min(
      Math.max(parseInt(req.query.PageSize || req.query.pageSize || 20, 10), 1),
      200
    )
    const skip = (page - 1) * pageSize

    const filter = { InstutionCode: instutionCode }
    const day = req.query.day // YYYY-MM-DD
    const timeSearch = String(req.query.time || '').trim() // HH:mm (or partial)
    const q = String(req.query.q || '').trim()

    if (day) {
      const from = new Date(`${day}T00:00:00.000Z`)
      const to = new Date(`${day}T23:59:59.999Z`)
      if (!isNaN(from.getTime()) && !isNaN(to.getTime())) {
        filter.ActionAt = { $gte: from, $lte: to }
      }
    }

    if (q) {
      filter.$or = [
        { UserEmail: { $regex: q, $options: 'i' } },
        { Feature: { $regex: q, $options: 'i' } },
        { Operation: { $regex: q, $options: 'i' } },
        { Path: { $regex: q, $options: 'i' } },
      ]
    }

    let logs = await AuditLog.find(filter).sort({ ActionAt: -1 }).skip(skip).limit(pageSize).lean()

    if (timeSearch) {
      logs = logs.filter((log) => {
        const d = new Date(log.ActionAt)
        const hh = String(d.getHours()).padStart(2, '0')
        const mm = String(d.getMinutes()).padStart(2, '0')
        const timeText = `${hh}:${mm}`
        return timeText.includes(timeSearch)
      })
    }

    const total = await AuditLog.countDocuments(filter)

    return res.status(200).json({
      success: true,
      code: 200,
      message: 'Audit logs fetched successfully',
      data: logs,
      totalRecords: total,
    })
  } catch (error) {
    return res.status(500).json({
      success: false,
      code: 500,
      message: error.message || 'Failed to fetch audit logs',
    })
  }
}

module.exports = {
  listAuditLogs,
}

