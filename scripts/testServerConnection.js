const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

/**
 * Test EXACT server connection and create user
 */
const testConnection = async () => {
  try {
    // EXACT same as server.js line 129
    const mongoOptions = {
      maxPoolSize: 10,
      minPoolSize: 5,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      family: 4,
    };

    const mongoUri = process.env.DBCONNECTIONURL || 'mongodb://localhost:27017/EducationalEternity';
    
    console.log('🔌 Connecting with EXACT server method...');
    console.log('URI:', mongoUri);
    console.log('Options:', JSON.stringify(mongoOptions, null, 2));
    
    await mongoose.connect(mongoUri, mongoOptions);
    
    const db = mongoose.connection.db;
    const dbName = db.databaseName;
    console.log(`\n✅ Connected to: ${dbName}`);
    console.log(`Connection state: ${mongoose.connection.readyState}`);
    
    // Check users
    const usersCollection = db.collection('users');
    const count = await usersCollection.countDocuments();
    console.log(`\n📊 Users in collection: ${count}`);
    
    if (count === 0) {
      console.log('\n⚠️  Database is EMPTY - creating user now...');
      
      const email = 'prashsantraj813@gmail.com';
      const hashedPassword = await bcrypt.hash('Educ@t!onal$123', 10);
      
      const user = {
        FirstName: 'Prashant',
        LastName: 'Raj',
        Email: email,
        Phone: '9934001660',
        UserName: email,
        Password: hashedPassword,
        InstutionCode: 'SYSTEM',
        InstutionName: 'Educational Eternity System',
        MemberId: 'SUPERADMIN-001',
        UserType: 'SuperAdmin',
        PermissionSet: 'all',
        Verified: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      const result = await usersCollection.insertOne(user);
      console.log('✅ User created! ID:', result.insertedId);
      
      // Verify
      const newCount = await usersCollection.countDocuments();
      console.log(`📊 Users after create: ${newCount}`);
      
      if (newCount === 0) {
        console.log('❌ ERROR: Count still 0 after insert!');
      } else {
        const inserted = await usersCollection.findOne({ _id: result.insertedId });
        console.log('✅ User found:', inserted ? 'YES' : 'NO');
        if (inserted) {
          console.log('   Email:', inserted.Email);
          console.log('   UserType:', inserted.UserType);
        }
      }
    } else {
      const users = await usersCollection.find({}).toArray();
      console.log('\n✅ Users found:');
      users.forEach((u, i) => {
        console.log(`  ${i + 1}. ${u.Email} (${u.UserType})`);
      });
    }
    
    // Test with User model
    console.log('\n🔍 Testing with User model...');
    const User = require('../models/User');
    const modelCount = await User.countDocuments();
    console.log(`User.countDocuments(): ${modelCount}`);
    
    const modelUser = await User.findOne({ Email: 'prashsantraj813@gmail.com' });
    console.log(`User.findOne(): ${modelUser ? 'FOUND' : 'NOT FOUND'}`);
    
    await mongoose.connection.close();
    console.log('\n✅ Connection closed');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    await mongoose.connection.close();
    process.exit(1);
  }
};

testConnection();

