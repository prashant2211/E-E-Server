const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

/**
 * Create SuperAdmin in the CORRECT database that server uses
 */
const createSuperAdmin = async () => {
  try {
    // Use the EXACT same connection string as server
    const mongoUri = process.env.DBCONNECTIONURL || 'mongodb://localhost:27017/educational-eternity';
    console.log('🔌 Connecting to MongoDB...');
    console.log('   URI:', mongoUri.replace(/\/\/.*@/, '//***@'));
    
    await mongoose.connect(mongoUri, {
      maxPoolSize: 10,
      minPoolSize: 5,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    
    const db = mongoose.connection.db;
    const dbName = db.databaseName;
    console.log(`✅ Connected to database: ${dbName}\n`);
    
    // Check what collections exist
    const collections = await db.listCollections().toArray();
    console.log(`Collections in database: ${collections.map(c => c.name).join(', ')}\n`);

    const email = 'prashsantraj813@gmail.com';
    const firstName = 'Prashant';
    const lastName = 'Raj';
    const phone = '9934001660';
    const password = 'Educ@t!onal$123';
    const userType = 'SuperAdmin';

    console.log('🔍 Checking for existing user...');
    const usersCollection = db.collection('users');
    
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
    
    // Verify with the EXACT query login uses
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
      console.log('   UserName:', foundUser.UserName);
      console.log('   Phone:', foundUser.Phone);
      console.log('   UserType:', foundUser.UserType);
      console.log('   Verified:', foundUser.Verified);
    } else {
      console.log('❌ ERROR: User NOT found with login query!');
    }
    
    // Count total users
    const userCount = await usersCollection.countDocuments();
    console.log(`\n📊 Total users in database: ${userCount}`);
    
    // List all users
    if (userCount > 0) {
      const allUsers = await usersCollection.find({}).project({ Email: 1, UserType: 1 }).limit(10).toArray();
      console.log('\nAll users in database:');
      allUsers.forEach((u, i) => {
        console.log(`   ${i + 1}. ${u.Email} (${u.UserType})`);
      });
    }
    
    await mongoose.connection.close();
    console.log('\n✅ Database connection closed');
    console.log('\n🎉 SuperAdmin user created successfully!');
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

createSuperAdmin();

