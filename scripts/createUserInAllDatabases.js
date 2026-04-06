const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

/**
 * Create user in ALL possible databases
 * This ensures the user exists wherever the server connects
 */
const createInAll = async () => {
  try {
    const databases = [
      'EducationalEternity',
      'educational-eternity',
      'educationaleternity'
    ];
    
    const email = 'prashsantraj813@gmail.com';
    const password = 'Educ@t!onal$123';
    const hashedPassword = await bcrypt.hash(password, 10);
    
    for (const dbName of databases) {
      try {
        console.log(`\n📦 Processing database: ${dbName}`);
        await mongoose.connect(`mongodb://localhost:27017/${dbName}`);
        const db = mongoose.connection.db;
        
        const usersCollection = db.collection('users');
        const beforeCount = await usersCollection.countDocuments();
        console.log(`   Users before: ${beforeCount}`);
        
        // Delete existing
        await usersCollection.deleteMany({ Email: email });
        
        // Create user
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
        
        await usersCollection.insertOne(user);
        const afterCount = await usersCollection.countDocuments();
        console.log(`   ✅ Created! Users after: ${afterCount}`);
        
        // Verify
        const found = await usersCollection.findOne({ Email: email });
        console.log(`   Verification: ${found ? '✅ FOUND' : '❌ NOT FOUND'}`);
        
        await mongoose.connection.close();
        
      } catch (error) {
        console.log(`   ❌ Error: ${error.message}`);
        if (mongoose.connection.readyState === 1) {
          await mongoose.connection.close();
        }
      }
    }
    
    console.log('\n✅ Done! User created in all databases.');
    console.log('\n📝 Login Credentials:');
    console.log('   Email:', email);
    console.log('   Password:', password);
    console.log('   UserType: SuperAdmin');
    console.log('\n✅ Now restart your server and try login!');
    
    process.exit(0);
    
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
};

createInAll();

