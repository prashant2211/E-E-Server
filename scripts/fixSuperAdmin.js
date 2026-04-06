const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
require('dotenv').config();

/**
 * Fix SuperAdmin user - update email and userType
 */
const fixSuperAdmin = async () => {
  try {
    const mongoUri = process.env.DBCONNECTIONURL || 'mongodb://localhost:27017/educational-eternity';
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB\n');

    // Find user with either email
    const oldEmail = 'prashantraj813@gmail.com'; // Without 's'
    const newEmail = 'prashsantraj813@gmail.com'; // With 's'
    const password = 'Educ@t!onal$123';

    console.log('🔍 Searching for user...');
    
    // Try to find by old email
    let user = await User.findOne({ Email: oldEmail });
    
    if (user) {
      console.log(`✅ Found user with email: ${oldEmail}`);
      console.log('   Current UserType:', user.UserType);
      
      // Update email to the one being used for login
      console.log(`\n🔄 Updating email to: ${newEmail}`);
      user.Email = newEmail;
      user.UserName = newEmail; // Also update username
      
      // Update UserType to SuperAdmin
      if (user.UserType !== 'SuperAdmin') {
        console.log('🔄 Updating UserType to SuperAdmin');
        user.UserType = 'SuperAdmin';
      }
      
      // Update password
      console.log('🔄 Updating password...');
      const hashedPassword = await bcrypt.hash(password, 10);
      user.Password = hashedPassword;
      
      // Ensure verified
      user.Verified = true;
      
      // Ensure correct institution code
      if (user.InstutionCode !== 'SYSTEM') {
        user.InstutionCode = 'SYSTEM';
        user.InstutionName = 'Educational Eternity System';
      }
      
      await user.save();
      console.log('✅ User updated successfully!\n');
      
    } else {
      // Try to find by new email
      user = await User.findOne({ Email: newEmail });
      
      if (user) {
        console.log(`✅ Found user with email: ${newEmail}`);
        console.log('   Current UserType:', user.UserType);
        
        // Update UserType to SuperAdmin
        if (user.UserType !== 'SuperAdmin') {
          console.log('🔄 Updating UserType to SuperAdmin');
          user.UserType = 'SuperAdmin';
        }
        
        // Update password
        console.log('🔄 Updating password...');
        const hashedPassword = await bcrypt.hash(password, 10);
        user.Password = hashedPassword;
        
        user.Verified = true;
        
        await user.save();
        console.log('✅ User updated successfully!\n');
      } else {
        console.log('❌ User not found with either email. Creating new SuperAdmin...\n');
        
        // Create new SuperAdmin
        const hashedPassword = await bcrypt.hash(password, 10);
        user = new User({
          FirstName: 'Prashant',
          LastName: 'Raj',
          Email: newEmail,
          Phone: '9934001660',
          UserName: newEmail,
          Password: hashedPassword,
          InstutionCode: 'SYSTEM',
          InstutionName: 'Educational Eternity System',
          MemberId: 'SUPERADMIN-001',
          UserType: 'SuperAdmin',
          PermissionSet: 'all',
          Verified: true
        });
        
        await user.save();
        console.log('✅ New SuperAdmin created!\n');
      }
    }

    // Verify user can be found
    console.log('🔍 Verifying user can be found...');
    const foundUser = await User.findOne({
      $or: [
        { Email: newEmail },
        { Phone: '9934001660' },
        { UserName: newEmail }
      ]
    });
    
    if (foundUser) {
      console.log('✅ User found with login query!');
      console.log('\n📋 Final User Details:');
      console.log('   Email:', foundUser.Email);
      console.log('   UserType:', foundUser.UserType);
      console.log('   Phone:', foundUser.Phone);
      console.log('   Verified:', foundUser.Verified);
      console.log('\n✅ SuperAdmin is ready for login!');
    } else {
      console.log('❌ User still not found with login query!');
    }

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

fixSuperAdmin();

