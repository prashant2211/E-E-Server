const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
require('dotenv').config();

/**
 * Ensure SuperAdmin user exists
 * Creates if doesn't exist, updates if exists
 */
const ensureSuperAdmin = async () => {
  try {
    // Connect to MongoDB using the same connection string as server
    const mongoUri = process.env.DBCONNECTIONURL || 'mongodb://localhost:27017/educational-eternity';
    console.log('🔌 Connecting to MongoDB...');
    console.log('   URI:', mongoUri.replace(/\/\/.*@/, '//***@')); // Hide credentials
    
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB\n');

    const email = 'prashsantraj813@gmail.com';
    const firstName = 'Prashant';
    const lastName = 'Raj';
    const phone = '9934001660';
    const password = 'Educ@t!onal$123';
    const userType = 'SuperAdmin';

    // Check if user exists
    let user = await User.findOne({ Email: email });
    
    if (user) {
      console.log('✅ SuperAdmin user already exists!');
      console.log('\n📋 Current Details:');
      console.log('   Email:', user.Email);
      console.log('   UserType:', user.UserType);
      console.log('   Phone:', user.Phone);
      console.log('   Verified:', user.Verified);
      
      // Update password if needed
      const isPasswordMatch = await bcrypt.compare(password, user.Password);
      if (!isPasswordMatch) {
        console.log('\n🔄 Updating password...');
        const hashedPassword = await bcrypt.hash(password, 10);
        user.Password = hashedPassword;
        await user.save();
        console.log('✅ Password updated!');
      }
      
      // Ensure UserType is SuperAdmin
      if (user.UserType !== userType) {
        console.log('\n🔄 Updating UserType to SuperAdmin...');
        user.UserType = userType;
        await user.save();
        console.log('✅ UserType updated!');
      }
      
      // Ensure verified
      if (!user.Verified) {
        console.log('\n🔄 Setting Verified to true...');
        user.Verified = true;
        await user.save();
        console.log('✅ Verified status updated!');
      }
      
    } else {
      console.log('❌ SuperAdmin user not found. Creating new user...\n');
      
      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);
      
      // Create SuperAdmin user
      user = new User({
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
      
      await user.save();
      console.log('✅ SuperAdmin user created successfully!\n');
    }

    // Verify user can be found with the login query
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
      console.log('   Email:', foundUser.Email);
      console.log('   UserType:', foundUser.UserType);
      console.log('   Phone:', foundUser.Phone);
    } else {
      console.log('❌ User NOT found with login query!');
      console.log('   This indicates a database connection issue.');
    }

    console.log('\n📋 Final Credentials:');
    console.log('   Email:', email);
    console.log('   Password:', password);
    console.log('   UserType:', userType);
    console.log('   Phone:', phone);
    console.log('\n✅ SuperAdmin user is ready!');

    await mongoose.connection.close();
    console.log('\n✅ Database connection closed');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
    await mongoose.connection.close();
    process.exit(1);
  }
};

// Run script
if (require.main === module) {
  ensureSuperAdmin();
}

module.exports = ensureSuperAdmin;

