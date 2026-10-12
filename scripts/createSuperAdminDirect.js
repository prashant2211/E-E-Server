const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

/**
 * Create SuperAdmin using EXACT same connection as server
 */
const createSuperAdmin = async () => {
  try {
    // Use EXACT same connection as server.js
    const mongoUri = process.env.DBCONNECTIONURL;
    
    if (!mongoUri) {
      console.log('❌ DBCONNECTIONURL not set in .env');
      console.log('   Server will use default, but we need to know which database.');
      console.log('   Based on server logs, it connects to: EducationalEternity');
      console.log('   Creating user in EducationalEternity database...\n');
    } else {
      console.log('Using DBCONNECTIONURL from .env');
    }
    
    // Use same connection options as server
    const mongoOptions = {
      maxPoolSize: 10,
      minPoolSize: 5,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      family: 4,
    };
    
    // Connect to EducationalEternity (what server logs show)
    const dbUri = mongoUri || 'mongodb://localhost:27017/EducationalEternity';
    console.log('Connecting to:', dbUri.replace(/\/\/.*@/, '//***@'));
    
    await mongoose.connect(dbUri, mongoOptions);
    
    const db = mongoose.connection.db;
    const dbName = db.databaseName;
    console.log(`✅ Connected to database: ${dbName}\n`);

    const email = 'prashsantraj813@gmail.com';
    const firstName = 'Prashant';
    const lastName = 'Raj';
    const phone = '9934001660';
    const password = 'Educ@t!onal$123';
    const userType = 'SuperAdmin';

    const usersCollection = db.collection('users');
    
    // Check current state
    const currentCount = await usersCollection.countDocuments();
    console.log(`📊 Current users in database: ${currentCount}`);
    
    // Delete any existing user with this email
    const deleteResult = await usersCollection.deleteMany({ 
      $or: [
        { Email: email },
        { UserName: email },
        { Phone: phone }
      ]
    });
    
    if (deleteResult.deletedCount > 0) {
      console.log(`✅ Deleted ${deleteResult.deletedCount} existing user(s)\n`);
    }

    console.log('🔄 Creating SuperAdmin user...');
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Create user document
    const superAdmin = {
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
      Verified: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    // Insert directly into collection
    const insertResult = await usersCollection.insertOne(superAdmin);
    console.log('✅ SuperAdmin user created!');
    console.log('   ID:', insertResult.insertedId);
    console.log('   Email:', email);
    console.log('   UserType:', userType);
    
    // Verify with User model (same as login uses)
    console.log('\n🔍 Verifying with User model (same as login)...');
    const User = require('../models/User');
    
    const foundUser = await User.findOne({
      $or: [
        { Email: email },
        { Phone: phone },
        { UserName: email }
      ]
    });
    
    if (foundUser) {
      console.log('✅ User found with User model query!');
      console.log('   Email:', foundUser.Email);
      console.log('   UserName:', foundUser.UserName);
      console.log('   Phone:', foundUser.Phone);
      console.log('   UserType:', foundUser.UserType);
      console.log('   Verified:', foundUser.Verified);
    } else {
      console.log('❌ ERROR: User NOT found with User model query!');
      console.log('   This means login will fail!');
    }
    
    // Final count
    const finalCount = await usersCollection.countDocuments();
    console.log(`\n📊 Total users in database now: ${finalCount}`);
    
    // Test password
    if (foundUser) {
      const passwordMatch = await bcrypt.compare(password, foundUser.Password);
      console.log(`   Password match: ${passwordMatch ? '✅ YES' : '❌ NO'}`);
    }
    
    await mongoose.connection.close();
    console.log('\n✅ Database connection closed');
    console.log('\n🎉 SuperAdmin user created in database:', dbName);
    console.log('\n📝 Login Credentials:');
    console.log('   Email:', email);
    console.log('   Password:', password);
    console.log('   UserType:', userType);
    console.log('\n✅ Ready to login!');
    
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error('Stack:', error.stack);
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
    }
    process.exit(1);
  }
};

createSuperAdmin();

