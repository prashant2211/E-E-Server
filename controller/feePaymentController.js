const path = require('path')
const { response } = require('express')
const feePaymentModel = require('../models/feePaymentModel')
const feeStructureModel = require('../models/feeStructureModel')
const studentModel = require('../models/studentModel')
const admissionModel = require('../models/admissionModel')
const instutionBankInfoModel = require('../models/instutionBankInfo')
const { SystemSettings } = require('../models/academicYearModel')
const { resolveAcademicYearScope } = require('../utils/academicYearScope')
const { resolveOwnStudentRegistration } = require('../utils/studentPortalAccess')
const { getPermissionSet } = require('./permissionAssinment')
const AWS = require('aws-sdk')

const ACCESS_KEY = process.env.ACCESS_KEY
const SECRET_ACCESS_KEY = process.env.SECRET_ACCESS_KEY
const BUCKET_NAME = process.env.BUCKET_NAME
const AWS_REGION = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'ap-southeast-2'

const s3 =
  ACCESS_KEY && SECRET_ACCESS_KEY && BUCKET_NAME
    ? new AWS.S3({
        accessKeyId: ACCESS_KEY,
        secretAccessKey: SECRET_ACCESS_KEY,
        region: AWS_REGION,
      })
    : null

const uploadFeeProofToS3 = async (buffer, key, contentType) => {
  if (!s3) {
    throw new Error('S3 configuration missing (ACCESS_KEY, SECRET_ACCESS_KEY, BUCKET_NAME)')
  }
  return s3
    .upload({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: contentType || 'application/octet-stream',
    })
    .promise()
}

const getFeeProofSignedUrl = async (key) => {
  if (!s3 || !key || !BUCKET_NAME) return null
  try {
    return await s3.getSignedUrlPromise('getObject', {
      Bucket: BUCKET_NAME,
      Key: key,
      Expires: 3600,
    })
  } catch {
    return null
  }
}

/** S3-safe segment for proof object names: InstitutionCode_StudentRegistrationNumber_fileName */
const sanitizeProofNamePart = (value, maxLen) => {
  const s = String(value ?? '')
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9_-]/g, '')
  const out = s.substring(0, maxLen)
  return out || 'NA'
}

const attachProofSignedUrls = async (rows) => {
  const list = Array.isArray(rows) ? rows : []
  for (const row of list) {
    if (row && row.ProofImageKey) {
      row.ProofSignedUrl = await getFeeProofSignedUrl(row.ProofImageKey)
    }
  }
  return list
}

const {
  generateMonthlyFeesForInstitution,
} = require('../jobs/monthlyFeeJob')
const {
  toAmount,
  findFeeStructure,
  findFeeStructureFromList,
  resolveSelectedHeadKeys,
  amountsForSelectedHeads,
  feeTypeLabelFromHeads,
  computeDueContext,
  alreadyPaidHeadLabels,
  sumHeadsByFrequency,
  sumHeadsByFrequencyOnPayment,
  computeInstitutionMonthlyPending,
  sumStudentsPayable,
  paymentCountsAsPaid,
  getPreviousMonthlyPending,
  computeTotalMonthlyOutstanding,
  computeStudentTotalPayable,
  applyPaymentToStudentOutstanding,
  PENDING_FEE_KEY,
  PENDING_FEE_LABEL,
  filterStructureHeadKeys,
  buildPendingFeeHead,
  FEE_HEADS,
  STANDARD_FEE_HEADS,
  buildHeadsFromStructure,
  getHeadFrequency,
  getHeadAmount,
  buildAdvanceQuote,
  buildAdvanceFeeTypeLabel,
  getAdvanceCoveredMonths,
  currentMonthKey,
  formatMonthLabel,
  isMonthAdvanceCovered,
  isSystemMonthlyGeneration,
} = require('../utils/feeHeads')
const { serializeOtherFeeBreakdown } = require('../utils/otherFeeSubtypes')
const { requireTenantInstitution } = require('../utils/institutionContext')

const feePaymentWriteAllowed = (permissionsResult) => {
  const raw = String(permissionsResult?.feePayment || '')
  const parts = raw.split('-')
  return parts.includes('W') || parts.includes('E')
}

const feePaymentReadAllowed = (permissionsResult) => {
  const raw = String(permissionsResult?.feePayment || '')
  const parts = raw.split('-')
  return parts.includes('R') || parts.includes('RA') || parts.includes('W') || parts.includes('E')
}

