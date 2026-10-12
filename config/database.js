/**
 * Database configuration and index setup
 * Ensures optimal performance with proper indexing
 */

const mongoose = require('mongoose');
const { logger } = require('../utils/logger');

/**
 * Create database indexes for optimal performance
 * Run this once or on server startup
 */
const createIndexes = async () => {
  try {
    const studentModel = require('../models/studentModel');
    const classModel = require('../models/classModel');
    const teacherModel = require('../models/teacherModel');
    const userModel = require('../models/User');
    const attendanceModel = require('../models/attendenceRecordModel');
    const feePaymentModel = require('../models/feePaymentModel');

    // Student indexes
    await studentModel.collection.createIndex({ InstutionCode: 1, Status: 1 });
    await studentModel.collection.createIndex({ Registration_Number: 1 }, { unique: true });
    await studentModel.collection.createIndex({ InstutionCode: 1, Class: 1 });
    await studentModel.collection.createIndex({ Email: 1 });
    await studentModel.collection.createIndex({ Contact_Number: 1 });
    await studentModel.collection.createIndex({ InstutionCode: 1, First_Name: 1, Last_Name: 1 });

    // Class indexes
    await classModel.collection.createIndex({ InstutionCode: 1 });
    
    // Clean up old Class_Code indexes if they exist
    try {
        const existingIndexes = await classModel.collection.indexes();
        const oldIndexes = existingIndexes.filter(idx => 
            idx.name.includes('Class_Code') || 
            (idx.key && Object.keys(idx.key).includes('Class_Code'))
        );
        
        for (const oldIdx of oldIndexes) {
            try {
                await classModel.collection.dropIndex(oldIdx.name);
                logger.info(`Dropped old index: ${oldIdx.name}`);
            } catch (err) {
                logger.warn(`Could not drop index ${oldIdx.name}: ${err.message}`);
            }
        }
        
        // Also drop ClassCode unique index if it exists (we enforce uniqueness at app level)
        const classCodeUniqueIndexes = existingIndexes.filter(idx => 
            (idx.key && idx.key.ClassCode === 1 && idx.unique) ||
            idx.name === 'ClassCode_unique_index'
        );
        
        for (const idx of classCodeUniqueIndexes) {
            try {
                await classModel.collection.dropIndex(idx.name);
                logger.info(`Dropped ClassCode unique index: ${idx.name}`);
            } catch (err) {
                logger.warn(`Could not drop index ${idx.name}: ${err.message}`);
            }
        }
    } catch (error) {
        logger.warn('Error cleaning up old class indexes:', error.message);
    }
    
    // Note: ClassCode uniqueness is enforced at application level, not via database index

    // Teacher indexes
    await teacherModel.collection.createIndex({ InstutionCode: 1, Status: 1 });
    await teacherModel.collection.createIndex({ Email: 1 });

    // User indexes - Check if index exists before creating
    try {
      const existingIndexes = await userModel.collection.indexes();
      const emailIndexExists = existingIndexes.some(idx => idx.key && idx.key.Email === 1);
      
      if (!emailIndexExists) {
        await userModel.collection.createIndex({ Email: 1 }, { unique: true, sparse: true });
      }
    } catch (error) {
      // Index might already exist with different options, skip
      logger.warn('Email index creation skipped:', error.message);
    }
    
    try {
      await userModel.collection.createIndex({ UserName: 1, InstutionCode: 1 }, { unique: true });
    } catch (error) {
      logger.warn('UserName index creation skipped:', error.message);
    }
    
    try {
      await userModel.collection.createIndex({ InstutionCode: 1, UserType: 1 });
    } catch (error) {
      logger.warn('UserType index creation skipped:', error.message);
    }

    // Attendance indexes
    await attendanceModel.collection.createIndex({ InstutionCode: 1, Date: 1, Class: 1 });
    await attendanceModel.collection.createIndex({ Student_Id: 1, Date: 1 });

    // Fee Payment indexes
    await feePaymentModel.collection.createIndex({ InstutionCode: 1, Registration_Number: 1 });
    await feePaymentModel.collection.createIndex({ Payment_Date: 1 });
    await feePaymentModel.collection.createIndex({ Status: 1 });

    // Library indexes
    const { LibraryBook, LibraryTransaction } = require('../models/libraryModel');
    await LibraryBook.collection.createIndex({ InstutionCode: 1, Status: 1 });
    await LibraryBook.collection.createIndex({ ISBN: 1 }, { unique: true, sparse: true });
    await LibraryTransaction.collection.createIndex({ InstutionCode: 1, Status: 1 });
    await LibraryTransaction.collection.createIndex({ Registration_Number: 1, Status: 1 });

    // Transport indexes
    const { Vehicle, Driver, TransportRoute, StudentTransport } = require('../models/transportModel');
    await Vehicle.collection.createIndex({ InstutionCode: 1, Status: 1 });
    await Vehicle.collection.createIndex({ Vehicle_Number: 1 }, { unique: true });
    await Driver.collection.createIndex({ InstutionCode: 1, Status: 1 });
    await Driver.collection.createIndex({ License_Number: 1 }, { unique: true });
    await TransportRoute.collection.createIndex({ InstutionCode: 1, Status: 1 });
    await StudentTransport.collection.createIndex({ InstutionCode: 1, Registration_Number: 1 });

    // Hostel indexes
    const { HostelRoom, HostelAllocation, HostelMaintenance } = require('../models/hostelModel');
    await HostelRoom.collection.createIndex({ InstutionCode: 1, Status: 1 });
    await HostelAllocation.collection.createIndex({ InstutionCode: 1, Registration_Number: 1 });
    await HostelMaintenance.collection.createIndex({ InstutionCode: 1, Status: 1 });

    // Homework indexes
    const { Homework, HomeworkSubmission } = require('../models/homeworkModel');
    await Homework.collection.createIndex({ InstutionCode: 1, Class: 1, Status: 1 });
    await Homework.collection.createIndex({ InstutionCode: 1, Due_Date: 1 });
    await HomeworkSubmission.collection.createIndex({ InstutionCode: 1, Homework_Id: 1 });
    await HomeworkSubmission.collection.createIndex({ InstutionCode: 1, Registration_Number: 1 });

    // Academic Year indexes
    const { AcademicYear, SystemSettings } = require('../models/academicYearModel');
    await AcademicYear.collection.createIndex({ InstutionCode: 1, Is_Current: 1 });
    await SystemSettings.collection.createIndex({ InstutionCode: 1 }, { unique: true });

    // Exam Schedule indexes
    const examScheduleModel = require('../models/examScheduleModel');
    await examScheduleModel.collection.createIndex({ InstutionCode: 1, ExamDate: 1 });

    // Exam Subject Marks indexes
    const examSubjectMarksModel = require('../models/examSubjectMarksModel');
    await examSubjectMarksModel.collection.createIndex({ InstutionCode: 1, ClassCode: 1, SectionCode: 1, ExamType: 1, Subject: 1 }, { unique: true });
    await examSubjectMarksModel.collection.createIndex({ InstutionCode: 1, ClassCode: 1, ExamType: 1 });
    await examSubjectMarksModel.collection.createIndex({ InstutionCode: 1, ExamType: 1 });
    await examScheduleModel.collection.createIndex({ InstutionCode: 1, ClassCode: 1 });
    await examScheduleModel.collection.createIndex({ InstutionCode: 1, Status: 1 });

    logger.info('Database indexes created successfully');
  } catch (error) {
    logger.error('Error creating indexes:', error);
  }
};

/**
 * Get database statistics
 */
const getDatabaseStats = async () => {
  try {
    const db = mongoose.connection.db;
    const stats = await db.stats();
    
    return {
      collections: stats.collections,
      dataSize: stats.dataSize,
      storageSize: stats.storageSize,
      indexes: stats.indexes,
      indexSize: stats.indexSize
    };
  } catch (error) {
    logger.error('Error getting database stats:', error);
    return null;
  }
};

module.exports = {
  createIndexes,
  getDatabaseStats
};

