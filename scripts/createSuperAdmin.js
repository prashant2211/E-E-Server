const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
require('dotenv').config();

/**
 * Script to create SuperAdmin user
 * This is the owner of the ERP system who can onboard schools
 */
const createSuperAdmin = async () => {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.DBCONNECTIONURL || 'mongodb://localhost:27017/educational-eternity';
    await mongoose.connect(mongoUri);
    
    console.log('✅ Connected to MongoDB\n');

    // Get SuperAdmin details from command line or use defaults
    const args = process.argv.slice(2);
    let firstName, lastName, email, password, phone;

    if (args.length >= 5) {
      firstName = args[0];
      lastName = args[1];
      email = args[2];
      password = args[3];
      phone = args[4];
    } else {
      // Use defaults or prompt
      console.log('📝 SuperAdmin Creation\n');
      console.log('Usage: node createSuperAdmin.js <firstName> <lastName> <email> <password> <phone>');
      console.log('\nOr use interactive mode:\n');
      
      // For interactive, you can use readline
      firstName = 'Super';
      lastName = 'Admin';
      email = process.env.SUPERADMIN_EMAIL || 'superadmin@educationaleternity.com';
      password = process.env.SUPERADMIN_PASSWORD || 'SuperAdmin@123456';
      phone = process.env.SUPERADMIN_PHONE || '9999999999';
      
      console.log('Using default values:');
      console.log(`  First Name: ${firstName}`);
      console.log(`  Last Name: ${lastName}`);
      console.log(`  Email: ${email}`);
      console.log(`  Password: ${password}`);
      console.log(`  Phone: ${phone}\n`);
    }

    // Check if SuperAdmin already exists
    const existingSuperAdmin = await User.findOne({ 
      UserType: 'SuperAdmin',
      Email: email 
    });

    if (existingSuperAdmin) {
      console.log('⚠️  SuperAdmin with this email already exists!');
      console.log('   Email:', existingSuperAdmin.Email);
      console.log('   User ID:', existingSuperAdmin._id);
      await mongoose.connection.close();
      process.exit(0);
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create SuperAdmin user
    const superAdmin = new User({
      FirstName: firstName,
      LastName: lastName,
      Email: email,
      Phone: phone,
      UserName: email,
      Password: hashedPassword,
      InstutionCode: 'SYSTEM',
      InstutionName: 'Educational Eternity System',
      MemberId: 'SUPERADMIN-001',
      UserType: 'SuperAdmin',
      PermissionSet: 'all',
      Verified: true
    });

    await superAdmin.save();

    console.log('✅ SuperAdmin created successfully!\n');
    console.log('📋 Credentials:');
    console.log('   Email:', email);
    console.log('   Password:', password);
    console.log('   User Type: SuperAdmin');
    console.log('   Member ID:', superAdmin.MemberId);
    console.log('   Phone:', phone);
    console.log('\n⚠️  IMPORTANT: Save these credentials securely!');
    console.log('   You will need these to login and onboard schools.');
    console.log('\n📝 Next Steps:');
    console.log('   1. Login using: POST /api/login');
    console.log('   2. Get your token from response');
    console.log('   3. Use token to onboard schools: POST /api/onboard/school\n');

    await mongoose.connection.close();
    console.log('✅ Database connection closed');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error creating SuperAdmin:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
};

// Run script
if (require.main === module) {
  createSuperAdmin();
}

module.exports = createSuperAdmin;

