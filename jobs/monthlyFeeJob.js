const dayjs = require('dayjs');

const Student = require('../models/studentModel');
const FeeStructure = require('../models/feeStructureModel');
const FeePayment = require('../models/feePaymentModel');
const { AcademicYear } = require('../models/academicYearModel');
const { logger } = require('../utils/logger');
const {
  getMarkedMonthlyHeads,
  computeDueContext,
  isMonthAdvanceCovered,
  getPreviousMonthlyPending,
  computeStudentTotalPayable,
} = require('../utils/feeHeads');
const { serializeOtherFeeBreakdown } = require('../utils/otherFeeSubtypes');

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

      const monthlyHeads = getMarkedMonthlyHeads(feeStructure);
      const monthlyAmount = monthlyHeads.reduce((sum, h) => sum + h.amount, 0);
      if (monthlyAmount <= 0) {
        result.skippedCount += 1;
        continue;
      }

      const studentPayments = await FeePayment.find({
        InstutionId: instCode,
        StudentId: s.Registration_Number,
        ...(academicYearName ? { AcademicYear: academicYearName } : {}),
      }).lean();

      if (isMonthAdvanceCovered(studentPayments, currentMonth)) {
        result.skippedCount += 1;
        continue;
      }

      const dueContext = computeDueContext({
        structure: feeStructure,
        payments: studentPayments,
        month: currentMonth,
        academicYear: academicYearName,
      });
      if (dueContext.monthlyDue <= 0) {
        result.skippedCount += 1;
        continue;
      }

      const monthlyHeadKeys = monthlyHeads.map((h) => h.key);
      const otherBreakdown = monthlyHeads
        .filter((h) => h.isOtherSubtype)
        .map((h) => ({
          key: h.key,
          name: h.label,
          amount: h.amount,
          frequency: 'monthly',
        }));
      const otherMonthlyTotal = otherBreakdown.reduce((sum, item) => sum + item.amount, 0);

      const getStandardMonthly = (key) => {
        const head = monthlyHeads.find((h) => h.key === key && !h.isOtherSubtype);
        return head ? head.amount : 0;
      };

      const previousMonthlyPending = getPreviousMonthlyPending(studentPayments, {
        structure: feeStructure,
        month: currentMonth,
        currentMonthDue: monthlyAmount,
        fallback: s.OutstandingAmount,
      });
      const payable = computeStudentTotalPayable(feeStructure, studentPayments, {
        month: currentMonth,
        academicYear: academicYearName,
        storedOutstanding: s.OutstandingAmount,
      });
      // Before this month's SYSTEM row exists, payable = previous pending + current month fee.
      const outstanding = payable.outstanding;

      await FeePayment.create({
        InstutionId: instCode,
        StudentId: s.Registration_Number,
        StudentName: `${s.First_Name || ''} ${s.Last_Name || ''}`.trim(),
        Class: className,
        TutionFee: String(getStandardMonthly('TutionFee')),
        LibraryFee: String(getStandardMonthly('LibraryFee')),
        ActivityFee: String(getStandardMonthly('ActivityFee')),
        ExamFee: String(getStandardMonthly('ExamFee')),
        UniformFee: String(getStandardMonthly('UniformFee')),
        ProspectusFee: String(getStandardMonthly('ProspectusFee')),
        AdmissionFee: String(getStandardMonthly('AdmissionFee')),
        TransportFee: String(getStandardMonthly('TransportFee')),
        OtherFee: String(otherMonthlyTotal),
        OtherFeeBreakdown: serializeOtherFeeBreakdown(otherBreakdown),
        SelectedFeeHeads: monthlyHeadKeys,
        PaidAmount: '0',
        PendingAmount: String(previousMonthlyPending),
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

      await Student.updateOne(
        { _id: s._id },
        { OutstandingAmount: String(outstanding) }
      );

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