const normalizeCollectorUserType = (userType) =>
  String(userType || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')

const isOfficialFeeCollector = (user) => {
  const userType = normalizeCollectorUserType(user?.UserType)
  return (
    userType === 'admin' ||
    userType === 'superadmin' ||
    userType === 'accountant' ||
    userType === 'accountscoordinator' ||
    userType === 'accountcoordinator'
  )
}

const collectionStatusForUser = (user) => (isOfficialFeeCollector(user) ? 'Paid' : 'Partial')

const isStudentUser = (user) => normalizeCollectorUserType(user?.UserType) === 'student'

const canIssueFeeDemandSlip = (user) => isOfficialFeeCollector(user) || isStudentUser(user)

const resolveDemandSlipRegistrations = (req, requestedIds = []) => {
  const ids = (Array.isArray(requestedIds) ? requestedIds : [requestedIds])
    .map((id) => String(id || '').trim())
    .filter(Boolean)

  if (isStudentUser(req.user)) {
    const own = String(req.user?.MemberId || '').trim()
    if (!own) {
      return {
        error: {
          status: 400,
          message: 'Your account is not linked to a student registration number.',
        },
      }
    }
    if (ids.length && ids.some((id) => id.toLowerCase() !== own.toLowerCase())) {
      return {
        error: {
          status: 403,
          message: 'You can only download your own fee demand slip.',
        },
      }
    }
    return { registrationNumbers: [own] }
  }

  if (isOfficialFeeCollector(req.user)) {
    if (!ids.length) {
      return {
        error: { status: 400, message: 'Select at least one student for the demand slip.' },
      }
    }
    return { registrationNumbers: [...new Set(ids)] }
  }

  return {
    error: {
      status: 403,
      message: 'Only Admin, Accountant, or the student can download a fee demand slip.',
    },
  }
}

const loadDemandPaymentInstructions = async (instutionId) => {
  const bank = await instutionBankInfoModel
    .findOne({ InstutionId: instutionId, status: true })
    .lean()
    .catch(() => null)
  const bankDoc =
    bank ||
    (await instutionBankInfoModel.findOne({ InstutionId: instutionId }).lean().catch(() => null))

  let qrUrl = ''
  try {
    const settings = await SystemSettings.findOne({ InstutionCode: instutionId }).lean()
    const qrKey = settings?.Settings?.Documents?.FeeQRKey
    if (qrKey) {
      qrUrl = (await getFeeProofSignedUrl(qrKey)) || settings?.Settings?.Documents?.FeeQRUrl || ''
    } else {
      qrUrl = settings?.Settings?.Documents?.FeeQRUrl || ''
    }
  } catch {
    qrUrl = ''
  }

  if (!bankDoc && !qrUrl) return null
  return {
    bankName: bankDoc?.bankName || '',
    accountHolderName: bankDoc?.accountHolderName || '',
    accountNumber: bankDoc?.accountNumber || '',
    ifsc: bankDoc?.IFSCCode || '',
    branchName: bankDoc?.branchName || '',
    accountType: bankDoc?.accountType || '',
    upiId: bankDoc?.upiId || '',
    upiNumber: bankDoc?.upiNumber || '',
    qrUrl,
  }
}

const buildDemandSlipForStudent = ({
  student,
  structure,
  payments,
  month,
  academicYear,
}) => {
  const payable = computeStudentTotalPayable(structure, payments, {
    month,
    academicYear,
    storedOutstanding: student.OutstandingAmount,
  })
  const dueContext = structure
    ? computeDueContext({
        structure,
        payments,
        month,
        academicYear,
      })
    : { heads: [], monthlyDue: 0 }

  const currentHeads = (dueContext.heads || [])
    .filter((h) => h.frequency === 'monthly' && toAmount(h.amount) > 0)
    .map((h) => ({
      key: h.key,
      label: h.label,
      amount: toAmount(h.amount),
      frequency: 'monthly',
      status: h.isPaidForPeriod ? 'Paid' : 'Due',
    }))

  const lineItems = []
  if (payable.arrears > 0) {
    lineItems.push({
      key: PENDING_FEE_KEY,
      label: PENDING_FEE_LABEL,
      amount: payable.arrears,
      frequency: 'arrears',
      status: 'Due',
    })
  }
  currentHeads
    .filter((h) => h.status === 'Due')
    .forEach((h) => lineItems.push(h))

  return {
    student: {
      id: student.Registration_Number,
      name: `${student.First_Name || ''} ${student.Last_Name || ''}`.trim(),
      class: student.Class || '',
      section: student.Section || '',
      fatherName: student.Father_Name || '',
      contact: student.Contact_Number || '',
    },
    month,
    monthLabel: formatMonthLabel(month),
    academicYear: academicYear || '',
    previousPending: payable.arrears,
    currentMonthDue: payable.currentMonthDue,
    totalPayable: payable.outstanding,
    lineItems,
    currentHeads,
  }
}

// Record a fee payment (offline/online) and update outstanding
const store = async (req, res, next) => {
  try {
    const currentDate = new Date()
    const date = currentDate.toLocaleDateString()
    const time = currentDate.toLocaleTimeString()

    const instutionId = req.user?.InstutionCode || req.body.InstutionId

    // Academic year override (so fee records remain year-wise correct)
    const scope = await resolveAcademicYearScope(req)
    const academicYearName = scope?.yearDoc?.Year_Name || req.body.AcademicYear || ''
    const {
      StudentId, // Registration Number
      StudentName,
      Class,
      FeeType,
      PaymentMode,
      PaymentReference,
      Month,
      AcademicYear,
      ScholarshipAmount,
      ConcessionAmount,
      PaidAmount,
    } = req.body

    if (!instutionId || !StudentId || !Class) {
      return res.status(400).json({
        success: false,
        code: 400,
        message: 'InstutionId, StudentId and Class are required',
      })
    }

    const paid = toAmount(PaidAmount)
    if (paid <= 0) {
      return res.status(400).json({
        success: false,
        code: 400,
        message: 'Paid amount must be greater than zero',
      })
    }

    // Fetch student to get current outstanding
    const student = await studentModel.findOne({
      InstutionCode: instutionId,
      Registration_Number: StudentId,
    })

    if (!student) {
      return res.status(404).json({
        success: false,
        code: 404,
        message: 'Student not found for this institution',
      })
    }

    const priorPayments = await feePaymentModel
      .find({
        InstutionId: instutionId,
        StudentId,
        ...(scope ? { createdAt: { $gte: scope.from, $lte: scope.to } } : {}),
      })
      .lean()

    const sectionName = String(req.body.Section || student.Section || '').trim()
    const baseStructure = await findFeeStructure(
      feeStructureModel,
      instutionId,
      Class,
      sectionName
    )

    const selectedKeys = resolveSelectedHeadKeys(req.body, baseStructure)
    if (!selectedKeys.length) {
      return res.status(400).json({
        success: false,
        code: 400,
        message: 'Select at least one fee type to collect',
      })
    }

    const monthKey =
      String(Month || '').trim() ||
      `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`
    const dueContext = computeDueContext({
      structure: baseStructure,
      payments: priorPayments,
      month: monthKey,
      academicYear: academicYearName,
    })

    const paidHeadLabels = alreadyPaidHeadLabels(dueContext.heads, selectedKeys)
    if (paidHeadLabels.length > 0) {
      return res.status(400).json({
        success: false,
        code: 400,
        message: `These fee types are already paid for this period: ${paidHeadLabels.join(', ')}`,
      })
    }

    const previousBalance = getPreviousMonthlyPending(priorPayments, {
      structure: baseStructure,
      fallback: toAmount(student.OutstandingAmount),
      currentMonthDue: dueContext.monthlyDue,
      month: monthKey,
    })

    const { amounts, total: baseTotal, monthlyTotal, yearlyTotal, otherFeeBreakdown } =
      amountsForSelectedHeads(baseStructure, selectedKeys)
    const collectsPendingOnly =
      selectedKeys.includes(PENDING_FEE_KEY) && filterStructureHeadKeys(selectedKeys).length === 0
    if (baseTotal <= 0 && !selectedKeys.includes(PENDING_FEE_KEY)) {
      return res.status(400).json({
        success: false,
        code: 400,
        message: 'Selected fee types have no amount in fee structure for this class',
      })
    }
    if (collectsPendingOnly && previousBalance <= 0) {
      return res.status(400).json({
        success: false,
        code: 400,
        message: 'No pending balance to collect for this student',
      })
    }

    const feeTypeLabel = feeTypeLabelFromHeads(selectedKeys, baseStructure)

    const scholarship = toAmount(ScholarshipAmount)
    const concession = toAmount(ConcessionAmount)

    const otherWithAdmission =
      toAmount(amounts.OtherFee) + toAmount(amounts.AdmissionFee)

    const feePatment = new feePaymentModel({
      InstutionId: instutionId,
      StudentId,
      StudentName: StudentName || `${student.First_Name || ''} ${student.Last_Name || ''}`.trim(),
      Class,
      TutionFee: String(amounts.TutionFee || 0),
      LibraryFee: String(amounts.LibraryFee || 0),
      ActivityFee: String(amounts.ActivityFee || 0),
      ExamFee: String(amounts.ExamFee || 0),
      UniformFee: String(amounts.UniformFee || 0),
      ProspectusFee: String(amounts.ProspectusFee || 0),
      TransportFee: String(amounts.TransportFee || 0),
      OtherFee: String(otherWithAdmission),
      OtherFeeBreakdown: serializeOtherFeeBreakdown(otherFeeBreakdown),
      PaidAmount: paid.toString(),
      PendingAmount: '0',
      ScholarshipAmount: scholarship.toString(),
      ConcessionAmount: concession.toString(),
      Month: monthKey,
      AcademicYear: academicYearName,
      FeeType: feeTypeLabel || FeeType || 'Fee payment',
      SelectedFeeHeads: selectedKeys,
      PaymentMode,
      PaymentReference,
      Date: date,
      Time: time,
      Status: paid > 0 ? 'Success' : 'Pending',
      CollectionStatus: collectionStatusForUser(req.user),
      CollectedByUserType: String(req.user?.UserType || ''),
    })

    const hasSystemCurrent = [...priorPayments, feePatment].some((p) =>
      isSystemMonthlyGeneration(p, monthKey)
    )
    const yearlyOnThis = baseStructure
      ? sumHeadsByFrequencyOnPayment(feePatment, baseStructure, 'yearly')
      : 0
    const nextOutstanding = applyPaymentToStudentOutstanding({
      storedOutstanding: student.OutstandingAmount,
      paid,
      scholarship,
      concession,
      yearlyAmount: yearlyOnThis,
      currentMonthAlreadyInStored: hasSystemCurrent,
      includesPending: selectedKeys.includes(PENDING_FEE_KEY),
    })
    const payableAfter = computeStudentTotalPayable(baseStructure, [...priorPayments, feePatment], {
      month: monthKey,
      academicYear: academicYearName,
      storedOutstanding: nextOutstanding,
    })
    feePatment.PendingAmount = String(payableAfter.outstanding)
    await feePatment.save()

    student.OutstandingAmount = String(payableAfter.outstanding)
    await student.save()

    res.status(201).json({
      code: 201,
      success: true,
      message: 'Fee recorded successfully!',
      data: feePatment,
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
      code: 500,
    })
  }
}

const show = async (req, res, next) => {
  try {
    const resolved = resolveOwnStudentRegistration(req, req.query.StudentId)
    if (resolved.error) {
      return res.status(resolved.error.status).json({
        success: false,
        code: resolved.error.status,
        message: resolved.error.message,
      })
    }
    const studentIdForQuery = resolved.registrationNumber
    if (!studentIdForQuery) {
      return res.status(400).json({
        success: false,
        code: 400,
        message: 'StudentId is required',
      })
    }

    const scope = await resolveAcademicYearScope(req)
    const createdAtRange = scope ? { $gte: scope.from, $lte: scope.to } : null
    let feePatmentRecord
    if (req.query.Date) {
      feePatmentRecord = await feePaymentModel
        .find({
          InstutionId: req.user.InstutionCode,
          StudentId: studentIdForQuery,
          Date: req.query.Date,
          ...(createdAtRange ? { createdAt: createdAtRange } : {}),
        })
        .lean()
    }
    if (!req.query.Date) {
      feePatmentRecord = await feePaymentModel
        .find({
          InstutionId: req.user.InstutionCode,
          ...(createdAtRange ? { createdAt: createdAtRange } : {}),
          StudentId: studentIdForQuery,
        })
        .lean()
    }

    await attachProofSignedUrls(feePatmentRecord)

    res.status(200).json({
      success: true,
      message: 'Payment Fetch Successfully!',
      code: 200,
      data: feePatmentRecord,
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
      code: 500,
    })
  }
}

const showAllPayment = async (req, res, next) => {
  try {
    const instutionId = requireTenantInstitution(req, res)
    if (!instutionId) return
    const scope = await resolveAcademicYearScope(req)
    const createdAtRange = scope ? { $gte: scope.from, $lte: scope.to } : null
    let feePatmentRecord
    if (req.query.Date) {
      feePatmentRecord = await feePaymentModel
        .find({
          InstutionId: instutionId,
          Date: req.query.Date,
          ...(createdAtRange ? { createdAt: createdAtRange } : {}),
        })
        .sort({ createdAt: -1 })
        .lean()
    }
    if (!req.query.Date) {
      feePatmentRecord = await feePaymentModel
        .find({
          InstutionId: instutionId,
          ...(createdAtRange ? { createdAt: createdAtRange } : {}),
        })
        .sort({ createdAt: -1 })
        .lean()
    }

    await attachProofSignedUrls(feePatmentRecord)

    res.status(200).json({
      success: true,
      message: 'Payment list Fetch Successfully!',
      code: 200,
      data: feePatmentRecord,
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
      code: 500,
    })
  }
}

// Analytics: school and class-wise collection and pending summary
const getAnalyticsSummary = async (req, res, next) => {
  try {
    const instutionId = requireTenantInstitution(req, res)
    if (!instutionId) return

    const { fromDate, toDate, class: className } = req.query

    const today = new Date()
    const todayStr = today.toLocaleDateString()

    const baseMatch = {
      InstutionId: instutionId,
      Status: 'Success',
    }

    // Helper to sum a numeric payment field with optional extra match (date, class, etc.)
    const sumPaymentField = async (fieldName, extraMatch = {}) => {
      const match = { ...baseMatch, ...extraMatch }
      const result = await feePaymentModel.aggregate([
        { $match: match },
        {
          $group: {
            _id: null,
            total: { $sum: { $toDouble: { $ifNull: [`$${fieldName}`, '0'] } } },
          },
        },
      ])
      return result?.[0]?.total || 0
    }

    const sumPaid = (extraMatch = {}) => sumPaymentField('PaidAmount', extraMatch)
    const sumConcession = (extraMatch = {}) => sumPaymentField('ConcessionAmount', extraMatch)
    const sumScholarship = (extraMatch = {}) => sumPaymentField('ScholarshipAmount', extraMatch)

    // Total collection for entire school (all time)
    const totalCollected = await sumPaid()
    const totalScholarship = await sumScholarship()
    const totalConcession = await sumConcession()

    // Today's collection
    const todayCollected = await sumPaid({ Date: todayStr })

    // Range collection (optional)
    let rangeCollected = 0
    if (fromDate && toDate) {
      // Since Date is stored as locale string, do simple $in over computed list if range is small.
      // For now, only support equal from/to → single day selection.
      if (fromDate === toDate) {
        rangeCollected = await sumPaid({ Date: fromDate })
      }
    }

    const allStudents = await studentModel
      .find({ InstutionCode: instutionId })
      .select('OutstandingAmount Class Section Registration_Number Status')
      .lean()

    // Current calendar month: monthly fee expected minus collected (monthly heads only)
    const monthParam =
      String(req.query.month || req.query.Month || '').trim() ||
      `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`

    const scope = await resolveAcademicYearScope(req)
    const academicYearName = scope?.yearDoc?.Year_Name || ''

    const activeStudents = allStudents.filter(
      (s) =>
        s.Status === true &&
        String(s.InstutionCode || instutionId).trim() === instutionId &&
        String(s.Registration_Number || '').trim()
    )
    const schoolRegs = new Set(
      activeStudents.map((s) => String(s.Registration_Number || '').trim()).filter(Boolean)
    )
    const structures = await feeStructureModel.find({ InstutionId: instutionId }).lean()
    const tenantStructures = structures.filter(
      (fs) => String(fs.InstutionId || '').trim() === instutionId
    )
    const studentByReg = new Map(
      activeStudents.map((s) => [String(s.Registration_Number || '').trim(), s])
    )

    const paymentFilter = {
      InstutionId: instutionId,
      ...(schoolRegs.size ? { StudentId: { $in: [...schoolRegs] } } : { StudentId: '__none__' }),
      $or: [
        { Status: 'Success' },
        { PaymentMode: 'SYSTEM', FeeType: 'Monthly' },
      ],
    }
    const scopedPayments = schoolRegs.size
      ? await feePaymentModel
          .find(paymentFilter)
          .select(
            'StudentId Class PaidAmount VerificationStatus Status Month AcademicYear TutionFee LibraryFee ActivityFee ExamFee UniformFee ProspectusFee TransportFee OtherFee PaymentMode FeeType SelectedFeeHeads IsAdvancePayment ScholarshipAmount ConcessionAmount AdvanceMonthsCovered InstutionId'
          )
          .lean()
      : []

    const paymentsByStudent = new Map()
    scopedPayments.forEach((p) => {
      if (String(p.InstutionId || '').trim() !== instutionId) return
      const id = String(p.StudentId || '').trim()
      if (!id || !schoolRegs.has(id)) return
      if (!paymentsByStudent.has(id)) paymentsByStudent.set(id, [])
      paymentsByStudent.get(id).push(p)
    })

    const {
      currentMonthPending,
      currentMonthExpected,
      studentsWithCurrentMonthPending,
    } = computeInstitutionMonthlyPending({
      students: activeStudents,
      structures: tenantStructures,
      paymentsByStudent,
      month: monthParam,
      academicYear: academicYearName,
    })

    const { totalPayable, studentsWithDue } = sumStudentsPayable({
      students: activeStudents,
      structures: tenantStructures,
      paymentsByStudent,
      month: monthParam,
      academicYear: academicYearName,
    })
    // This logged-in school only (never other institutions)
    const totalPending = totalPayable

    let currentMonthCollected = 0
    scopedPayments
      .filter(
        (p) =>
          paymentCountsAsPaid(p) && String(p.Month || '') === monthParam
      )
      .forEach((p) => {
        const stu = studentByReg.get(String(p.StudentId || '').trim())
        const structure = stu
          ? findFeeStructureFromList(tenantStructures, stu.Class, stu.Section || '')
          : findFeeStructureFromList(tenantStructures, p.Class, '')
        if (structure) {
          currentMonthCollected += sumHeadsByFrequencyOnPayment(p, structure, 'monthly')
        } else {
          currentMonthCollected += toAmount(p.PaidAmount)
        }
      })

    const responseData = {
      totalCollected,
      todayCollected,
      rangeCollected,
      totalPending,
      totalScholarship,
      totalConcession,
      currentMonth: monthParam,
      currentMonthPending,
      currentMonthExpected,
      currentMonthCollected,
      studentsWithCurrentMonthPending,
      studentsWithDue,
      calculatedAt: new Date().toISOString(),
    }

    // If className is provided, compute class-specific stats
    if (className) {
      const classMatch = { Class: className }
      const classCollected = await sumPaid(classMatch)
      const classTodayCollected = await sumPaid({ ...classMatch, Date: todayStr })
      const classTotalConcession = await sumConcession(classMatch)
      const classTotalScholarship = await sumScholarship(classMatch)

      let classRangeCollected = 0
      if (fromDate && toDate && fromDate === toDate) {
        classRangeCollected = await sumPaid({ ...classMatch, Date: fromDate })
      }

      const classStudents = activeStudents.filter((s) => s.Class === className)
      const { totalPayable: classPending } = sumStudentsPayable({
        students: classStudents,
        structures: tenantStructures,
        paymentsByStudent,
        month: monthParam,
        academicYear: academicYearName,
      })

      const classTotalDue = classCollected + classPending
      const collectionRate =
        classTotalDue > 0 ? Math.round((classCollected / classTotalDue) * 100) : 0

      responseData.forClass = {
        className,
        totalCollected: classCollected,
        todayCollected: classTodayCollected,
        rangeCollected: classRangeCollected,
        totalPending: classPending,
        totalConcession: classTotalConcession,
        totalScholarship: classTotalScholarship,
        collectionRate,
      }
    }

    res.set({
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      Pragma: 'no-cache',
      Expires: '0',
    })
    res.status(200).json({
      success: true,
      code: 200,
      message: 'Fee analytics summary fetched successfully',
      data: responseData,
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
      code: 500,
    })
  }
}

// Class-wise pending and paid list
const getClassPendingList = async (req, res, next) => {
  try {
    const instutionId = requireTenantInstitution(req, res)
    if (!instutionId) return

    const { class: className, section } = req.query
    if (!className) {
      return res.status(400).json({
        success: false,
        code: 400,
        message: 'Class is required',
      })
    }

    const studentFilter = {
      InstutionCode: instutionId,
      Class: className,
    }
    if (section) {
      studentFilter.Section = section
    }

    studentFilter.Status = true

    const students = await studentModel
      .find(studentFilter)
      .select('First_Name Last_Name Registration_Number Class Section OutstandingAmount')

    if (!students.length) {
      return res.status(200).json({
        success: true,
        code: 200,
        message: 'No students found for this class/section',
        data: [],
      })
    }

    const registrations = students.map((s) => s.Registration_Number)
    const monthKey = currentMonthKey()
    const scope = await resolveAcademicYearScope(req)
    const academicYearName = scope?.yearDoc?.Year_Name || ''
    const [paymentsAgg, studentPayments, structures] = await Promise.all([
      feePaymentModel.aggregate([
        {
          $match: {
            InstutionId: instutionId,
            StudentId: { $in: registrations },
            Status: 'Success',
          },
        },
        {
          $group: {
            _id: '$StudentId',
            totalPaid: { $sum: { $toDouble: { $ifNull: ['$PaidAmount', '0'] } } },
          },
        },
      ]),
      feePaymentModel
        .find({
          InstutionId: instutionId,
          StudentId: { $in: registrations },
          $or: [
            { Status: 'Success' },
            { PaymentMode: 'SYSTEM', FeeType: 'Monthly' },
          ],
        })
        .lean(),
      feeStructureModel.find({ InstutionId: instutionId }).lean(),
    ])

    const paidMap = new Map()
    paymentsAgg.forEach((p) => {
      paidMap.set(String(p._id || '').trim(), p.totalPaid)
    })
    const paymentsByStudent = new Map()
    studentPayments.forEach((p) => {
      const id = String(p.StudentId || '').trim()
      if (!id) return
      if (!paymentsByStudent.has(id)) paymentsByStudent.set(id, [])
      paymentsByStudent.get(id).push(p)
    })

    const result = students.map((s) => {
      const reg = String(s.Registration_Number || '').trim()
      const totalPaid = paidMap.get(reg) || paidMap.get(s.Registration_Number) || 0
      const structure = findFeeStructureFromList(structures, s.Class, s.Section || '')
      const studentPays = paymentsByStudent.get(reg) || []
      const pending = computeStudentTotalPayable(structure, studentPays, {
        month: monthKey,
        academicYear: academicYearName,
        storedOutstanding: s.OutstandingAmount,
      }).outstanding
      return {
        studentId: s.Registration_Number,
        name: `${s.First_Name || ''} ${s.Last_Name || ''}`.trim(),
        class: s.Class,
        section: s.Section || '',
        totalPaid,
        pending,
      }
    })

    res.status(200).json({
      success: true,
      code: 200,
      message: 'Class pending list fetched successfully',
      data: result,
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
      code: 500,
    })
  }
}

/**
 * Fee heads, due amounts, and defaults for fee collection UI (multi-select).
 */
const getStudentFeeDue = async (req, res) => {
  try {
    const instutionId = requireTenantInstitution(req, res)
    if (!instutionId) return

    const permissionsResult = await getPermissionSet(req)
    if (!feePaymentReadAllowed(permissionsResult)) {
      return res.status(403).json({
        success: false,
        code: 403,
        message: 'You do not have permission to view fee details',
      })
    }

    const StudentId = String(req.query.StudentId || req.query.studentId || '').trim()
    const Class = String(req.query.Class || '').trim()
    const Section = String(req.query.Section || '').trim()
    const Month =
      String(req.query.Month || '').trim() ||
      `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`

    if (!StudentId || !Class) {
      return res.status(400).json({
        success: false,
        code: 400,
        message: 'StudentId and Class are required',
      })
    }

    const scope = await resolveAcademicYearScope(req)
    const academicYearName = scope?.yearDoc?.Year_Name || req.query.AcademicYear || ''

    const structure = await findFeeStructure(feeStructureModel, instutionId, Class, Section)
    if (!structure) {
      return res.status(200).json({
        success: true,
        code: 200,
        message: 'No fee structure found for this class',
        data: {
          heads: [],
          monthlyDue: 0,
          yearlyDue: 0,
          currentMonthFee: 0,
          currentPeriodDue: 0,
          defaultSelectedKeys: [],
          monthlyTotal: 0,
          yearlyTotal: 0,
        },
      })
    }

    const payments = await feePaymentModel
      .find({
        InstutionId: instutionId,
        StudentId,
        ...(scope ? { createdAt: { $gte: scope.from, $lte: scope.to } } : {}),
      })
      .lean()

    const dueContext = computeDueContext({
      structure,
      payments,
      month: Month,
      academicYear: academicYearName,
    })

    const student = await studentModel
      .findOne({ InstutionCode: instutionId, Registration_Number: StudentId })
      .select('OutstandingAmount')
      .lean()

    const payable = computeStudentTotalPayable(structure, payments, {
      month: Month,
      academicYear: academicYearName,
      storedOutstanding: student?.OutstandingAmount,
    })
    const previousBalance = Math.max(0, payable.outstanding - payable.currentMonthDue)

    const pendingHead = buildPendingFeeHead(previousBalance)
    const headsWithPending = pendingHead
      ? [...dueContext.heads, pendingHead]
      : dueContext.heads

    return res.status(200).json({
      success: true,
      code: 200,
      message: 'Student fee due details fetched successfully',
      data: {
        ...dueContext,
        heads: headsWithPending,
        previousOutstanding: previousBalance,
        previousMonthlyPending: previousBalance,
        outstandingAmount: payable.outstanding,
        currentMonthDue: payable.currentMonthDue,
        month: Month,
        academicYear: academicYearName,
      },
    })
  } catch (error) {
    return res.status(500).json({
      success: false,
      code: 500,
      message: error.message,
    })
  }
}

// Student-wise fee summary and history
const getStudentSummary = async (req, res, next) => {
  try {
    const instutionId = req.user?.InstutionCode
    if (!instutionId) {
      return res.status(401).json({
        success: false,
        code: 401,
        message: 'Institution context not found',
      })
    }

    const resolved = resolveOwnStudentRegistration(req, req.query.studentId)
    if (resolved.error) {
      return res.status(resolved.error.status).json({
        success: false,
        code: resolved.error.status,
        message: resolved.error.message,
      })
    }
    const studentId = resolved.registrationNumber

    if (!studentId) {
      return res.status(400).json({
        success: false,
        code: 400,
        message: 'studentId is required',
      })
    }

    const student = await studentModel.findOne({
      InstutionCode: instutionId,
      Registration_Number: studentId,
    })

    if (!student) {
      return res.status(404).json({
        success: false,
        code: 404,
        message: 'Student not found',
      })
    }

    const payments = await feePaymentModel
      .find({
        InstutionId: instutionId,
        StudentId: studentId,
      })
      .sort({ createdAt: -1 })

    const countsTowardPaid = (p) =>
      p.Status === 'Success' &&
      (!p.VerificationStatus ||
        p.VerificationStatus === '' ||
        p.VerificationStatus === 'Approved')

    let totalPaid = 0
    let pendingVerificationTotal = 0
    payments.forEach((p) => {
      if (countsTowardPaid(p)) {
        totalPaid += toAmount(p.PaidAmount)
      }
      if (p.VerificationStatus === 'Pending' && p.StudentSubmittedPayment) {
        pendingVerificationTotal += toAmount(p.PaidAmount)
      }
    })
    const structure = await findFeeStructure(
      feeStructureModel,
      instutionId,
      student.Class,
      student.Section || ''
    )
    const monthKey = currentMonthKey()
    const outstandingBreakdown = structure
      ? computeStudentTotalPayable(structure, payments, {
          month: monthKey,
          storedOutstanding: student.OutstandingAmount,
        })
      : { outstanding: toAmount(student.OutstandingAmount), currentMonthDue: 0 }
    const pending = outstandingBreakdown.outstanding
    const currentMonthPending = structure
      ? computeDueContext({
          structure,
          payments,
          month: monthKey,
        }).monthlyDue
      : 0

    res.status(200).json({
      success: true,
      code: 200,
      message: 'Student fee summary fetched successfully',
      data: {
        student: {
          id: student.Registration_Number,
          name: `${student.First_Name || ''} ${student.Last_Name || ''}`.trim(),
          class: student.Class,
          section: student.Section || '',
        },
        summary: {
          totalPaid,
          pending,
          currentMonthPending,
          pendingVerificationTotal,
        },
        payments,
      },
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
      code: 500,
    })
  }
}

/**
 * Record one-time admission fee for an applicant (no student record yet).
 * Updates admission AdmissionFeeStatus to Received.
 */
const storeAdmissionFee = async (req, res) => {
  try {
    const instutionId = req.user?.InstutionCode
    if (!instutionId) {
      return res.status(400).json({
        success: false,
        code: 400,
        message: 'Institution context required',
      })
    }

    const {
      admissionId,
      PaidAmount,
      PaymentMode,
      PaymentReference,
    } = req.body

    if (!admissionId) {
      return res.status(400).json({
        success: false,
        code: 400,
        message: 'admissionId is required',
      })
    }

    const paid = toAmount(PaidAmount)
    if (paid <= 0) {
      return res.status(400).json({
        success: false,
        code: 400,
        message: 'Paid amount must be greater than zero',
      })
    }

    if (!PaymentMode) {
      return res.status(400).json({
        success: false,
        code: 400,
        message: 'PaymentMode is required',
      })
    }

    const admission = await admissionModel.findById(admissionId)
    if (!admission || admission.InstutionCode !== instutionId) {
      return res.status(404).json({
        success: false,
        code: 404,
        message: 'Admission record not found',
      })
    }

    if (admission.IsConvertedToStudent) {
      return res.status(400).json({
        success: false,
        code: 400,
        message: 'This admission is already converted; use regular fee payment for the student.',
      })
    }

    if (admission.AdmissionFeeStatus === 'Received') {
      return res.status(400).json({
        success: false,
        code: 400,
        message: 'Admission fee has already been recorded for this application.',
      })
    }

    const feeStageOk =
      admission.Status === 'Payment Pending' ||
      admission.Status === 'Fee Payment Pending' ||
      (admission.Status === 'Approved' && (admission.AdmissionFeeStatus || 'Pending') !== 'Received')

    if (!feeStageOk) {
      return res.status(400).json({
        success: false,
        code: 400,
        message:
          'Admission fee can be recorded only after documents are verified (status must be Payment Pending).',
      })
    }

    const className = (admission.Class_Name || '').trim()
    let structure = await feeStructureModel
      .findOne({
        InstutionId: instutionId,
        Class: className,
        Section: '',
      })
      .lean()

    if (!structure) {
      structure = await feeStructureModel
        .findOne({
          InstutionId: instutionId,
          Class: className,
        })
        .lean()
    }

    const expectedAdmission = structure ? toAmount(structure.AdmissionFee) : 0
    if (expectedAdmission > 0 && paid < expectedAdmission - 0.01) {
      return res.status(400).json({
        success: false,
        code: 400,
        message: `Paid amount must be at least the configured admission fee (₹${expectedAdmission}).`,
      })
    }

    const scope = await resolveAcademicYearScope(req)
    const academicYearName = scope?.yearDoc?.Year_Name || ''

    const currentDate = new Date()
    const date = currentDate.toLocaleDateString()
    const time = currentDate.toLocaleTimeString()

    const provisionalStudentId =
      admission.Registration_Number && String(admission.Registration_Number).trim()
        ? String(admission.Registration_Number).trim()
        : `ADM-${admission._id}`

    const feeRow = new feePaymentModel({
      InstutionId: instutionId,
      StudentId: provisionalStudentId,
      AdmissionMongoId: admission._id.toString(),
      StudentName: admission.Student_Name || '',
      Class: className,
      TutionFee: '0',
      LibraryFee: '0',
      ActivityFee: '0',
      ExamFee: '0',
      UniformFee: '0',
      ProspectusFee: '0',
      TransportFee: '0',
      OtherFee: '0',
      PaidAmount: paid.toString(),
      PendingAmount: '0',
      ScholarshipAmount: '0',
      ConcessionAmount: '0',
      Month: '',
      AcademicYear: academicYearName,
      FeeType: 'Admission',
      PaymentMode,
      PaymentReference: PaymentReference || '',
      Date: date,
      Time: time,
      Status: 'Success',
      CollectionStatus: collectionStatusForUser(req.user),
      CollectedByUserType: String(req.user?.UserType || ''),
    })

    await feeRow.save()

    admission.AdmissionFeeStatus = 'Received'
    admission.AdmissionFeePaidAt = new Date()
    admission.AdmissionFeePaymentRecordId = feeRow._id.toString()
    admission.Status = 'Payment Done'
    await admission.save()

    res.status(201).json({
      code: 201,
      success: true,
      message: 'Admission fee recorded successfully.',
      data: {
        payment: feeRow,
        admission,
      },
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
      code: 500,
    })
  }
}

/**
 * Student submits UPI / QR / online bank payment for staff verification (does not reduce outstanding until approved).
 */
const studentSubmitPayment = async (req, res) => {
  try {
    const userType = String(req.user?.UserType || '').trim()
    if (userType !== 'Student') {
      return res.status(403).json({
        success: false,
        code: 403,
        message: 'Only student accounts can submit payments through this flow.',
      })
    }

    const resolved = resolveOwnStudentRegistration(req, req.body.StudentId)
    if (resolved.error) {
      return res.status(resolved.error.status).json({
        success: false,
        code: resolved.error.status,
        message: resolved.error.message,
      })
    }
    const registrationNumber = resolved.registrationNumber
    const instutionId = req.user.InstutionCode

    const PaidAmountRaw = req.body.PaidAmount ?? req.body.paidAmount
    const paid = toAmount(PaidAmountRaw)
    if (paid <= 0) {
      return res.status(400).json({
        success: false,
        code: 400,
        message: 'Paid amount must be greater than zero',
      })
    }

    const PaymentMode = String(req.body.PaymentMode || '').trim()
    const allowedModes = ['QR', 'OnlineBankTransfer', 'NetBanking', 'Card']
    if (!allowedModes.includes(PaymentMode)) {
      return res.status(400).json({
        success: false,
        code: 400,
        message: `PaymentMode must be one of: ${allowedModes.join(', ')}`,
      })
    }

    const PaymentReference = String(req.body.PaymentReference || '').trim()
    if (!PaymentReference) {
      return res.status(400).json({
        success: false,
        code: 400,
        message: 'Payment reference or UPI transaction ID is required',
      })
    }

    const student = await studentModel.findOne({
      InstutionCode: instutionId,
      Registration_Number: registrationNumber,
    })
    if (!student) {
      return res.status(404).json({
        success: false,
        code: 404,
        message: 'Student not found',
      })
    }

    const scope = await resolveAcademicYearScope(req)
    const academicYearName = scope?.yearDoc?.Year_Name || req.body.AcademicYear || ''

    const Class = student.Class || req.body.Class || ''
    if (!Class) {
      return res.status(400).json({
        success: false,
        code: 400,
        message: 'Student class is missing; contact the school to update your profile.',
      })
    }

    let baseStructure = await feeStructureModel.findOne({
      InstutionId: instutionId,
      Class: Class,
    })
    if (student.Section) {
      const bySection = await feeStructureModel.findOne({
        InstutionId: instutionId,
        Class: Class,
        Section: student.Section,
      })
      if (bySection) baseStructure = bySection
    }

    const baseTution = baseStructure ? toAmount(baseStructure.TutionFee) : 0
    const baseLibrary = baseStructure ? toAmount(baseStructure.LibraryFee) : 0
    const baseActivity = baseStructure ? toAmount(baseStructure.ActivityFee) : 0
    const baseExam = baseStructure ? toAmount(baseStructure.ExamFee) : 0
    const baseUniform = baseStructure ? toAmount(baseStructure.UniformFee) : 0
    const baseProspectus = baseStructure ? toAmount(baseStructure.ProspectusFee) : 0
    const baseTransport = baseStructure ? toAmount(baseStructure.TransportFee) : 0
    const baseOther = baseStructure ? getHeadAmount(baseStructure, 'OtherFee') : 0

    const currentDate = new Date()
    const date = currentDate.toLocaleDateString()
    const time = currentDate.toLocaleTimeString()
    const FeeType = String(req.body.FeeType || 'Fee payment').trim()
    const Month = String(req.body.Month || '').trim()

    let proofKey = ''
    let proofUrl = ''
    if (req.file && req.file.buffer) {
      const rawExt = path.extname(req.file.originalname || '')
      const safeExt =
        rawExt && rawExt.length <= 10 && /^\.[a-zA-Z0-9.]+$/.test(rawExt)
          ? rawExt.toLowerCase()
          : '.jpg'
      const stem = path.basename(req.file.originalname || `proof${safeExt}`, rawExt || safeExt)
      const safeStem = sanitizeProofNamePart(stem, 100)
      const safeInst = sanitizeProofNamePart(instutionId, 60)
      const safeReg = sanitizeProofNamePart(registrationNumber, 60)
      // S3 object basename: InstitutionCode_StudentRegistrationNumber_<originalStem>_<ms>.ext (unique, matches naming request)
      const objectBase = `${safeInst}_${safeReg}_${safeStem}_${Date.now()}${safeExt}`
      const key = `${instutionId}/FeePaymentProof/${objectBase}`
      const uploaded = await uploadFeeProofToS3(req.file.buffer, key, req.file.mimetype)
      proofKey = uploaded.Key
      proofUrl = uploaded.Location || ''
    }

    const priorPayments = await feePaymentModel
      .find({
        InstutionId: instutionId,
        StudentId: registrationNumber,
        ...(scope ? { createdAt: { $gte: scope.from, $lte: scope.to } } : {}),
      })
      .lean()

    const monthKey =
      Month ||
      `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`
    const dueContext = computeDueContext({
      structure: baseStructure,
      payments: priorPayments,
      month: monthKey,
      academicYear: academicYearName,
    })
    const previousBalance = getPreviousMonthlyPending(priorPayments, {
      structure: baseStructure,
      fallback: toAmount(student.OutstandingAmount),
      currentMonthDue: dueContext.monthlyDue,
      month: monthKey,
    })

    const feePatment = new feePaymentModel({
      InstutionId: instutionId,
      StudentId: registrationNumber,
      StudentName: `${student.First_Name || ''} ${student.Last_Name || ''}`.trim(),
      Class,
      TutionFee: baseTution.toString(),
      LibraryFee: baseLibrary.toString(),
      ActivityFee: baseActivity.toString(),
      ExamFee: baseExam.toString(),
      UniformFee: baseUniform.toString(),
      ProspectusFee: baseProspectus.toString(),
      TransportFee: baseTransport.toString(),
      OtherFee: baseOther.toString(),
      PaidAmount: paid.toString(),
      PendingAmount: previousBalance.toString(),
      ScholarshipAmount: '0',
      ConcessionAmount: '0',
      Month,
      AcademicYear: academicYearName,
      FeeType,
      PaymentMode,
      PaymentReference,
      Date: date,
      Time: time,
      Status: 'Pending',
      CollectionStatus: 'Partial',
      CollectedByUserType: String(req.user?.UserType || 'Student'),
      VerificationStatus: 'Pending',
      StudentSubmittedPayment: true,
      SelectedFeeHeads: resolveSelectedHeadKeys(
        { SelectedFeeHeads: req.body.SelectedFeeHeads, FeeType },
        baseStructure
      ),
      ProofImageKey: proofKey,
      ProofImageUrl: proofUrl,
    })

    await feePatment.save()

    return res.status(201).json({
      code: 201,
      success: true,
      message:
        'Payment submitted for verification. Your outstanding balance will update after the school approves this payment.',
      data: feePatment,
    })
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
      code: 500,
    })
  }
}

