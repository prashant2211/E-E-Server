const { AcademicYear } = require('../models/academicYearModel')

/**
 * Resolves the academic year selected by UI (header) or falls back to Is_Current.
 * Returns { yearDoc, from, to } where from/to are Date objects.
 */
const resolveAcademicYearScope = async (req) => {
  const instutionCode = req.user?.InstutionCode
  if (!instutionCode) return null

  const selectedAcademicYearId = req.headers?.['x-academic-year-id']

  let yearDoc = null
  if (selectedAcademicYearId) {
    yearDoc = await AcademicYear.findOne({
      InstutionCode: instutionCode,
      _id: selectedAcademicYearId,
      Status: true,
    }).lean()
  }

  if (!yearDoc) {
    yearDoc = await AcademicYear.findOne({
      InstutionCode: instutionCode,
      Is_Current: true,
      Status: true,
    }).lean()
  }

  if (!yearDoc) return null

  const from = yearDoc.Start_Date ? new Date(yearDoc.Start_Date) : null
  const to = yearDoc.End_Date ? new Date(yearDoc.End_Date) : null

  if (!from || !to) return null
  return { yearDoc, from, to }
}

module.exports = {
  resolveAcademicYearScope,
}

