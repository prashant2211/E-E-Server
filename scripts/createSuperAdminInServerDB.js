const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

/**
 * Create SuperAdmin in the database that the SERVER is actually using
 * Based on server logs, it's connecting to "EducationalEternity" database
 */
const createSuperAdmin = async () => {
  try {
    // Try the database name from server logs: "EducationalEternity"
    // First try with the connection string from .env, then try different database names
    let mongoUri = process.env.DBCONNECTIONURL;
    
    if (!mongoUri) {
      // Try different database names
      const dbNames = ['EducationalEternity', 'educational-eternity', 'educationaleternity'];
      console.log('⚠️  DBCONNECTIONURL not set in .env');
      console.log('   Will try to find the correct database...\n');
      
      for (const dbName of dbNames) {
        mongoUri = `mongodb://localhost:27017/${dbName}`;
        console.log(`Trying: ${mongoUri}`);
        
        try {
          await mongoose.connect(mongoUri, {
            maxPoolSize: 10,
            minPoolSize: 5,
            serverSelectionTimeoutMS: 2000,
            socketTimeoutMS: 45000,
          });
          
          const db = mongoose.connection.db;
          const actualDbName = db.databaseName;
          const userCount = await db.collection('users').countDocuments();
          
          console.log(`✅ Connected to: ${actualDbName}`);
          console.log(`   Users in database: ${userCount}`);
          
          if (userCount > 0) {
            console.log(`\n🎯 Found database with users: ${actualDbName}`);
            break;
          } else {
            await mongoose.connection.close();
          }
        } catch (err) {
          console.log(`   Failed: ${err.message}`);
          if (mongoose.connection.readyState === 1) {
            await mongoose.connection.close();
          }
        }
      }
    } else {
      // Use connection string from .env
      console.log('Using DBCONNECTIONURL from .env');
      await mongoose.connect(mongoUri, {
        maxPoolSize: 10,
        minPoolSize: 5,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
      });
    }
    
    const db = mongoose.connection.db;
    const dbName = db.databaseName;
    console.log(`\n✅ Connected to database: ${dbName}\n`);

    const email = 'prashsantraj813@gmail.com';
    const firstName = 'Prashant';
    const lastName = 'Raj';
    const phone = '9934001660';
    const password = 'Educ@t!onal$123';
    const userType = 'SuperAdmin';

    const usersCollection = db.collection('users');
    
    // Check existing users
    const existingCount = await usersCollection.countDocuments();
    console.log(`📊 Existing users in database: ${existingCount}`);
    
    if (existingCount > 0) {
      const existingUsers = await usersCollection.find({}).project({ Email: 1, UserType: 1 }).limit(10).toArray();
      console.log('Existing users:');
      existingUsers.forEach((u, i) => {
        console.log(`   ${i + 1}. ${u.Email} (${u.UserType})`);
      });
    }
    
    console.log(`\n🔍 Checking for user: ${email}...`);
    
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
    
    // Final count
    const finalCount = await usersCollection.countDocuments();
    console.log(`\n📊 Total users in database now: ${finalCount}`);
    
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

