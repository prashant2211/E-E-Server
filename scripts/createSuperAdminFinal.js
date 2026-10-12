const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
require('dotenv').config();

/**
 * Create SuperAdmin user - Final version
 * Deletes existing and creates fresh user
 */
const createSuperAdminFinal = async () => {
  try {
    // Use the EXACT same connection string as server
    const mongoUri = process.env.DBCONNECTIONURL || 'mongodb://localhost:27017/educational-eternity';
    console.log('🔌 Connecting to MongoDB...');
    console.log('   Using connection from .env or default');
    
    await mongoose.connect(mongoUri, {
      maxPoolSize: 10,
      minPoolSize: 5,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    
    const db = mongoose.connection.db;
    const dbName = db.databaseName;
    console.log(`✅ Connected to database: ${dbName}\n`);

    const email = 'prashsantraj813@gmail.com';
    const firstName = 'Prashant';
    const lastName = 'Raj';
    const phone = '9934001660';
    const password = 'Educ@t!onal$123';
    const userType = 'SuperAdmin';

    console.log('🔍 Checking for existing user...');
    
    // Delete any existing user with this email (to avoid conflicts)
    const deleted = await User.deleteMany({ 
      $or: [
        { Email: email },
        { UserName: email },
        { Phone: phone }
      ]
    });
    
    if (deleted.deletedCount > 0) {
      console.log(`✅ Deleted ${deleted.deletedCount} existing user(s)\n`);
    } else {
      console.log('✅ No existing user found to delete\n');
    }

    console.log('🔄 Creating new SuperAdmin user...');
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    console.log('✅ Password hashed');

    // Create SuperAdmin user
    const superAdmin = new User({
      FirstName: firstName,
      LastName: lastName,
      Email: email,
      Phone: phone,
      UserName: email,
      Password: hashedPassword,
      InstutionCode: 'SYSTEM',
      InstutionName: 'Educational Eternity System',
      MemberId: 'SUPERADMIN-001',
      UserType: userType,
      PermissionSet: 'all',
      Verified: true
    });

    await superAdmin.save();
    console.log('✅ SuperAdmin user created!\n');

    // Verify user can be found with login query
    console.log('🔍 Verifying user can be found with login query...');
    const foundUser = await User.findOne({
      $or: [
        { Email: email },
        { Phone: phone },
        { UserName: email }
      ]
    });
    
    if (foundUser) {
      console.log('✅ User found with login query!');
      console.log('\n📋 User Details:');
      console.log('   _id:', foundUser._id);
      console.log('   Email:', foundUser.Email);
      console.log('   UserName:', foundUser.UserName);
      console.log('   Phone:', foundUser.Phone);
      console.log('   UserType:', foundUser.UserType);
      console.log('   InstutionCode:', foundUser.InstutionCode);
      console.log('   Verified:', foundUser.Verified);
      console.log('   Created:', foundUser.createdAt);
      
      // Test password
      const passwordMatch = await bcrypt.compare(password, foundUser.Password);
      console.log('   Password match:', passwordMatch ? '✅ YES' : '❌ NO');
      
      console.log('\n✅ SuperAdmin user is ready for login!');
    } else {
      console.log('❌ ERROR: User NOT found with login query!');
      console.log('   This should not happen. Check database connection.');
    }

    // List all SuperAdmin users
    const allSuperAdmins = await User.find({ UserType: 'SuperAdmin' }).select('Email UserType Phone');
    console.log(`\n📊 Total SuperAdmin users in database: ${allSuperAdmins.length}`);
    allSuperAdmins.forEach((u, i) => {
      console.log(`   ${i + 1}. ${u.Email} (${u.UserType})`);
    });

    await mongoose.connection.close();
    console.log('\n✅ Database connection closed');
    console.log('\n🎉 SuperAdmin user created successfully!');
    console.log('\n📝 Login Credentials:');
    console.log('   Email:', email);
    console.log('   Password:', password);
    console.log('   UserType:', userType);
    console.log('\n✅ Ready to login!');
    
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error('Stack:', error.stack);
    await mongoose.connection.close();
    process.exit(1);
  }
};

// Run script
if (require.main === module) {
  createSuperAdminFinal();
}

module.exports = createSuperAdminFinal;

