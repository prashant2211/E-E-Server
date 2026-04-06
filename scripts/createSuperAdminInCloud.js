const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

/**
 * Create SuperAdmin in MongoDB Atlas (cloud database)
 */
const createSuperAdmin = async () => {
  try {
    const mongoUri = 'mongodb+srv://educational-eternity-admin:jf9uaT6oL3pp32Cj@cluster0.byh4bzb.mongodb.net/EducationalEternity?retryWrites=true&w=majority&appName=cluster0';
    
    console.log('🔌 Connecting to MongoDB Atlas...');
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
    console.log(`📊 Users before: ${beforeCount}`);
    
    if (beforeCount > 0) {
      const existingUsers = await usersCollection.find({}).project({ Email: 1, UserType: 1 }).limit(10).toArray();
      console.log('Existing users:');
      existingUsers.forEach((u, i) => {
        console.log(`  ${i + 1}. ${u.Email} (${u.UserType})`);
      });
    }
    
    // Delete existing user with this email
    console.log(`\n🔍 Checking for user: ${email}...`);
    const existingUser = await usersCollection.findOne({ Email: email });
    
    if (existingUser) {
      console.log('✅ User already exists!');
      console.log('   Email:', existingUser.Email);
      console.log('   UserType:', existingUser.UserType);
      
      // Update password and userType to be sure
      console.log('\n🔄 Updating user...');
      const hashedPassword = await bcrypt.hash(password, 10);
      await usersCollection.updateOne(
        { Email: email },
        {
          $set: {
            Password: hashedPassword,
            UserType: userType,
            Verified: true,
            FirstName: firstName,
            LastName: lastName,
            Phone: phone,
            UserName: email,
            InstutionCode: 'SYSTEM',
            InstutionName: 'Educational Eternity System',
            MemberId: 'SUPERADMIN-001',
            PermissionSet: 'all',
            updatedAt: new Date()
          }
        }
      );
      console.log('✅ User updated!');
    } else {
      console.log('❌ User not found. Creating new user...');
      
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
    }
    
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
    console.log('\n🎉 SuperAdmin user ready in cloud database!');
    console.log('\n📝 Login Credentials:');
    console.log('   Email:', email);
    console.log('   Password:', password);
    console.log('   UserType:', userType);
    console.log('\n✅ Ready to login!');
    
    process.exit(foundUser ? 0 : 1);
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
    }
    process.exit(1);
  }
};

createSuperAdmin();