const listPendingStudentPayments = async (req, res) => {
  try {
    const permissionsResult = await getPermissionSet(req)
    if (!feePaymentReadAllowed(permissionsResult)) {
      return res.status(403).json({
        success: false,
        code: 403,
        message:
          'You do not have permission to view fee payments. Please contact your administrator.',
      })
    }

    const instutionId = req.user?.InstutionCode
    if (!instutionId) {
      return res.status(401).json({
        success: false,
        code: 401,
        message: 'Institution context not found',
      })
    }

    const rows = await feePaymentModel
      .find({
        InstutionId: instutionId,
        VerificationStatus: 'Pending',
        StudentSubmittedPayment: true,
      })
      .sort({ createdAt: -1 })
      .lean()

    await attachProofSignedUrls(rows)

    return res.status(200).json({
      success: true,
      code: 200,
      message: 'Pending student payments retrieved successfully',
      data: rows,
    })
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
      code: 500,
    })
  }
}

const verifyStudentPayment = async (req, res) => {
  try {
    const permissionsResult = await getPermissionSet(req)
    if (!feePaymentWriteAllowed(permissionsResult)) {
      return res.status(403).json({
        success: false,
        code: 403,
        message:
          'You do not have permission to verify fee payments. Please contact your administrator.',
      })
    }

    const instutionId = req.user?.InstutionCode
    if (!instutionId) {
      return res.status(401).json({
        success: false,
        code: 401,
        message: 'Institution context not found',
      })
    }

    const { paymentId, action, rejectionReason } = req.body
    if (!paymentId) {
      return res.status(400).json({
        success: false,
        code: 400,
        message: 'paymentId is required',
      })
    }

    const act = String(action || '').toLowerCase()
    if (act !== 'approve' && act !== 'reject') {
      return res.status(400).json({
        success: false,
        code: 400,
        message: 'action must be approve or reject',
      })
    }

    const payment = await feePaymentModel.findOne({
      _id: paymentId,
      InstutionId: instutionId,
    })
    if (!payment) {
      return res.status(404).json({
        success: false,
        code: 404,
        message: 'Payment record not found',
      })
    }

    if (payment.VerificationStatus !== 'Pending' || !payment.StudentSubmittedPayment) {
      return res.status(400).json({
        success: false,
        code: 400,
        message: 'This payment is not awaiting verification',
      })
    }

    const verifierName = `${req.user.FirstName || ''} ${req.user.LastName || ''}`.trim()

    if (act === 'reject') {
      payment.VerificationStatus = 'Rejected'
      payment.Status = 'Failed'
      payment.RejectionReason = String(rejectionReason || '').trim()
      payment.VerifiedAt = new Date()
      payment.VerifiedByName = verifierName
      payment.VerifiedByMemberId = String(req.user.MemberId || '')
      await payment.save()
      return res.status(200).json({
        success: true,
        code: 200,
        message: 'Payment rejected',
        data: payment,
      })
    }

    const student = await studentModel.findOne({
      InstutionCode: instutionId,
      Registration_Number: payment.StudentId,
    })
    if (!student) {
      return res.status(404).json({
        success: false,
        code: 404,
        message: 'Student not found for this payment',
      })
    }

    const paid = toAmount(payment.PaidAmount)
    const scope = await resolveAcademicYearScope(req)
    const academicYearName = scope?.yearDoc?.Year_Name || payment.AcademicYear || ''

    const priorPayments = await feePaymentModel
      .find({
        InstutionId: instutionId,
        StudentId: payment.StudentId,
        ...(scope ? { createdAt: { $gte: scope.from, $lte: scope.to } } : {}),
      })
      .lean()

    const sectionName = String(student.Section || payment.Class || '').trim()
    const baseStructure = await findFeeStructure(
      feeStructureModel,
      instutionId,
      payment.Class,
      sectionName
    )

    const monthKey =
      String(payment.Month || '').trim() ||
      `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`
    payment.AcademicYear = payment.AcademicYear || academicYearName
    payment.Status = 'Success'
    payment.CollectionStatus = collectionStatusForUser(req.user)
    payment.CollectedByUserType = String(req.user?.UserType || payment.CollectedByUserType || '')
    payment.VerificationStatus = 'Approved'

    const paymentsAfterApprove = priorPayments.map((p) =>
      String(p._id) === String(payment._id)
        ? {
            ...p,
            Status: 'Success',
            VerificationStatus: 'Approved',
            SelectedFeeHeads: payment.SelectedFeeHeads,
            PaidAmount: payment.PaidAmount,
          }
        : p
    )
    const hasSystemCurrent = paymentsAfterApprove.some((p) =>
      isSystemMonthlyGeneration(p, monthKey)
    )
    const selectedKeys = Array.isArray(payment.SelectedFeeHeads) ? payment.SelectedFeeHeads : []
    const yearlyOnThis = baseStructure
      ? sumHeadsByFrequencyOnPayment(payment, baseStructure, 'yearly')
      : 0
    const nextOutstanding = applyPaymentToStudentOutstanding({
      storedOutstanding: student.OutstandingAmount,
      paid: toAmount(payment.PaidAmount),
      scholarship: toAmount(payment.ScholarshipAmount),
      concession: toAmount(payment.ConcessionAmount),
      yearlyAmount: yearlyOnThis,
      currentMonthAlreadyInStored: hasSystemCurrent,
      includesPending: selectedKeys.includes(PENDING_FEE_KEY),
    })
    const payableAfter = computeStudentTotalPayable(baseStructure, paymentsAfterApprove, {
      month: monthKey,
      academicYear: academicYearName,
      storedOutstanding: nextOutstanding,
    })
    student.OutstandingAmount = String(payableAfter.outstanding)
    await student.save()

    payment.PendingAmount = String(payableAfter.outstanding)
    payment.VerifiedAt = new Date()
    payment.VerifiedByName = verifierName
    payment.VerifiedByMemberId = String(req.user.MemberId || '')
    payment.RejectionReason = ''
    await payment.save()

    return res.status(200).json({
      success: true,
      code: 200,
      message: 'Payment approved and student outstanding updated',
      data: payment,
    })
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
      code: 500,
    })
  }
}

