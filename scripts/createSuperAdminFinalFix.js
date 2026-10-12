const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

/**
 * Create SuperAdmin - FINAL FIX
 * Uses EXACT same connection as server.js
 */
const createSuperAdmin = async () => {
  try {
    // Server.js line 129: await mongoose.connect(process.env.DBCONNECTIONURL, mongoOptions);
    // If DBCONNECTIONURL is not set, this will FAIL or use undefined
    const mongoUri = process.env.DBCONNECTIONURL;
    
    console.log('🔍 Checking server connection...');
    console.log('DBCONNECTIONURL:', mongoUri || 'NOT SET IN .ENV');
    
    if (!mongoUri) {
      console.log('\n⚠️  WARNING: DBCONNECTIONURL not set in .env');
      console.log('   Server.js will try to connect with undefined URI');
      console.log('   This will likely fail or connect to wrong database\n');
    }
    
    // Server uses these exact options
    const mongoOptions = {
      maxPoolSize: 10,
      minPoolSize: 5,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      family: 4,
    };
    
    // Try to connect with same method as server
    let dbName = 'EducationalEternity'; // Based on server logs
    
    if (mongoUri) {
      console.log('Using DBCONNECTIONURL from .env');
      await mongoose.connect(mongoUri, mongoOptions);
    } else {
      // Server logs show "EducationalEternity" database
      const defaultUri = 'mongodb://localhost:27017/EducationalEternity';
      console.log('Using default:', defaultUri);
      await mongoose.connect(defaultUri, mongoOptions);
    }
    
    const db = mongoose.connection.db;
    const actualDbName = db.databaseName;
    console.log(`✅ Connected to database: ${actualDbName}\n`);

    const email = 'prashsantraj813@gmail.com';
    const firstName = 'Prashant';
    const lastName = 'Raj';
    const phone = '9934001660';
    const password = 'Educ@t!onal$123';
    const userType = 'SuperAdmin';

    const usersCollection = db.collection('users');
    
    // Check current state
    const beforeCount = await usersCollection.countDocuments();
    console.log(`📊 Users before: ${beforeCount}`);
    
    // Delete ALL users first (clean slate)
    console.log('\n🗑️  Cleaning all users...');
    const deleteAll = await usersCollection.deleteMany({});
    console.log(`✅ Deleted ${deleteAll.deletedCount} user(s)`);

    console.log('\n🔄 Creating SuperAdmin user...');
    
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
    
    // Verify immediately
    const afterCount = await usersCollection.countDocuments();
    console.log(`📊 Users after: ${afterCount}`);
    
    if (afterCount === 0) {
      console.log('\n❌ ERROR: User was not inserted!');
      process.exit(1);
    }
    
    // Verify with User model (same as login)
    console.log('\n🔍 Verifying with User model (login query)...');
    const User = require('../models/User');
    
    const foundUser = await User.findOne({
      $or: [
        { Email: email },
        { Phone: phone },
        { UserName: email }
      ]
    });
    
    if (foundUser) {
      console.log('✅ User found with User model!');
      console.log('   Email:', foundUser.Email);
      console.log('   UserType:', foundUser.UserType);
      console.log('   Verified:', foundUser.Verified);
      
      // Test password
      const passwordMatch = await bcrypt.compare(password, foundUser.Password);
      console.log('   Password match:', passwordMatch ? '✅ YES' : '❌ NO');
    } else {
      console.log('❌ ERROR: User NOT found with User model!');
      console.log('   This means login will fail!');
      
      // Try direct collection query
      const directUser = await usersCollection.findOne({ Email: email });
      if (directUser) {
        console.log('   But user EXISTS in collection directly!');
        console.log('   This suggests a User model issue.');
      }
    }
    
    // Final verification - list all users
    const allUsers = await usersCollection.find({}).toArray();
    console.log(`\n📋 All users in ${actualDbName}:`);
    if (allUsers.length === 0) {
      console.log('   ❌ NO USERS FOUND!');
    } else {
      allUsers.forEach((u, i) => {
        console.log(`   ${i + 1}. ${u.Email} (${u.UserType})`);
      });
    }
    
    await mongoose.connection.close();
    console.log('\n✅ Database connection closed');
    
    if (foundUser) {
      console.log('\n🎉 SuperAdmin user created and verified!');
      console.log('\n📝 Login Credentials:');
      console.log('   Email:', email);
      console.log('   Password:', password);
      console.log('   UserType:', userType);
      console.log('   Database:', actualDbName);
      console.log('\n✅ Ready to login!');
    } else {
      console.log('\n❌ FAILED: User created but not found with User model');
      console.log('   Check User model or database connection');
    }
    
    process.exit(foundUser ? 0 : 1);
    
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

