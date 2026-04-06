const cron = require('node-cron');
const dayjs = require('dayjs');

const Student = require('../models/studentModel');
const FeeStructure = require('../models/feeStructureModel');
const FeePayment = require('../models/feePaymentModel');
const { AcademicYear } = require('../models/academicYearModel');
const { logger } = require('../utils/logger');

// Helper: safe number parsing
const toAmount = (val) => {
  if (val === null || val === undefined) return 0;
  const n = parseFloat(String(val).toString().replace(/,/g, '').trim());
  return Number.isNaN(n) ? 0 : n;
};

/**
 * Generate monthly fee entries for all active students at the start of each month.
 * - For each institution (InstutionCode on Student):
 *   - For each active student:
 *     - Find fee structure by InstutionId + Class (+ Section when present)
 *     - Add structure.Total to student's OutstandingAmount
 *     - Insert a FeePayment record marked as system-generated for this Month
 * The job is idempotent per month: it will not re-run if system-generated
 * monthly records already exist for the given month.
 */
const runMonthlyFeeGeneration = async () => {
  try {
    const currentMonth = dayjs().format('YYYY-MM'); // e.g. "2026-03"
    const currentDate = dayjs();
    const dateStr = currentDate.format('DD/MM/YYYY');
    const timeStr = currentDate.format('HH:mm:ss');

    logger.info(`[MonthlyFeeJob] Starting fee generation for month ${currentMonth}`);

    // Get all distinct institutions from students
    const instutionCodes = await Student.distinct('InstutionCode', { Status: true });

    if (!instutionCodes.length) {
      logger.info('[MonthlyFeeJob] No active students found, nothing to process.');
      return;
    }

    logger.info(
      `[MonthlyFeeJob] Processing monthly fees for ${instutionCodes.length} institution(s).`
    );

    for (const instCode of instutionCodes) {
      try {
        const currentYearDoc = await AcademicYear.findOne({
          InstutionCode: instCode,
          Is_Current: true,
          Status: true,
        }).lean();

        const academicYearName = currentYearDoc?.Year_Name || '';

        const students = await Student.find({
          InstutionCode: instCode,
          Status: true,
        }).lean();

        if (!students.length) {
          logger.info(
            `[MonthlyFeeJob] No active students for institution ${instCode}, skipping.`
          );
          continue;
        }

        logger.info(
          `[MonthlyFeeJob] Generating monthly fee for ${students.length} student(s) of institution ${instCode}.`
        );

        // Idempotency check per institution + academic year
        const existingForInst = await FeePayment.findOne({
          InstutionId: instCode,
          Month: currentMonth,
          FeeType: 'Monthly',
          PaymentMode: 'SYSTEM',
          AcademicYear: academicYearName,
        }).lean();

        if (existingForInst) {
          logger.info(
            `[MonthlyFeeJob] Monthly fee already generated for instution=${instCode}, academicYear=${academicYearName}, month=${currentMonth}. Skipping.`
          );
          continue;
        }

        for (const s of students) {
          try {
            const className = s.Class;
            const section = s.Section || '';

            if (!className) {
              logger.warn(
                `[MonthlyFeeJob] Student ${s._id} has no Class set, skipping fee generation.`
              );
              continue;
            }

            // Try Class + Section first, fall back to Class only
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
              logger.warn(
                `[MonthlyFeeJob] No fee structure found for institution=${instCode}, class=${className}, section=${section ||
                  'N/A'}; skipping student ${s._id}.`
              );
              continue;
            }

            // Assume Total represents the monthly fee
            const monthlyAmount = toAmount(feeStructure.Total);
            if (monthlyAmount <= 0) {
              logger.warn(
                `[MonthlyFeeJob] Monthly amount is zero for institution=${instCode}, class=${className}, section=${section ||
                  'N/A'}; skipping student ${s._id}.`
              );
              continue;
            }

            const prevOutstanding = toAmount(s.OutstandingAmount);
            const newOutstanding = prevOutstanding + monthlyAmount;

            // Update student's outstanding amount
            await Student.updateOne(
              { _id: s._id },
              { $set: { OutstandingAmount: newOutstanding.toString() } }
            );

            // Create a system-generated feePayment record
            await FeePayment.create({
              InstutionId: instCode,
              StudentId: s.Registration_Number,
              StudentName: `${s.First_Name || ''} ${s.Last_Name || ''}`.trim(),
              Class: className,
              TutionFee: feeStructure.TutionFee || '0',
              LibraryFee: feeStructure.LibraryFee || '0',
              ActivityFee: feeStructure.ActivityFee || '0',
              ExamFee: feeStructure.ExamFee || '0',
              UniformFee: feeStructure.UniformFee || '0',
              ProspectusFee: feeStructure.ProspectusFee || '0',
              TransportFee: feeStructure.TransportFee || '0',
              OtherFee: feeStructure.OtherFee || '0',
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
          } catch (studentErr) {
            logger.error(
              `[MonthlyFeeJob] Error processing student ${s._id} for institution ${instCode}:`,
              studentErr
            );
          }
        }
      } catch (instErr) {
        logger.error(
          `[MonthlyFeeJob] Error processing institution ${instCode}:`,
          instErr
        );
      }
    }

    logger.info(`[MonthlyFeeJob] Monthly fee generation completed for ${currentMonth}.`);
  } catch (err) {
    logger.error('[MonthlyFeeJob] Fatal error in monthly fee generation:', err);
  }
};

// Schedule: at 00:05 on day 1 of every month
const scheduleMonthlyFeeJob = () => {
  logger.info('[MonthlyFeeJob] Scheduling monthly fee generation job (0 5 1 * *).');
  cron.schedule('5 0 1 * *', () => {
    runMonthlyFeeGeneration();
  });
};

module.exports = {
  scheduleMonthlyFeeJob,
  runMonthlyFeeGeneration,
};