/** Manual trigger: generate current month fees for all active students in this institution */
const generateMonthlyFees = async (req, res) => {
  try {
    const instutionId = req.user?.InstutionCode
    if (!instutionId) {
      return res.status(401).json({
        success: false,
        code: 401,
        message: 'Institution context not found',
      })
    }

    const permissionsResult = await getPermissionSet(req)
    if (!feePaymentWriteAllowed(permissionsResult)) {
      return res.status(403).json({
        success: false,
        code: 403,
        message: 'You do not have permission to generate monthly fees',
      })
    }

    const result = await generateMonthlyFeesForInstitution(instutionId)

    if (result.alreadyGenerated) {
      return res.status(200).json({
        success: true,
        code: 200,
        message: `Monthly fees for ${result.month} were already generated for this school.`,
        data: result,
      })
    }

    let message = `Generated ${result.month} monthly fees for ${result.generatedCount} student(s).`
    if (result.skippedCount > 0) {
      message += ` ${result.skippedCount} skipped (no class/structure or zero monthly fee).`
    }
    if (result.errorCount > 0) {
      message += ` ${result.errorCount} error(s) — check logs.`
    }

    return res.status(200).json({
      success: true,
      code: 200,
      message,
      data: result,
    })
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
      code: 500,
    })
  }
}

