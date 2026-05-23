const dayjs = require('dayjs');

const Student = require('../models/studentModel');
const FeeStructure = require('../models/feeStructureModel');
const FeePayment = require('../models/feePaymentModel');
const { AcademicYear } = require('../models/academicYearModel');
const { logger } = require('../utils/logger');
const {
  toAmount,
  sumHeadsByFrequency,
  getHeadAmount,
  getHeadFrequency,
  FEE_HEADS,
} = require('../utils/feeHeads');

/**
 * Monthly fee generation (manual only — Fee Management “Generate” button).
 * Idempotent per month: skips if a SYSTEM monthly record already exists for the month.
 */
const generateMonthlyFeesForInstitution = async (instCode) => {
  const currentMonth = dayjs().format('YYYY-MM');
  const currentDate = dayjs();
  const dateStr = currentDate.format('DD/MM/YYYY');
  const timeStr = currentDate.format('HH:mm:ss');

  const result = {
    month: currentMonth,
    instutionId: instCode,
    academicYear: '',
    alreadyGenerated: false,
    generatedCount: 0,
    skippedCount: 0,
    errorCount: 0,
    totalMonthlyAmount: 0,
    errors: [],
  };

  if (!instCode) {
    result.errors.push({ message: 'Institution code is required' });
    return result;
  }

  const currentYearDoc = await AcademicYear.findOne({
    InstutionCode: instCode,
    Is_Current: true,
    Status: true,
  }).lean();

  const academicYearName = currentYearDoc?.Year_Name || '';
  result.academicYear = academicYearName;

  const existingForInst = await FeePayment.findOne({
    InstutionId: instCode,
    Month: currentMonth,
    FeeType: 'Monthly',
    PaymentMode: 'SYSTEM',
    AcademicYear: academicYearName,
  }).lean();

  if (existingForInst) {
    result.alreadyGenerated = true;
    return result;
  }

  const students = await Student.find({
    InstutionCode: instCode,
    Status: true,
  }).lean();

  if (!students.length) {
    return result;
  }

  for (const s of students) {
    try {
      const className = s.Class;
      const section = s.Section || '';

      if (!className) {
        result.skippedCount += 1;
        continue;
      }

      let feeStructure = await FeeStructure.findOne({
        InstutionId: instCode,
        Class: className,
        Section: section,
      }).lean();

      if (!feeStructure) {
        feeStructure = await FeeStructure.findOne({
          InstutionId: instCode,
          Class: className,
        }).lean();
      }

      if (!feeStructure) {
        result.skippedCount += 1;
        continue;
      }

      const monthlyAmount = sumHeadsByFrequency(feeStructure, 'monthly');
      if (monthlyAmount <= 0) {
        result.skippedCount += 1;
        continue;
      }

      const prevOutstanding = toAmount(s.OutstandingAmount);
      const newOutstanding = prevOutstanding + monthlyAmount;

      await Student.updateOne(
        { _id: s._id },
        { $set: { OutstandingAmount: newOutstanding.toString() } }
      );

      const monthlyHeadKeys = FEE_HEADS.filter(
        (h) => getHeadFrequency(feeStructure, h.key) === 'monthly'
      ).map((h) => h.key);

      await FeePayment.create({
        InstutionId: instCode,
        StudentId: s.Registration_Number,
        StudentName: `${s.First_Name || ''} ${s.Last_Name || ''}`.trim(),
        Class: className,
        TutionFee: String(getHeadAmount(feeStructure, 'TutionFee') || 0),
        LibraryFee: String(getHeadAmount(feeStructure, 'LibraryFee') || 0),
        ActivityFee: String(getHeadAmount(feeStructure, 'ActivityFee') || 0),
        ExamFee: '0',
        UniformFee: '0',
        ProspectusFee: '0',
        TransportFee: String(getHeadAmount(feeStructure, 'TransportFee') || 0),
        OtherFee: String(getHeadAmount(feeStructure, 'OtherFee') || 0),
        SelectedFeeHeads: monthlyHeadKeys,
        PaidAmount: '0',
        PendingAmount: newOutstanding.toString(),
        ScholarshipAmount: '0',
        ConcessionAmount: '0',
        Month: currentMonth,
        AcademicYear: academicYearName,
        FeeType: 'Monthly',
        PaymentMode: 'SYSTEM',
        PaymentReference: '',
        Date: dateStr,
        Time: timeStr,
        Status: 'Pending',
      });

      result.generatedCount += 1;
      result.totalMonthlyAmount += monthlyAmount;
    } catch (studentErr) {
      result.errorCount += 1;
      result.errors.push({
        studentId: s.Registration_Number,
        message: studentErr.message || 'Unknown error',
      });
      logger.error(
        `[MonthlyFeeJob] Error processing student ${s._id} for institution ${instCode}:`,
        studentErr
      );
    }
  }

  return result;
};

module.exports = {
  generateMonthlyFeesForInstitution,
};
