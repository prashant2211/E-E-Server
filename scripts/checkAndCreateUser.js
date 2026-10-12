const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const createUser = async () => {
  try {
    // Try to connect to what server uses
    const mongoUri = process.env.DBCONNECTIONURL || 'mongodb://localhost:27017/EducationalEternity';
    
    console.log('Connecting to:', mongoUri);
    await mongoose.connect(mongoUri);
    
    const db = mongoose.connection.db;
    const dbName = db.databaseName;
    console.log(`\n✅ Connected to database: ${dbName}`);
    
    // List all collections
    const collections = await db.listCollections().toArray();
    console.log(`\nCollections: ${collections.map(c => c.name).join(', ')}`);
    
    // Check users collection
    const usersCollection = db.collection('users');
    const count = await usersCollection.countDocuments();
    console.log(`\n📊 Users in 'users' collection: ${count}`);
    
    if (count > 0) {
      const users = await usersCollection.find({}).toArray();
      console.log('\nExisting users:');
      users.forEach((u, i) => {
        console.log(`  ${i + 1}. ${u.Email} (${u.UserType})`);
      });
    }
    
    // Delete ALL users first
    console.log('\n🗑️  Deleting ALL users...');
    const deleteResult = await usersCollection.deleteMany({});
    console.log(`✅ Deleted ${deleteResult.deletedCount} user(s)`);
    
    // Verify it's empty
    const afterDelete = await usersCollection.countDocuments();
    console.log(`📊 Users after delete: ${afterDelete}`);
    
    if (afterDelete > 0) {
      console.log('❌ ERROR: Users still exist after delete!');
    }
    
    // Now create the user
    console.log('\n🔄 Creating SuperAdmin user...');
    const hashedPassword = await bcrypt.hash('Educ@t!onal$123', 10);
    
    const user = {
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
      Verified: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    const result = await usersCollection.insertOne(user);
    console.log('✅ User inserted!');
    console.log('   ID:', result.insertedId);
    
    // Verify immediately
    const finalCount = await usersCollection.countDocuments();
    console.log(`\n📊 Final user count: ${finalCount}`);
    
    if (finalCount === 0) {
      console.log('❌ ERROR: User count is still 0 after insert!');
      console.log('   This should not happen!');
    } else {
      const insertedUser = await usersCollection.findOne({ _id: result.insertedId });
      console.log('✅ User found after insert:');
      console.log('   Email:', insertedUser.Email);
      console.log('   UserType:', insertedUser.UserType);
    }
    
    // Test with User model
    console.log('\n🔍 Testing with User model...');
    const User = require('../models/User');
    const modelUser = await User.findOne({ Email: 'prashsantraj813@gmail.com' });
    console.log('User model findOne():', modelUser ? 'FOUND' : 'NOT FOUND');
    
    if (modelUser) {
      console.log('   Email:', modelUser.Email);
      console.log('   UserType:', modelUser.UserType);
    }
    
    await mongoose.connection.close();
    console.log('\n✅ Done!');
    process.exit(0);
    
  } catch (error) {
    console.error('Error:', error.message);
    await mongoose.connection.close();
    process.exit(1);
  }
};

createUser();

