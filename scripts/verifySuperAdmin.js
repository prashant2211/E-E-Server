const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config();

const verifySuperAdmin = async () => {
  try {
    const mongoUri = process.env.DBCONNECTIONURL || 'mongodb://localhost:27017/educational-eternity';
    await mongoose.connect(mongoUri);
    
    console.log('✅ Connected to MongoDB\n');

    const superAdmin = await User.findOne({ 
      Email: 'prashsantraj813@gmail.com'
    });

    if (!superAdmin) {
      console.log('❌ SuperAdmin not found!');
      await mongoose.connection.close();
      process.exit(1);
    }

    console.log('✅ SuperAdmin found!\n');
    console.log('📋 User Details:');
    console.log('   ID:', superAdmin._id);
    console.log('   First Name:', superAdmin.FirstName);
    console.log('   Last Name:', superAdmin.LastName);
    console.log('   Email:', superAdmin.Email);
    console.log('   Phone:', superAdmin.Phone);
    console.log('   UserName:', superAdmin.UserName);
    console.log('   UserType:', superAdmin.UserType);
    console.log('   InstutionCode:', superAdmin.InstutionCode);
    console.log('   MemberId:', superAdmin.MemberId);
    console.log('   Verified:', superAdmin.Verified);
    console.log('   Created:', superAdmin.createdAt);
    console.log('\n✅ UserType matches "SuperAdmin":', superAdmin.UserType === 'SuperAdmin');

    await mongoose.connection.close();
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
};

verifySuperAdmin();

