const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config();

const testLogin = async () => {
  try {
    const mongoUri = process.env.DBCONNECTIONURL || 'mongodb://localhost:27017/educational-eternity';
    await mongoose.connect(mongoUri);
    
    console.log('✅ Connected to MongoDB\n');

    const email = 'prashsantraj813@gmail.com';
    const phone = '9934001660';
    const username = 'prashsantraj813@gmail.com';

    console.log('🔍 Testing user lookup...\n');

    // Test by Email
    const userByEmail = await User.findOne({ Email: email });
    console.log('By Email:', userByEmail ? '✅ Found' : '❌ Not found');
    if (userByEmail) console.log('   User:', userByEmail.Email, userByEmail.UserType);

    // Test by Phone
    const userByPhone = await User.findOne({ Phone: phone });
    console.log('By Phone:', userByPhone ? '✅ Found' : '❌ Not found');
    if (userByPhone) console.log('   User:', userByPhone.Email, userByPhone.UserType);

    // Test by UserName
    const userByUsername = await User.findOne({ UserName: username });
    console.log('By UserName:', userByUsername ? '✅ Found' : '❌ Not found');
    if (userByUsername) console.log('   User:', userByUsername.Email, userByUsername.UserType);

    // Test with $or query (like login does)
    const userByOr = await User.findOne({
      $or: [{ Email: email }, { Phone: phone }, { UserName: username }],
    });
    console.log('\nBy $or query:', userByOr ? '✅ Found' : '❌ Not found');
    if (userByOr) {
      console.log('   Email:', userByOr.Email);
      console.log('   Phone:', userByOr.Phone);
      console.log('   UserName:', userByOr.UserName);
      console.log('   UserType:', userByOr.UserType);
    }

    await mongoose.connection.close();
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
};

testLogin();

