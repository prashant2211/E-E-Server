const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

/**
 * Create user using EXACT same method as server
 * This will work even if server is running
 */
const createUser = async () => {
  try {
    // Use EXACT same connection as server.js
    const mongoUri = process.env.DBCONNECTIONURL || 'mongodb://localhost:27017/EducationalEternity';
    
    const mongoOptions = {
      maxPoolSize: 10,
      minPoolSize: 5,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      family: 4,
    };
    
    console.log('Connecting to:', mongoUri);
    await mongoose.connect(mongoUri, mongoOptions);
    
    const db = mongoose.connection.db;
    const dbName = db.databaseName;
    console.log(`✅ Connected to: ${dbName}\n`);
    
    // Use User model (same as server)
    const User = require('../models/User');
    console.log('User model collection:', User.collection.name);
    
    // Check current users
    const beforeCount = await User.countDocuments();
    console.log(`Users before: ${beforeCount}`);
    
    // Delete existing
    await User.deleteMany({ Email: 'prashsantraj813@gmail.com' });
    console.log('✅ Cleaned existing user\n');
    
    // Create user using User model (same as server uses)
    const hashedPassword = await bcrypt.hash('Educ@t!onal$123', 10);
    
    const superAdmin = new User({
      FirstName: 'Prashant',
      LastName: 'Raj',
      Email: 'prashsantraj813@gmail.com',
      Phone: '9934001660',
      UserName: 'prashsantraj813@gmail.com',
      Password: hashedPassword,
      InstutionCode: 'SYSTEM',
      InstutionName: 'Educational Eternity System',
      MemberId: 'SUPERADMIN-001',
      UserType: 'SuperAdmin',
      PermissionSet: 'all',
      Verified: true
    });
    
    await superAdmin.save();
    console.log('✅ User saved using User model!');
    console.log('   ID:', superAdmin._id);
    console.log('   Email:', superAdmin.Email);
    
    // Verify with User model
    const found = await User.findOne({ Email: 'prashsantraj813@gmail.com' });
    console.log('\n🔍 Verification:');
    console.log('   User.findOne():', found ? 'FOUND' : 'NOT FOUND');
    
    const count = await User.countDocuments();
    console.log('   User.countDocuments():', count);
    
    // Also check direct collection
    const directCount = await db.collection('users').countDocuments();
    console.log('   db.collection(users).countDocuments():', directCount);
    
    if (found && count > 0) {
      console.log('\n✅ SUCCESS! User exists and can be found!');
      console.log('   Email:', found.Email);
      console.log('   UserType:', found.UserType);
    } else {
      console.log('\n❌ FAILED! User not found!');
    }
    
    await mongoose.connection.close();
    process.exit(found ? 0 : 1);
    
  } catch (error) {
    console.error('Error:', error.message);
    await mongoose.connection.close();
    process.exit(1);
  }
};

createUser();