/** Preview advance fee allocation (by months or custom amount). */
const getAdvanceFeeQuote = async (req, res) => {
  try {
    const instutionId = req.user?.InstutionCode
    if (!instutionId) {
      return res.status(401).json({
        success: false,
        code: 401,
        message: 'Institution context not found',
      })
    }

    const permissionsResult = await getPermissionSet(req)
    if (!feePaymentReadAllowed(permissionsResult)) {
      return res.status(403).json({
        success: false,
        code: 403,
        message: 'You do not have permission to view fee details',
      })
    }

    const StudentId = String(req.query.StudentId || '').trim()
    const Class = String(req.query.Class || '').trim()
    const Section = String(req.query.Section || '').trim()
    if (!StudentId || !Class) {
      return res.status(400).json({
        success: false,
        code: 400,
        message: 'StudentId and Class are required',
      })
    }

    const mode = String(req.query.mode || 'months').trim() === 'amount' ? 'amount' : 'months'
    const monthsCount = Math.max(1, Math.min(24, toAmount(req.query.monthsCount) || 1))
    const customAmount = toAmount(req.query.customAmount)
    const startMonth =
      String(req.query.startMonth || '').trim() ||
      `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`

    const scope = await resolveAcademicYearScope(req)
    const academicYearName = scope?.yearDoc?.Year_Name || req.query.AcademicYear || ''

    const structure = await findFeeStructure(feeStructureModel, instutionId, Class, Section)
    if (!structure) {
      return res.status(200).json({
        success: true,
        code: 200,
        message: 'No fee structure for this class',
        data: { quote: null },
      })
    }

    const student = await studentModel
      .findOne({ InstutionCode: instutionId, Registration_Number: StudentId })
      .select('AdvanceFeeCredit OutstandingAmount First_Name Last_Name')
      .lean()

    const payments = await feePaymentModel
      .find({
        InstutionId: instutionId,
        StudentId,
        ...(scope ? { createdAt: { $gte: scope.from, $lte: scope.to } } : {}),
      })
      .lean()

    const quote = buildAdvanceQuote({
      structure,
      payments,
      academicYear: academicYearName,
      mode,
      monthsCount,
      customAmount,
      startMonth,
      creditBalance: toAmount(student?.AdvanceFeeCredit),
    })

    return res.status(200).json({
      success: true,
      code: 200,
      message: 'Advance fee quote calculated',
      data: {
        quote,
        studentName: student
          ? `${student.First_Name || ''} ${student.Last_Name || ''}`.trim()
          : '',
        outstandingAmount: toAmount(student?.OutstandingAmount),
      },
    })
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
      code: 500,
    })
  }
}

