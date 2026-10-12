/**
 * Central JWT secrets — production must set JWT_SECRET (and optionally JWT_REFRESH_SECRET).
 */

const LEGACY_ACCESS_SECRET = 'MNPqrst2211MLrtq';

const isProd = () => process.env.NODE_ENV === 'production';

function getJwtAccessSecret() {
  const secret = process.env.JWT_SECRET;
  if (isProd()) {
    if (!secret || secret.length < 32) {
      throw new Error(
        'JWT_SECRET must be set in production (minimum 32 characters). See BackEnd/.env.example.'
      );
    }
    return secret;
  }
  return secret || LEGACY_ACCESS_SECRET;
}

/** Refresh tokens: use JWT_REFRESH_SECRET if set; else same as access (dev-friendly). */
function getJwtRefreshSecret() {
  const dedicated = process.env.JWT_REFRESH_SECRET;
  if (dedicated) {
    if (isProd() && dedicated.length < 32) {
      throw new Error('JWT_REFRESH_SECRET must be at least 32 characters in production.');
    }
    return dedicated;
  }
  return getJwtAccessSecret();
}

/** Call after dotenv — fails fast in production if secrets missing. */
function assertJwtConfigForEnvironment() {
  getJwtAccessSecret();
  getJwtRefreshSecret();
}

module.exports = {
  getJwtAccessSecret,
  getJwtRefreshSecret,
  assertJwtConfigForEnvironment,
};
