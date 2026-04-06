const Instution = require('../models/InstutionModel')

/**
 * Public, unauthenticated check used by each school frontend build.
 * Query: code — must match Instution_Id in the database.
 */
exports.getPublicInstitutionStatus = async (req, res, next) => {
  try {
    const code = String(req.query.code || req.query.Instution_Id || '').trim()
    if (!code) {
      return res.status(400).json({
        success: false,
        message: 'Query parameter "code" is required (institution id).',
        active: false,
        exists: false,
      })
    }

    // Exact match first (indexed), then case-insensitive fallback for legacy / migrated data
    let doc = await Instution.findOne({ Instution_Id: code }).select('Status').lean()
    if (!doc) {
      const escaped = code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      doc = await Instution.findOne({
        Instution_Id: { $regex: new RegExp(`^${escaped}$`, 'i') },
      })
        .select('Status')
        .lean()
    }

    if (!doc) {
      return res.status(200).json({
        success: true,
        active: false,
        exists: false,
      })
    }

    return res.status(200).json({
      success: true,
      active: doc.Status === true,
      exists: true,
    })
  } catch (err) {
    next(err)
  }
}
