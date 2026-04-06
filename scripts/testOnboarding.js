/**
 * Test script to debug onboarding issues
 * Run: node scripts/testOnboarding.js
 */

const mongoose = require('mongoose');
require('dotenv').config();

const testOnboarding = async () => {
  try {
    // Connect to database
    const dbUrl = process.env.DBCONNECTIONURL || 'mongodb://localhost:27017/EducationalEternity';
    console.log('Connecting to:', dbUrl.replace(/\/\/.*@/, '//***:***@')); // Hide credentials
    
    await mongoose.connect(dbUrl, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    
    console.log('✅ Connected to database');
    
    // Test models
    const Institution = require('../models/InstutionModel');
    const User = require('../models/User');
    const { AcademicYear } = require('../models/academicYearModel');
    
    console.log('✅ All models loaded');
    
    // Test data
    const testData = {
      institutionName: "Test School",
      email: "test@school.com",
      contactNumber: "9876543210",
      state: "Maharashtra",
      district: "Mumbai",
      address: "123 Test Street, Test City, 400001",
      adminFirstName: "Test",
      adminLastName: "Admin",
      adminEmail: "admin@test.com",
      adminPassword: "Test123456!",
      adminPhone: "9876543210"
    };
    
    console.log('\n📋 Test Data:');
    console.log(JSON.stringify(testData, null, 2));
    
    // Validate required fields
    console.log('\n🔍 Validating models...');
    
    // Check Institution model
    const institutionTest = new Institution({
      Instution_Id: 'TEST-001',
      Instution_Name: testData.institutionName,
      Email: testData.email,
      Contact_Number: testData.contactNumber,
      Address: testData.address,
      State: testData.state,
      District: testData.district,
      Management_Member: ['System Admin'],
      Url: 'http://localhost:3000/login',
      Status: true
    });
    
    try {
      await institutionTest.validate();
      console.log('✅ Institution model validation passed');
    } catch (err) {
      console.log('❌ Institution model validation failed:', err.message);
      console.log('Errors:', err.errors);
    }
    
    // Check User model
    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash(testData.adminPassword, 10);
    
    const userTest = new User({
      FirstName: testData.adminFirstName,
      LastName: testData.adminLastName,
      Email: testData.adminEmail,
      Phone: testData.adminPhone,
      UserName: testData.adminEmail,
      Password: hashedPassword,
      InstutionCode: 'TEST-001',
      InstutionName: testData.institutionName,
      MemberId: 'TEST-001-ADMIN-001',
      UserType: 'Admin',
      PermissionSet: 'all',
      Verified: true
    });
    
    try {
      await userTest.validate();
      console.log('✅ User model validation passed');
    } catch (err) {
      console.log('❌ User model validation failed:', err.message);
      console.log('Errors:', err.errors);
    }
    
    // Check AcademicYear model
    const currentYear = new Date().getFullYear();
    const academicYearTest = new AcademicYear({
      InstutionCode: 'TEST-001',
      Year_Name: `${currentYear}-${currentYear + 1}`,
      Start_Date: new Date(currentYear, 0, 1),
      End_Date: new Date(currentYear + 1, 11, 31),
      Is_Current: true,
      Status: true,
      Terms: [
        {
          Term_Name: 'First Term',
          Start_Date: new Date(currentYear, 0, 1),
          End_Date: new Date(currentYear, 5, 30),
          Status: 'Active'
        }
      ]
    });
    
    try {
      await academicYearTest.validate();
      console.log('✅ AcademicYear model validation passed');
    } catch (err) {
      console.log('❌ AcademicYear model validation failed:', err.message);
      console.log('Errors:', err.errors);
    }
    
    console.log('\n✅ All model validations completed');
    
    await mongoose.disconnect();
    console.log('✅ Disconnected from database');
    
  } catch (error) {
    console.error('❌ Error:', error);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
};

testOnboarding();

