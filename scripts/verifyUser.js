const mongoose = require('mongoose');
require('dotenv').config();

const verifyUser = async () => {
  try {
    // Check what database server would use
    const mongoUri = process.env.DBCONNECTIONURL || 'mongodb://localhost:27017/EducationalEternity';
    
    console.log('🔍 Checking database...');
    console.log('Connection URI:', mongoUri);
    
    await mongoose.connect(mongoUri);
    const db = mongoose.connection.db;
    const dbName = db.databaseName;
    
    console.log(`\n✅ Connected to: ${dbName}`);
    
    // List all databases
    const adminDb = db.admin();
    const allDbs = await adminDb.listDatabases();
    console.log('\n📊 All databases on this MongoDB:');
    allDbs.databases.forEach(d => {
      if (!d.name.includes('admin') && !d.name.includes('local') && !d.name.includes('config')) {
        console.log(`  - ${d.name}`);
      }
    });
    
    // Check users collection
    const usersCollection = db.collection('users');
    const count = await usersCollection.countDocuments();
    
    console.log(`\n📋 Users in '${dbName}' database, 'users' collection: ${count}`);
    
    if (count === 0) {
      console.log('\n❌ NO USERS FOUND!');
      console.log('   This is the database the server connects to.');
      console.log('   We need to create the user here.');
    } else {
      const users = await usersCollection.find({}).toArray();
      console.log('\n✅ Users found:');
      users.forEach((u, i) => {
        console.log(`  ${i + 1}. ${u.Email} (${u.UserType})`);
      });
    }
    
    // Also check with User model
    console.log('\n🔍 Checking with User model...');
    const User = require('../models/User');
    const modelCount = await User.countDocuments();
    console.log(`User.countDocuments(): ${modelCount}`);
    
    const modelUser = await User.findOne({ Email: 'prashsantraj813@gmail.com' });
    console.log(`User.findOne(): ${modelUser ? 'FOUND' : 'NOT FOUND'}`);
    
    if (modelUser) {
      console.log('   Email:', modelUser.Email);
      console.log('   UserType:', modelUser.UserType);
    }
    
    await mongoose.connection.close();
    process.exit(0);
    
  } catch (error) {
    console.error('Error:', error.message);
    await mongoose.connection.close();
    process.exit(1);
  }
};

verifyUser();

