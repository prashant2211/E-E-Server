const { createAuditLog } = require('../utils/auditLog')

const auditLogger = (req, res, next) => {
  const method = String(req.method || '').toUpperCase()
  const baseUrl = process.env.BASE_URL || '/api'

  if (method === 'OPTIONS') return next()
  if (!String(req.originalUrl || '').startsWith(baseUrl)) return next()
  if (String(req.originalUrl || '').includes('/audit-logs')) return next()

  res.on('finish', () => {
    if (!req.user) return
    createAuditLog({ req }).catch(() => {})
  })

  next()
}

module.exports = auditLogger