/** Collect advance / prepaid fee for upcoming months. */
const collectAdvanceFee = async (req, res) => {
  try {
    const instutionId = req.user?.InstutionCode || req.body.InstutionId
    const permissionsResult = await getPermissionSet(req)
    if (!feePaymentWriteAllowed(permissionsResult)) {
      return res.status(403).json({
        success: false,
        code: 403,
        message: 'You do not have permission to collect fees',
      })
    }

    const scope = await resolveAcademicYearScope(req)
    const academicYearName = scope?.yearDoc?.Year_Name || req.body.AcademicYear || ''
    const {
      StudentId,
      StudentName,
      Class,
      PaymentMode,
      PaymentReference,
      PaidAmount,
      mode,
      monthsCount,
      customAmount,
      startMonth,
    } = req.body

    if (!instutionId || !StudentId || !Class) {
      return res.status(400).json({
        success: false,
        code: 400,
        message: 'InstutionId, StudentId and Class are required',
      })
    }

    const paid = toAmount(PaidAmount)
    if (paid <= 0) {
      return res.status(400).json({
        success: false,
        code: 400,
        message: 'Paid amount must be greater than zero',
      })
    }

    const payMode = String(mode || 'months').trim() === 'amount' ? 'amount' : 'months'

    const student = await studentModel.findOne({
      InstutionCode: instutionId,
      Registration_Number: StudentId,
    })
    if (!student) {
      return res.status(404).json({
        success: false,
        code: 404,
        message: 'Student not found for this institution',
      })
    }

    const sectionName = String(req.body.Section || student.Section || '').trim()
    const structure = await findFeeStructure(feeStructureModel, instutionId, Class, sectionName)
    if (!structure) {
      return res.status(400).json({
        success: false,
        code: 400,
        message: 'No fee structure found for this class',
      })
    }

    const priorPayments = await feePaymentModel
      .find({
        InstutionId: instutionId,
        StudentId,
        ...(scope ? { createdAt: { $gte: scope.from, $lte: scope.to } } : {}),
      })
      .lean()

    const monthKey =
      String(startMonth || '').trim() ||
      `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`

    const quote = buildAdvanceQuote({
      structure,
      payments: priorPayments,
      academicYear: academicYearName,
      mode: payMode,
      monthsCount: toAmount(monthsCount) || 1,
      customAmount: toAmount(customAmount),
      startMonth: monthKey,
      creditBalance: toAmount(student.AdvanceFeeCredit),
    })

    if (!quote.months.length && quote.addedCredit <= 0) {
      return res.status(400).json({
        success: false,
        code: 400,
        message: 'No unpaid months available for advance collection with this selection',
      })
    }

    const expectedPaid =
      payMode === 'amount' ? toAmount(customAmount) || paid : quote.totalDue
    if (Math.abs(paid - expectedPaid) > 1) {
      return res.status(400).json({
        success: false,
        code: 400,
        message: `Paid amount must match the advance total (${expectedPaid})`,
      })
    }

    const monthsCovered = quote.months.map((m) => m.month)
    const monthlyHeads = buildHeadsFromStructure(structure).filter(
      (h) => h.frequency === 'monthly' && h.amount > 0
    )
    const monthlyHeadKeys = monthlyHeads.map((h) => h.key)

    const { amounts: singleMonthAmounts, otherFeeBreakdown: singleMonthOtherBreakdown } =
      amountsForSelectedHeads(structure, monthlyHeadKeys)
    const monthMultiplier = Math.max(1, quote.months.length)
    const amounts = { ...singleMonthAmounts }
    STANDARD_FEE_HEADS.forEach((head) => {
      amounts[head.key] = toAmount(singleMonthAmounts[head.key]) * monthMultiplier
    })
    amounts.OtherFee = toAmount(singleMonthAmounts.OtherFee) * monthMultiplier
    const advanceOtherBreakdown = (singleMonthOtherBreakdown || []).map((item) => ({
      ...item,
      amount: toAmount(item.amount) * monthMultiplier,
    }))

    const previousBalance = getPreviousMonthlyPending(priorPayments, {
      structure,
      fallback: toAmount(student.OutstandingAmount),
      currentMonthDue: 0,
      month: monthKey,
    })
    // Advance prepays future months only — monthly arrears stay unchanged.
    const remainingArrearsAfterAdvance = previousBalance

    const currentDate = new Date()
    const date = currentDate.toLocaleDateString()
    const time = currentDate.toLocaleTimeString()

    const feePatment = new feePaymentModel({
      InstutionId: instutionId,
      StudentId,
      StudentName: StudentName || `${student.First_Name || ''} ${student.Last_Name || ''}`.trim(),
      Class,
      TutionFee: String(amounts.TutionFee || 0),
      LibraryFee: String(amounts.LibraryFee || 0),
      ActivityFee: String(amounts.ActivityFee || 0),
      ExamFee: '0',
      UniformFee: '0',
      ProspectusFee: '0',
      TransportFee: String(amounts.TransportFee || 0),
      OtherFee: String(amounts.OtherFee || 0),
      OtherFeeBreakdown: serializeOtherFeeBreakdown(advanceOtherBreakdown),
      PaidAmount: paid.toString(),
      PendingAmount: remainingArrearsAfterAdvance.toString(),
      PreviousPendingAtPayment: previousBalance.toString(),
      ScholarshipAmount: '0',
      ConcessionAmount: '0',
      Month: monthsCovered[0] || monthKey,
      AcademicYear: academicYearName,
      FeeType: buildAdvanceFeeTypeLabel(monthsCovered),
      SelectedFeeHeads: monthlyHeadKeys,
      PaymentMode: PaymentMode || 'Advance',
      PaymentReference: PaymentReference || '',
      Date: date,
      Time: time,
      Status: 'Success',
      CollectionStatus: collectionStatusForUser(req.user),
      CollectedByUserType: String(req.user?.UserType || ''),
      IsAdvancePayment: true,
      AdvanceMonthsCovered: monthsCovered,
      AdvanceStartMonth: monthsCovered[0] || monthKey,
      AdvanceCreditRemaining: String(quote.addedCredit || 0),
    })

    await feePatment.save()

    student.AdvanceFeeCredit = String(quote.newCreditBalance || 0)
    await student.save()

    return res.status(201).json({
      code: 201,
      success: true,
      message: `Advance fee collected for ${quote.monthsCount} month(s)`,
      data: {
        payment: feePatment,
        quote,
      },
    })
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
      code: 500,
    })
  }
}

