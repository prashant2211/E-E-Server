const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

/**
 * Clean database and create fresh SuperAdmin
 */
const cleanAndCreate = async () => {
  try {
    const mongoUri = process.env.DBCONNECTIONURL || 'mongodb://localhost:27017/educational-eternity';
    console.log('🔌 Connecting to MongoDB...');
    
    await mongoose.connect(mongoUri);
    const db = mongoose.connection.db;
    const dbName = db.databaseName;
    console.log(`✅ Connected to database: ${dbName}\n`);

    console.log('🗑️  Cleaning database...');
    
    // Get all collections
    const collections = await db.listCollections().toArray();
    console.log(`Found ${collections.length} collections\n`);
    
    let totalDeleted = 0;
    
    // Delete from each collection
    for (const collection of collections) {
      try {
        const result = await db.collection(collection.name).deleteMany({});
        console.log(`✅ Cleaned ${collection.name}: ${result.deletedCount} documents`);
        totalDeleted += result.deletedCount;
      } catch (error) {
        console.log(`⚠️  Error cleaning ${collection.name}: ${error.message}`);
      }
    }
    
    console.log(`\n✅ Database cleaned! Total documents deleted: ${totalDeleted}\n`);

    // Now create SuperAdmin
    console.log('👤 Creating SuperAdmin user...');
    
    const email = 'prashsantraj813@gmail.com';
    const firstName = 'Prashant';
    const lastName = 'Raj';
    const phone = '9934001660';
    const password = 'Educ@t!onal$123';
    const userType = 'SuperAdmin';
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Create user directly in collection
    const usersCollection = db.collection('users');
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
    console.log('✅ SuperAdmin user created!');
    console.log('   ID:', result.insertedId);
    console.log('   Email:', email);
    console.log('   UserType:', userType);
    
    // Verify
    const foundUser = await usersCollection.findOne({ Email: email });
    if (foundUser) {
      console.log('\n✅ Verification: User found in database!');
      console.log('   Email:', foundUser.Email);
      console.log('   UserType:', foundUser.UserType);
      console.log('   Verified:', foundUser.Verified);
    } else {
      console.log('\n❌ ERROR: User not found after creation!');
    }
    
    // Count total users
    const userCount = await usersCollection.countDocuments();
    console.log(`\n📊 Total users in database: ${userCount}`);
    
    await mongoose.connection.close();
    console.log('\n✅ Database connection closed');
    console.log('\n🎉 Database cleaned and SuperAdmin created!');
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

cleanAndCreate();

