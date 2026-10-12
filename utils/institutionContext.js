const NON_TENANT_CODES = new Set(['', 'system', 'all', '*'])

const isTenantInstitutionCode = (code) => {
  const value = String(code || '').trim()
  if (!value) return false
  return !NON_TENANT_CODES.has(value.toLowerCase())
}

const tenantInstitutionCode = (req) => {
  const code = String(req?.user?.InstutionCode || '').trim()
  return isTenantInstitutionCode(code) ? code : ''
}

const requireTenantInstitution = (req, res) => {
  const code = tenantInstitutionCode(req)
  if (code) return code
  if (res) {
    res.status(401).json({
      success: false,
      code: 401,
      message: 'Institution context not found. Login to a school, or select an institution.',
    })
  }
  return ''
}

module.exports = {
  isTenantInstitutionCode,
  tenantInstitutionCode,
  requireTenantInstitution,
}