/** List all advance fee payments with enriched details for the admin UI. */
const listAdvanceFeeRecords = async (req, res) => {
  try {
    const instutionId = req.user?.InstutionCode
    if (!instutionId) {
      return res.status(401).json({
        success: false,
        code: 401,
        message: 'Institution context not found',
      })
    }

    const permissionsResult = await getPermissionSet(req)
    if (!feePaymentReadAllowed(permissionsResult)) {
      return res.status(403).json({
        success: false,
        code: 403,
        message: 'You do not have permission to view fee records',
      })
    }

    const scope = await resolveAcademicYearScope(req)
    const StudentId = String(req.query.StudentId || '').trim()
    const Class = String(req.query.Class || '').trim()
    const search = String(req.query.search || '').trim().toLowerCase()

    const query = {
      InstutionId: instutionId,
      IsAdvancePayment: true,
      Status: 'Success',
      ...(scope ? { createdAt: { $gte: scope.from, $lte: scope.to } } : {}),
    }
    if (StudentId) query.StudentId = StudentId
    if (Class) query.Class = Class

    let records = await feePaymentModel.find(query).sort({ createdAt: -1 }).lean()

    if (search) {
      records = records.filter((r) => {
        const hay = [
          r.StudentName,
          r.StudentId,
          r.Class,
          r.FeeType,
          r.PaymentReference,
          ...(Array.isArray(r.AdvanceMonthsCovered) ? r.AdvanceMonthsCovered : []),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        return hay.includes(search)
      })
    }

    const studentIds = [...new Set(records.map((r) => r.StudentId).filter(Boolean))]
    const students = studentIds.length
      ? await studentModel
          .find({ InstutionCode: instutionId, Registration_Number: { $in: studentIds } })
          .select('Registration_Number AdvanceFeeCredit First_Name Last_Name Class Section')
          .lean()
      : []
    const studentMap = new Map(students.map((s) => [s.Registration_Number, s]))

    const allAdvanceByStudent = new Map()
    records.forEach((r) => {
      const reg = r.StudentId
      if (!reg) return
      if (!allAdvanceByStudent.has(reg)) {
        allAdvanceByStudent.set(reg, new Set())
      }
      const set = allAdvanceByStudent.get(reg)
      ;(Array.isArray(r.AdvanceMonthsCovered) ? r.AdvanceMonthsCovered : []).forEach((m) => {
        const key = String(m || '').trim()
        if (key) set.add(key)
      })
    })

    const enriched = records.map((r) => {
      const months = (Array.isArray(r.AdvanceMonthsCovered) ? r.AdvanceMonthsCovered : [])
        .map((m) => String(m || '').trim())
        .filter(Boolean)
      const student = studentMap.get(r.StudentId)
      const paid = toAmount(r.PaidAmount)
      const creditAdded = toAmount(r.AdvanceCreditRemaining)
      const monthsCount = months.length
      const perMonthEstimate =
        monthsCount > 0 ? Math.round((paid - creditAdded) / monthsCount) : paid
      const remainingArrearsAfterAdvance = toAmount(r.PendingAmount)
      const previousPendingBalance =
        toAmount(r.PreviousPendingAtPayment) || remainingArrearsAfterAdvance

      return {
        _id: r._id,
        studentId: r.StudentId,
        studentName: r.StudentName || '',
        class: r.Class || '',
        section: student?.Section || '',
        feeType: r.FeeType || 'Advance Fee',
        paidAmount: paid,
        creditAdded,
        perMonthEstimate,
        monthsCount,
        monthsCovered: months,
        monthsCoveredLabels: months.map((m) => formatMonthLabel(m)),
        advanceStartMonth: r.AdvanceStartMonth || months[0] || '',
        advanceStartLabel: formatMonthLabel(r.AdvanceStartMonth || months[0] || ''),
        paymentMode: r.PaymentMode || '',
        paymentReference: r.PaymentReference || '',
        academicYear: r.AcademicYear || '',
        date: r.Date || '',
        time: r.Time || '',
        createdAt: r.createdAt,
        previousPendingBalance,
        pendingAfterAdvancePayment: remainingArrearsAfterAdvance,
        /** @deprecated use pendingAfterAdvancePayment — kept for older clients */
        pendingAfterPayment: remainingArrearsAfterAdvance,
        studentAdvanceCredit: toAmount(student?.AdvanceFeeCredit),
        allPrepaidMonthsForStudent: [...(allAdvanceByStudent.get(r.StudentId) || [])].sort(),
        headBreakdown: {
          tution: toAmount(r.TutionFee),
          library: toAmount(r.LibraryFee),
          activity: toAmount(r.ActivityFee),
          transport: toAmount(r.TransportFee),
          other: toAmount(r.OtherFee),
        },
        selectedFeeHeads: Array.isArray(r.SelectedFeeHeads) ? r.SelectedFeeHeads : [],
        raw: r,
      }
    })

    const summary = {
      totalRecords: enriched.length,
      totalCollected: enriched.reduce((sum, r) => sum + r.paidAmount, 0),
      totalMonthsPrepaid: enriched.reduce((sum, r) => sum + r.monthsCount, 0),
      totalCreditIssued: enriched.reduce((sum, r) => sum + r.creditAdded, 0),
      uniqueStudents: new Set(enriched.map((r) => r.studentId).filter(Boolean)).size,
    }

    return res.status(200).json({
      success: true,
      code: 200,
      message: 'Advance fee records fetched successfully',
      data: { records: enriched, summary },
    })
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
      code: 500,
    })
  }
}

