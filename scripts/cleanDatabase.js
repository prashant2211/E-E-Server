const mongoose = require('mongoose');
require('dotenv').config();

// Import all models
const Institution = require('../models/InstutionModel');
const User = require('../models/User');
const Student = require('../models/studentModel');
const Teacher = require('../models/teacherModel');
const Class = require('../models/classModel');
const Section = require('../models/sectionModel');
const Attendance = require('../models/attendenceModel');
const AttendanceRecord = require('../models/attendenceRecordModel');
const FeeStructure = require('../models/feeStructureModel');
const FeePayment = require('../models/feePaymentModel');
const StudentFeeDetails = require('../models/studentFeeDetailsModel');
const Announcement = require('../models/announcementModel');
const Holiday = require('../models/holidayModel');
const Timetable = require('../models/scheduleClassModel');
const Marksheet = require('../models/studentMarksheetModel');
const Admission = require('../models/admissionModel');
const AdmissionInquiry = require('../models/admissionInquaryModel');
const TransferCertificate = require('../models/transferCertificateModel');
const Library = require('../models/libraryModel');
const Transport = require('../models/transportModel');
const Hostel = require('../models/hostelModel');
const Homework = require('../models/homeworkModel');
const AcademicYear = require('../models/academicYearModel');
const StaffSalary = require('../models/StaffSalaryDetails');
const StaffSalaryPayment = require('../models/staffSalaryPaymentDetails');
const StaffJobApply = require('../models/staffJobApplyModels');
const ManagementMember = require('../models/managementModel');
const InstitutionBankInfo = require('../models/instutionBankInfo');
const SupportTicket = require('../models/supportTicket');
const PermissionAssignment = require('../models/permissionAssinment');
const OTPVerification = require('../models/otpVerification');
const FacultyChat = require('../models/facultyChatModel');
// Note: KnowledgeCenter model may not exist, handle gracefully
let KnowledgeCenter;
try {
  KnowledgeCenter = require('../models/knowladgeCenterModel');
} catch (e) {
  KnowledgeCenter = null;
}

const cleanDatabase = async () => {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/educational-eternity';
    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    console.log('✅ Connected to MongoDB');
    console.log('🗑️  Starting database cleanup...\n');

    // List of all collections to clean
    const collections = [
      { name: 'Institutions', model: Institution },
      { name: 'Users', model: User },
      { name: 'Students', model: Student },
      { name: 'Teachers', model: Teacher },
      { name: 'Classes', model: Class },
      { name: 'Sections', model: Section },
      { name: 'Attendance', model: Attendance },
      { name: 'Attendance Records', model: AttendanceRecord },
      { name: 'Fee Structures', model: FeeStructure },
      { name: 'Fee Payments', model: FeePayment },
      { name: 'Student Fee Details', model: StudentFeeDetails },
      { name: 'Announcements', model: Announcement },
      { name: 'Holidays', model: Holiday },
      { name: 'Timetables', model: Timetable },
      { name: 'Marksheets', model: Marksheet },
      { name: 'Admissions', model: Admission },
      { name: 'Admission Inquiries', model: AdmissionInquiry },
      { name: 'Transfer Certificates', model: TransferCertificate },
      { name: 'Library', model: Library },
      { name: 'Transport', model: Transport },
      { name: 'Hostel', model: Hostel },
      { name: 'Homework', model: Homework },
      { name: 'Academic Years', model: AcademicYear },
      { name: 'Staff Salaries', model: StaffSalary },
      { name: 'Staff Salary Payments', model: StaffSalaryPayment },
      { name: 'Staff Job Applications', model: StaffJobApply },
      { name: 'Management Members', model: ManagementMember },
      { name: 'Institution Bank Info', model: InstitutionBankInfo },
      { name: 'Support Tickets', model: SupportTicket },
      { name: 'Permission Assignments', model: PermissionAssignment },
      { name: 'OTP Verifications', model: OTPVerification },
      { name: 'Faculty Chats', model: FacultyChat },
      ...(KnowledgeCenter ? [{ name: 'Knowledge Center', model: KnowledgeCenter }] : []),
    ];

    let totalDeleted = 0;

    // Delete all documents from each collection
    for (const collection of collections) {
      try {
        const result = await collection.model.deleteMany({});
        console.log(`✅ Cleaned ${collection.name}: ${result.deletedCount} documents`);
        totalDeleted += result.deletedCount;
      } catch (error) {
        console.error(`❌ Error cleaning ${collection.name}:`, error.message);
      }
    }

    // Drop all indexes and recreate them (optional - for complete cleanup)
    console.log('\n🔄 Rebuilding indexes...');
    
    // Get all collections from database
    const db = mongoose.connection.db;
    const dbCollections = await db.listCollections().toArray();
    
    for (const coll of dbCollections) {
      try {
        await db.collection(coll.name).dropIndexes();
        console.log(`✅ Dropped indexes for ${coll.name}`);
      } catch (error) {
        // Ignore errors for collections without indexes
      }
    }

    console.log('\n✨ Database cleanup completed!');
    console.log(`📊 Total documents deleted: ${totalDeleted}`);
    console.log('\n💡 Note: Indexes will be recreated automatically on next server start.');
    
    await mongoose.connection.close();
    console.log('✅ Database connection closed');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error during database cleanup:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
};

// Run cleanup
if (require.main === module) {
  console.log('⚠️  WARNING: This will delete ALL data from the database!');
  console.log('Press Ctrl+C to cancel, or wait 5 seconds to continue...\n');
  
  setTimeout(() => {
    cleanDatabase();
  }, 5000);
}

module.exports = cleanDatabase;

