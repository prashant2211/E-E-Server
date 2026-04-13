/**
 * Resolve student registration number for portal APIs.
 * Students may omit the query param and are always scoped to JWT MemberId.
 */
function resolveOwnStudentRegistration(req, requestedRegistration) {
  const userType = String(req.user?.UserType || '').trim();
  const memberId = String(req.user?.MemberId || '').trim();
  const fromQuery =
    requestedRegistration !== undefined && requestedRegistration !== null
      ? String(requestedRegistration).trim()
      : '';

  if (userType === 'Student') {
    if (!memberId) {
      return {
        error: {
          status: 400,
          message: 'Your account is not linked to a student registration number.',
        },
      };
    }
    if (fromQuery && fromQuery.toLowerCase() !== memberId.toLowerCase()) {
      return {
        error: {
          status: 403,
          message: 'You can only access your own student records.',
        },
      };
    }
    return { registrationNumber: memberId };
  }

  return { registrationNumber: fromQuery };
}

module.exports = { resolveOwnStudentRegistration };
