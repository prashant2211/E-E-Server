const AuditLog = require('../models/auditLogModel')

const detectBrowser = (userAgent) => {
  const ua = String(userAgent || '')
  if (/edg/i.test(ua)) return 'Edge'
  if (/opr|opera/i.test(ua)) return 'Opera'
  if (/chrome/i.test(ua) && !/edg/i.test(ua)) return 'Chrome'
  if (/safari/i.test(ua) && !/chrome/i.test(ua)) return 'Safari'
  if (/firefox/i.test(ua)) return 'Firefox'
  return 'Unknown'
}

const sanitizeBody = (body) => {
  if (!body || typeof body !== 'object') return {}
  const redactedKeys = ['password', 'Password', 'token', 'Authorization', 'refreshtoken']
  const result = {}
  Object.keys(body).forEach((key) => {
    if (redactedKeys.includes(key)) {
      result[key] = '[REDACTED]'
      return
    }
    const value = body[key]
    if (typeof value === 'string' && value.length > 300) {
      result[key] = `${value.slice(0, 300)}...`
    } else {
      result[key] = value
    }
  })
  return result
}

const inferFeature = (path, fallbackFeature) => {
  if (fallbackFeature) return fallbackFeature
  const cleanPath = String(path || '').toLowerCase()
  if (cleanPath.includes('/student')) return 'Student Details'
  if (cleanPath.includes('/class')) return 'Class Details'
  if (cleanPath.includes('/section')) return 'Section Details'
  if (cleanPath.includes('/teacher')) return 'Teacher Details'
  if (cleanPath.includes('/homework') || cleanPath.includes('/assignment')) return 'Assignment Details'
  if (cleanPath.includes('/attend')) return 'Attendance Details'
  if (cleanPath.includes('/feepayment') || cleanPath.includes('/feestructure')) return 'Fee Details'
  if (cleanPath.includes('/marksheet')) return 'Marksheet Details'
  if (cleanPath.includes('/exammarks')) return 'Marks Details'
  if (cleanPath.includes('/admission')) return 'Admission Details'
  if (cleanPath.includes('/announcement') || cleanPath.includes('/notification')) return 'Notification Details'
  if (cleanPath.includes('/academic') || cleanPath.includes('/system-config')) return 'Session / System Settings'
  if (cleanPath.includes('/login')) return 'Authentication'
  return 'General'
}

const inferOperation = (method, statusCode) => {
  const verb = String(method || '').toUpperCase()
  if (verb === 'GET') return 'READ'
  if (verb === 'POST') return statusCode >= 400 ? 'CREATE_ATTEMPT' : 'CREATE'
  if (verb === 'PUT' || verb === 'PATCH') return statusCode >= 400 ? 'UPDATE_ATTEMPT' : 'UPDATE'
  if (verb === 'DELETE') return statusCode >= 400 ? 'DELETE_ATTEMPT' : 'DELETE'
  return verb || 'UNKNOWN'
}

const createAuditLog = async ({ req, eventType = 'ACTION', feature, meta = {} }) => {
  try {
    const user = req.user || {}
    const userAgent = req.headers['user-agent'] || ''
    const latitude = req.headers['x-latitude'] ? Number(req.headers['x-latitude']) : undefined
    const longitude = req.headers['x-longitude'] ? Number(req.headers['x-longitude']) : undefined
    const statusCode = Number(resStatusCode(req))

    const payload = {
      InstutionCode: user.InstutionCode || null,
      UserId: user.userId || user._id || null,
      UserEmail: user.Email || user.email || null,
      UserType: user.UserType || null,
      EventType: eventType,
      Feature: inferFeature(req.originalUrl || req.url, feature || req.headers['x-feature-name']),
      Operation: inferOperation(req.method, statusCode),
      Method: req.method,
      Path: req.originalUrl || req.url || '',
      Query: req.query || {},
      Body: ['POST', 'PUT', 'PATCH', 'DELETE'].includes(String(req.method).toUpperCase())
        ? sanitizeBody(req.body)
        : {},
      StatusCode: statusCode,
      Success: statusCode < 400,
      Browser: detectBrowser(userAgent),
      UserAgent: userAgent,
      IpAddress: req.ip,
      Latitude: Number.isFinite(latitude) ? latitude : undefined,
      Longitude: Number.isFinite(longitude) ? longitude : undefined,
      ActionAt: new Date(),
      Meta: meta || {},
    }

    await AuditLog.create(payload)
  } catch (error) {
    // keep audit non-blocking
    // eslint-disable-next-line no-console
    console.error('Audit log create failed:', error.message)
  }
}

const resStatusCode = (req) => {
  if (req.res && typeof req.res.statusCode === 'number') return req.res.statusCode
  return 200
}

module.exports = {
  createAuditLog,
}

