/**
 * One-off: check if a user exists (same lookup as login) and whether a test password matches.
 * Usage: TEST_PW='yourPassword' node scripts/diagnoseLoginAdmin.js [email]
 * Do not commit real passwords.
 */
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
require('dotenv').config();

function escapeRegex(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildCredentialMatch(rawUsername) {
  const u = String(rawUsername || '')
    .trim()
    .replace(/\u200B/g, '');
  if (!u) return null;
  const emailOrUserRegex = new RegExp(`^${escapeRegex(u)}$`, 'i');
  return {
    $or: [{ Email: emailOrUserRegex }, { Phone: u }, { UserName: emailOrUserRegex }],
  };
}

async function main() {
  const email = process.argv[2] || 'admin@educationaleternity.com';
  const testPassword = process.env.TEST_PW;

  await mongoose.connect(process.env.DBCONNECTIONURL);
  const q = buildCredentialMatch(email);
  const user = await User.findOne(q);

  if (!user) {
    console.log(
      JSON.stringify(
        {
          step: 'not_found',
          hint: 'No user matches Email/UserName (case-insensitive) or Phone exactly.',
          searched: email,
        },
        null,
        2,
      ),
    );
    await mongoose.connection.close();
    process.exit(0);
  }

  const pwd = user.Password;
  const looksBcrypt =
    typeof pwd === 'string' &&
    (/^\$2[ab]\$\d{2}\$/.test(pwd) || /^\$2y\$\d{2}\$/.test(pwd));

  let passwordMatch = null;
  if (testPassword != null && testPassword !== '') {
    if (looksBcrypt) {
      passwordMatch = await bcrypt.compare(testPassword, pwd);
    } else {
      passwordMatch = String(testPassword) === String(pwd);
    }
  }

  console.log(
    JSON.stringify(
      {
        step: 'found',
        Email: user.Email,
        UserName: user.UserName,
        UserType: user.UserType,
        InstutionCode: user.InstutionCode,
        looksBcrypt,
        passwordMatch,
      },
      null,
      2,
    ),
  );

  await mongoose.connection.close();
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
