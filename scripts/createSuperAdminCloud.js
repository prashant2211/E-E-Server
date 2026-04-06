const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

/**
 * Create SuperAdmin in MongoDB Atlas
 * Run this manually: node scripts/createSuperAdminCloud.js
 */
const createSuperAdmin = async () => {
  try {
    // Get connection string from .env
    const mongoUri = process.env.DBCONNECTIONURL;
    
    if (!mongoUri) {
      console.error('❌ DBCONNECTIONURL not set in .env file!');
      console.error('   Please add: DBCONNECTIONURL=mongodb+srv://...');
      process.exit(1);
    }
    
    console.log('🔌 Connecting to MongoDB Atlas...');
    console.log('   URI:', mongoUri.replace(/\/\/.*@/, '//***@'));
    
    await mongoose.connect(mongoUri, {
      maxPoolSize: 10,
      minPoolSize: 5,
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
    });
    
    const db = mongoose.connection.db;
    const dbName = db.databaseName;
    console.log(`✅ Connected to cloud database: ${dbName}\n`);

    const email = 'prashsantraj813@gmail.com';
    const firstName = 'Prashant';
    const lastName = 'Raj';
    const phone = '9934001660';
    const password = 'Educ@t!onal$123';
    const userType = 'SuperAdmin';

    const usersCollection = db.collection('users');
    
    // Check current state
    const beforeCount = await usersCollection.countDocuments();
    console.log(`📊 Users in cloud database: ${beforeCount}`);
    
    if (beforeCount > 0) {
      const existingUsers = await usersCollection.find({}).project({ Email: 1, UserType: 1 }).limit(10).toArray();
      console.log('Existing users:');
      existingUsers.forEach((u, i) => {
        console.log(`  ${i + 1}. ${u.Email} (${u.UserType})`);
      });
    }
    
    // Delete existing user with this email
    console.log(`\n🔍 Checking for user: ${email}...`);
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
    
    // Create user
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
    
    const result = await usersCollection.insertOne(superAdmin);
    console.log('✅ SuperAdmin created!');
    console.log('   ID:', result.insertedId);
    console.log('   Email:', email);
    console.log('   UserType:', userType);
    
    // Verify with login query
    console.log('\n🔍 Verifying with login query...');
    const foundUser = await usersCollection.findOne({
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
      console.log('   Verified:', foundUser.Verified);
      
      // Test password
      const passwordMatch = await bcrypt.compare(password, foundUser.Password);
      console.log('   Password match:', passwordMatch ? '✅ YES' : '❌ NO');
    } else {
      console.log('❌ ERROR: User NOT found with login query!');
    }
    
    // Final count
    const finalCount = await usersCollection.countDocuments();
    console.log(`\n📊 Total users in cloud database: ${finalCount}`);
    
    await mongoose.connection.close();
    console.log('\n✅ Connection closed');
    console.log('\n🎉 SuperAdmin user created in cloud database!');
    console.log('\n📝 Login Credentials:');
    console.log('   Email:', email);
    console.log('   Password:', password);
    console.log('   UserType:', userType);
    console.log('\n✅ Ready to login!');
    
    process.exit(foundUser ? 0 : 1);
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.message.includes('ECONNREFUSED') || error.message.includes('querySrv')) {
      console.error('\n⚠️  Connection failed. Possible reasons:');
      console.error('   1. Internet connection issue');
      console.error('   2. MongoDB Atlas IP whitelist - your IP might not be allowed');
      console.error('   3. Network restrictions');
      console.error('\n   Please check MongoDB Atlas network access settings.');
    }
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
    }
    process.exit(1);
  }
};

createSuperAdmin();

