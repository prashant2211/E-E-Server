const { AcademicYear } = require('../models/academicYearModel')

/**
 * Blocks record creation when global default academic year is not configured.
 * "Default academic year" = AcademicYear where Is_Current=true (per institution).
 */
const requireDefaultAcademicYear = async (req, res, next) => {
  try {
    const instutionCode = req.user?.InstutionCode
    if (!instutionCode) {
      return res.status(401).json({
        success: false,
        code: 401,
        message: 'Institution context not found',
      })
    }

    const currentYear = await AcademicYear.findOne({
      InstutionCode: instutionCode,
      Is_Current: true,
      Status: true,
    }).lean()

    if (!currentYear) {
      return res.status(400).json({
        success: false,
        code: 400,
        message:
          'Default academic year (global) is not set. Please set it in System Configuration before creating academic-year related records.',
      })
    }

    // Attach for downstream usage (optional)
    req.currentAcademicYear = currentYear
    return next()
  } catch (err) {
    return res.status(500).json({
      success: false,
      code: 500,
      message: err.message || 'Failed to validate default academic year',
    })
  }
}

module.exports = {
  requireDefaultAcademicYear,
}