/** Class-wise export payload for Fee Analytics Excel download */
const getClassFeeExportData = async (req, res) => {
  try {
    const instutionId = req.user?.InstutionCode
    if (!instutionId) {
      return res.status(401).json({
        success: false,
        code: 401,
        message: 'Institution context not found',
      })
    }

    const permissionsResult = await getPermissionSet(req)
    if (!feePaymentReadAllowed(permissionsResult)) {
      return res.status(403).json({
        success: false,
        code: 403,
        message: 'You do not have permission to export fee analytics',
      })
    }

    const className = String(req.query.class || req.query.Class || '').trim()
    if (!className) {
      return res.status(400).json({
        success: false,
        code: 400,
        message: 'Class is required for export',
      })
    }

    const section = String(req.query.section || req.query.Section || '').trim()
    const monthParam =
      String(req.query.month || req.query.Month || '').trim() || currentMonthKey()
    const { fromDate, toDate } = req.query

    const scope = await resolveAcademicYearScope(req)
    const academicYearName = scope?.yearDoc?.Year_Name || ''

    const studentFilter = {
      InstutionCode: instutionId,
      Class: className,
      Status: { $ne: false },
    }
    if (section) studentFilter.Section = section

    const students = await studentModel
      .find(studentFilter)
      .select(
        'First_Name Last_Name Registration_Number Class Section OutstandingAmount AdvanceFeeCredit'
      )
      .lean()

    const structures = await feeStructureModel.find({ InstutionId: instutionId }).lean()

    const paymentFilter = {
      InstutionId: instutionId,
      Class: className,
      ...(scope ? { createdAt: { $gte: scope.from, $lte: scope.to } } : {}),
    }

    let payments = await feePaymentModel.find(paymentFilter).sort({ createdAt: -1 }).lean()

    if (section) {
      const sectionRegs = new Set(
        students.map((s) => s.Registration_Number).filter(Boolean)
      )
      payments = payments.filter((p) => sectionRegs.has(String(p.StudentId || '')))
    }

    const paymentsByStudent = new Map()
    payments.forEach((p) => {
      const id = String(p.StudentId || '').trim()
      if (!id) return
      if (!paymentsByStudent.has(id)) paymentsByStudent.set(id, [])
      paymentsByStudent.get(id).push(p)
    })

    const dateFilteredPayments =
      fromDate && toDate && fromDate === toDate
        ? payments.filter((p) => String(p.Date || '') === String(fromDate))
        : payments

    let totalGenerated = 0
    let totalPaidMonthlyForMonth = 0
    const studentOutstandingRows = students.map((s) => {
      const reg = String(s.Registration_Number || '').trim()
      const studentPayments = paymentsByStudent.get(reg) || []
      const structure = findFeeStructureFromList(structures, s.Class, s.Section || '')
      const monthlyStructure = structure ? sumHeadsByFrequency(structure, 'monthly') : 0

      const feeGeneratedForMonth = studentPayments.some((p) =>
        isSystemMonthlyGeneration(p, monthParam)
      )
      const advanceCovered = isMonthAdvanceCovered(
        studentPayments.filter(paymentCountsAsPaid),
        monthParam
      )
      const generated =
        monthlyStructure > 0 && (feeGeneratedForMonth || advanceCovered) ? monthlyStructure : 0
      totalGenerated += generated

      let paidForMonth = 0
      studentPayments
        .filter(
          (p) =>
            paymentCountsAsPaid(p) &&
            !isSystemMonthlyGeneration(p) &&
            String(p.Month || '') === monthParam
        )
        .forEach((p) => {
          if (p.IsAdvancePayment) return
          paidForMonth += structure
            ? sumHeadsByFrequencyOnPayment(p, structure, 'monthly')
            : toAmount(p.PaidAmount)
        })
      totalPaidMonthlyForMonth += paidForMonth

      const totalPaidAllTime = studentPayments
        .filter((p) => paymentCountsAsPaid(p) && !isSystemMonthlyGeneration(p))
        .reduce((sum, p) => sum + toAmount(p.PaidAmount), 0)
      const outstanding = structure
        ? computeStudentTotalPayable(structure, studentPayments, {
            month: monthParam,
            academicYear: academicYearName,
            storedOutstanding: s.OutstandingAmount,
          }).outstanding
        : toAmount(s.OutstandingAmount)
      const advanceCredit = toAmount(s.AdvanceFeeCredit)

      return {
        registrationNumber: reg,
        studentName: `${s.First_Name || ''} ${s.Last_Name || ''}`.trim(),
        class: s.Class,
        section: s.Section || '',
        generatedForMonth: generated,
        paidForMonth,
        pendingForMonth: Math.max(generated - paidForMonth, 0),
        totalPaidAllTime,
        outstanding,
        advanceCredit,
      }
    })

    const totalPaidAll = payments
      .filter((p) => paymentCountsAsPaid(p) && !isSystemMonthlyGeneration(p))
      .reduce((sum, p) => sum + toAmount(p.PaidAmount), 0)

    const totalOutstanding = studentOutstandingRows.reduce((sum, r) => sum + r.outstanding, 0)

    const feePaymentRows = dateFilteredPayments
      .filter((p) => paymentCountsAsPaid(p) && !isSystemMonthlyGeneration(p))
      .map((p) => ({
        date: p.Date || '',
        time: p.Time || '',
        studentName: p.StudentName || '',
        registrationNumber: p.StudentId || '',
        class: p.Class || '',
        month: p.Month || '',
        academicYear: p.AcademicYear || '',
        feeType: p.FeeType || '',
        paidAmount: toAmount(p.PaidAmount),
        outstandingAfter: toAmount(p.PendingAmount),
        isAdvancePayment: Boolean(p.IsAdvancePayment),
        advanceMonths: Array.isArray(p.AdvanceMonthsCovered) ? p.AdvanceMonthsCovered.join(', ') : '',
        advanceCreditAdded: toAmount(p.AdvanceCreditRemaining),
        paymentMode: p.PaymentMode || '',
        paymentReference: p.PaymentReference || '',
        status: p.Status || '',
      }))

    const advancePayments = payments
      .filter((p) => paymentCountsAsPaid(p) && p.IsAdvancePayment)
      .map((p) => {
        const months = Array.isArray(p.AdvanceMonthsCovered) ? p.AdvanceMonthsCovered : []
        return {
          date: p.Date || '',
          studentName: p.StudentName || '',
          registrationNumber: p.StudentId || '',
          class: p.Class || '',
          paidAmount: toAmount(p.PaidAmount),
          monthsPrepaid: months.length,
          monthsCovered: months.map((m) => formatMonthLabel(m)).join(', '),
          advanceStart: formatMonthLabel(p.AdvanceStartMonth || months[0] || ''),
          creditAdded: toAmount(p.AdvanceCreditRemaining),
          paymentMode: p.PaymentMode || '',
          paymentReference: p.PaymentReference || '',
          previousPendingArrears: toAmount(p.PreviousPendingAtPayment) || toAmount(p.PendingAmount),
        }
      })

    const advanceSummary = {
      totalRecords: advancePayments.length,
      totalCollected: advancePayments.reduce((s, r) => s + r.paidAmount, 0),
      totalMonthsPrepaid: advancePayments.reduce((s, r) => s + r.monthsPrepaid, 0),
      totalCreditIssued: advancePayments.reduce((s, r) => s + r.creditAdded, 0),
    }

    return res.status(200).json({
      success: true,
      code: 200,
      message: 'Class fee export data fetched successfully',
      data: {
        className,
        section: section || '',
        month: monthParam,
        monthLabel: formatMonthLabel(monthParam),
        academicYear: academicYearName,
        exportedAt: new Date().toISOString(),
        totals: {
          totalGenerated,
          totalPaidAll,
          totalPaidForMonth: totalPaidMonthlyForMonth,
          totalOutstanding,
          studentCount: students.length,
          ...advanceSummary,
        },
        studentOutstanding: studentOutstandingRows,
        feePayments: feePaymentRows,
        advancePayments,
        advanceSummary,
      },
    })
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
      code: 500,
    })
  }
}

const getFeeDemandSlips = async (req, res) => {
  try {
    const instutionId = requireTenantInstitution(req, res)
    if (!instutionId) return

    if (!canIssueFeeDemandSlip(req.user)) {
      return res.status(403).json({
        success: false,
        code: 403,
        message: 'Only Admin, Accountant, or the student can download a fee demand slip.',
      })
    }

    const requestedIds = req.body?.studentIds || req.query.studentIds || req.query.studentId
    const idList = Array.isArray(requestedIds)
      ? requestedIds
      : String(requestedIds || '')
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)

    const resolved = resolveDemandSlipRegistrations(req, idList)
    if (resolved.error) {
      return res.status(resolved.error.status).json({
        success: false,
        code: resolved.error.status,
        message: resolved.error.message,
      })
    }

    const registrationNumbers = resolved.registrationNumbers.slice(0, 200)
    const month =
      String(req.body?.month || req.query.month || req.query.Month || '').trim() || currentMonthKey()

    const scope = await resolveAcademicYearScope(req)
    const academicYearName = scope?.yearDoc?.Year_Name || ''

    const [students, structures, payments, paymentInstructions] = await Promise.all([
      studentModel
        .find({
          InstutionCode: instutionId,
          Registration_Number: { $in: registrationNumbers },
        })
        .select(
          'First_Name Last_Name Registration_Number Class Section Father_Name Contact_Number OutstandingAmount Status'
        )
        .lean(),
      feeStructureModel.find({ InstutionId: instutionId }).lean(),
      feePaymentModel
        .find({
          InstutionId: instutionId,
          StudentId: { $in: registrationNumbers },
        })
        .lean(),
      loadDemandPaymentInstructions(instutionId),
    ])

    const studentMap = new Map(
      students.map((s) => [String(s.Registration_Number || '').trim(), s])
    )
    const paymentsByStudent = new Map()
    payments.forEach((p) => {
      const id = String(p.StudentId || '').trim()
      if (!id) return
      if (!paymentsByStudent.has(id)) paymentsByStudent.set(id, [])
      paymentsByStudent.get(id).push(p)
    })

    const slips = []
    const missing = []
    registrationNumbers.forEach((reg) => {
      const student = studentMap.get(reg)
      if (!student) {
        missing.push(reg)
        return
      }
      const structure = findFeeStructureFromList(structures, student.Class, student.Section || '')
      slips.push(
        buildDemandSlipForStudent({
          student,
          structure,
          payments: paymentsByStudent.get(reg) || [],
          month,
          academicYear: academicYearName,
        })
      )
    })

    if (!slips.length) {
      return res.status(404).json({
        success: false,
        code: 404,
        message: missing.length
          ? `Student not found: ${missing.join(', ')}`
          : 'No demand slips to generate',
      })
    }

    return res.status(200).json({
      success: true,
      code: 200,
      message: 'Fee demand slip data fetched successfully',
      data: {
        month,
        academicYear: academicYearName,
        paymentInstructions,
        slips,
        missing,
      },
    })
  } catch (error) {
    return res.status(500).json({
      success: false,
      code: 500,
      message: error.message,
    })
  }
}

module.exports = {
  store,
  show,
  showAllPayment,
  generateMonthlyFees,
  getAnalyticsSummary,
  getClassPendingList,
  getClassFeeExportData,
  getStudentFeeDue,
  getAdvanceFeeQuote,
  collectAdvanceFee,
  listAdvanceFeeRecords,
  getStudentSummary,
  storeAdmissionFee,
  studentSubmitPayment,
  listPendingStudentPayments,
  verifyStudentPayment,
  getFeeDemandSlips,
}

