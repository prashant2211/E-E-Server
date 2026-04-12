const path = require('path')
const { response } = require('express')
const feePaymentModel = require('../models/feePaymentModel')
const feeStructureModel = require('../models/feeStructureModel')
const studentModel = require('../models/studentModel')
const admissionModel = require('../models/admissionModel')
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

// Helper: safe number parsing
const toAmount = (val) => {
  if (val === null || val === undefined) return 0
  const n = parseFloat(String(val).toString().replace(/,/g, '').trim())
  return isNaN(n) ? 0 : n
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

    if (!instutionId || !StudentId || !Class || !FeeType) {
      return res.status(400).json({
        success: false,
        code: 400,
        message: 'InstutionId, StudentId, Class and FeeType are required',
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

    const previousOutstanding = toAmount(student.OutstandingAmount)

    // Fetch base fee structure for the class (optional; if not found, rely on request values)
    let baseStructure = await feeStructureModel.findOne({
      InstutionId: instutionId,
      Class: Class,
    })

    // Compute base fee from structure or request
    const baseTution = baseStructure
      ? toAmount(baseStructure.TutionFee)
      : toAmount(req.body.TutionFee)
    const baseLibrary = baseStructure
      ? toAmount(baseStructure.LibraryFee)
      : toAmount(req.body.LibraryFee)
    const baseActivity = baseStructure
      ? toAmount(baseStructure.ActivityFee)
      : toAmount(req.body.ActivityFee)
    const baseExam = baseStructure ? toAmount(baseStructure.ExamFee) : toAmount(req.body.ExamFee)
    const baseUniform = baseStructure
      ? toAmount(baseStructure.UniformFee)
      : toAmount(req.body.UniformFee)
    const baseProspectus = baseStructure
      ? toAmount(baseStructure.ProspectusFee)
      : toAmount(req.body.ProspectusFee)
    const baseTransport = baseStructure
      ? toAmount(baseStructure.TransportFee)
      : toAmount(req.body.TransportFee)
    const baseOther = baseStructure
      ? toAmount(baseStructure.OtherFee)
      : toAmount(req.body.OtherFee)

    const baseTotal =
      baseTution +
      baseLibrary +
      baseActivity +
      baseExam +
      baseUniform +
      baseProspectus +
      baseTransport +
      baseOther

    const scholarship = toAmount(ScholarshipAmount)
    const concession = toAmount(ConcessionAmount)

    // Allow scholarship/concession to reduce overall dues (including previous pending)
    const netThisPeriod = baseTotal - scholarship - concession
    let totalDueBeforePayment = previousOutstanding + netThisPeriod
    if (totalDueBeforePayment < 0) {
      totalDueBeforePayment = 0
    }
    const newOutstanding = Math.max(0, totalDueBeforePayment - paid)

    const feePatment = new feePaymentModel({
      InstutionId: instutionId,
      StudentId,
      StudentName: StudentName || `${student.First_Name || ''} ${student.Last_Name || ''}`.trim(),
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
      PendingAmount: newOutstanding.toString(),
      ScholarshipAmount: scholarship.toString(),
      ConcessionAmount: concession.toString(),
      Month: Month || '',
      AcademicYear: academicYearName,
      FeeType,
      PaymentMode,
      PaymentReference,
      Date: date,
      Time: time,
      Status: paid > 0 ? 'Success' : 'Pending',
    })

    await feePatment.save()

    // Update student's outstanding
    student.OutstandingAmount = newOutstanding.toString()
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
    const scope = await resolveAcademicYearScope(req)
    const createdAtRange = scope ? { $gte: scope.from, $lte: scope.to } : null
    let feePatmentRecord
    if (req.query.Date) {
      feePatmentRecord = await feePaymentModel
        .find({
          InstutionId: req.user.InstutionCode,
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
        })
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
    const instutionId = req.user?.InstutionCode
    if (!instutionId) {
      return res.status(401).json({
        success: false,
        code: 401,
        message: 'Institution context not found',
      })
    }

    const { fromDate, toDate, class: className } = req.query

    const today = new Date()
    const todayStr = today.toLocaleDateString()

    const baseMatch = {
      InstutionId: instutionId,
      Status: 'Success',
    }

    // Helper to sum PaidAmount with optional extra match (date, class, etc.)
    const sumPaid = async (extraMatch = {}) => {
      const match = { ...baseMatch, ...extraMatch }
      const result = await feePaymentModel.aggregate([
        { $match: match },
        {
          $group: {
            _id: null,
            total: { $sum: { $toDouble: { $ifNull: ['$PaidAmount', '0'] } } },
          },
        },
      ])
      return result?.[0]?.total || 0
    }

    // Total collection for entire school (all time)
    const totalCollected = await sumPaid()

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

    // Pending for entire school (from student outstanding)
    const allStudents = await studentModel.find({ InstutionCode: instutionId }).select(
      'OutstandingAmount Class'
    )
    let totalPending = 0
    allStudents.forEach((s) => {
      totalPending += toAmount(s.OutstandingAmount)
    })

    const responseData = {
      totalCollected,
      todayCollected,
      rangeCollected,
      totalPending,
    }

    // If className is provided, compute class-specific stats
    if (className) {
      const classCollected = await sumPaid({ Class: className })
      const classTodayCollected = await sumPaid({ Class: className, Date: todayStr })

      let classRangeCollected = 0
      if (fromDate && toDate && fromDate === toDate) {
        classRangeCollected = await sumPaid({ Class: className, Date: fromDate })
      }

      let classPending = 0
      allStudents
        .filter((s) => s.Class === className)
        .forEach((s) => {
          classPending += toAmount(s.OutstandingAmount)
        })

      responseData.forClass = {
        className,
        totalCollected: classCollected,
        todayCollected: classTodayCollected,
        rangeCollected: classRangeCollected,
        totalPending: classPending,
      }
    }

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
    const instutionId = req.user?.InstutionCode
    if (!instutionId) {
      return res.status(401).json({
        success: false,
        code: 401,
        message: 'Institution context not found',
      })
    }

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

    // Get total paid per student from fee payments
    const registrations = students.map((s) => s.Registration_Number)
    const paymentsAgg = await feePaymentModel.aggregate([
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
    ])

    const paidMap = new Map()
    paymentsAgg.forEach((p) => {
      paidMap.set(p._id, p.totalPaid)
    })

    const result = students.map((s) => {
      const totalPaid = paidMap.get(s.Registration_Number) || 0
      const pending = toAmount(s.OutstandingAmount)
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
    const pending = toAmount(student.OutstandingAmount)

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

    const baseTution = baseStructure ? toAmount(baseStructure.TutionFee) : 0
    const baseLibrary = baseStructure ? toAmount(baseStructure.LibraryFee) : 0
    const baseActivity = baseStructure ? toAmount(baseStructure.ActivityFee) : 0
    const baseExam = baseStructure ? toAmount(baseStructure.ExamFee) : 0
    const baseUniform = baseStructure ? toAmount(baseStructure.UniformFee) : 0
    const baseProspectus = baseStructure ? toAmount(baseStructure.ProspectusFee) : 0
    const baseTransport = baseStructure ? toAmount(baseStructure.TransportFee) : 0
    const baseOther = baseStructure ? toAmount(baseStructure.OtherFee) : 0

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

    const outstandingSnapshot = toAmount(student.OutstandingAmount)

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
      PendingAmount: outstandingSnapshot.toString(),
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
      VerificationStatus: 'Pending',
      StudentSubmittedPayment: true,
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
    const currentOutstanding = toAmount(student.OutstandingAmount)
    const newOutstanding = Math.max(0, currentOutstanding - paid)

    student.OutstandingAmount = newOutstanding.toString()
    await student.save()

    payment.PendingAmount = newOutstanding.toString()
    payment.Status = 'Success'
    payment.VerificationStatus = 'Approved'
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

module.exports = {
  store,
  show,
  showAllPayment,
  getAnalyticsSummary,
  getClassPendingList,
  getStudentSummary,
  storeAdmissionFee,
  studentSubmitPayment,
  listPendingStudentPayments,
  verifyStudentPayment,
}

