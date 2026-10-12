const studentModel = require('../models/studentModel')
const userModel = require('../models/User')
const classModel = require('../models/classModel')
const sectionModel = require('../models/sectionModel')
const examScheduleModel = require('../models/examScheduleModel')
const { SystemSettings } = require('../models/academicYearModel')
const { getPermissionSet } = require('./permissionAssinment')
const AWS = require('aws-sdk')
const dayjs = require('dayjs')

// S3 configuration
const ACCESS_KEY = process.env.ACCESS_KEY
const SECRET_ACCESS_KEY = process.env.SECRET_ACCESS_KEY
const BUCKET_NAME = process.env.BUCKET_NAME
const AWS_REGION = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'ap-southeast-2'

const s3 = new AWS.S3({
  accessKeyId: ACCESS_KEY,
  secretAccessKey: SECRET_ACCESS_KEY,
  region: AWS_REGION,
})

// Try to require pdfkit
let PDFDocument
try {
  PDFDocument = require('pdfkit')
} catch (error) {
  console.error('PDFKit is not installed. Please run: npm install pdfkit --save')
  PDFDocument = null
}

// Helper: fetch institution logo from S3
const getLogoBuffer = async (instutionCode) => {
  if (!instutionCode || !BUCKET_NAME || !ACCESS_KEY || !SECRET_ACCESS_KEY) {
    return null
  }

  try {
    const settings = await SystemSettings.findOne({
      InstutionCode: instutionCode,
    })

    if (!settings || !settings.Settings || !settings.Settings.Documents || !settings.Settings.Documents.LogoKey) {
      return null
    }

    const logoObj = await s3
      .getObject({
        Bucket: BUCKET_NAME,
        Key: settings.Settings.Documents.LogoKey,
      })
      .promise()

    return logoObj.Body || null
  } catch (err) {
    console.error('Failed to load institution logo from S3:', err.message)
    return null
  }
}

// Helper: Fetch student photo from S3
const getStudentPhotoBuffer = async (student) => {
  if (!student.PhotoKey || !BUCKET_NAME || !ACCESS_KEY || !SECRET_ACCESS_KEY) {
    return null
  }

  try {
    const photoObj = await s3
      .getObject({
        Bucket: BUCKET_NAME,
        Key: student.PhotoKey,
      })
      .promise()
    return photoObj.Body || null
  } catch (err) {
    console.error('Failed to load student photo from S3:', err.message)
    return null
  }
}

// Helper: Fetch principal signature from S3
const getPrincipalSignatureBuffer = async (instutionCode) => {
  if (!instutionCode || !BUCKET_NAME || !ACCESS_KEY || !SECRET_ACCESS_KEY) {
    return null
  }

  try {
    const settings = await SystemSettings.findOne({
      InstutionCode: instutionCode,
    })

    if (!settings || !settings.Settings || !settings.Settings.Documents || !settings.Settings.Documents.PrincipalSignatureKey) {
      return null
    }

    const sigObj = await s3
      .getObject({
        Bucket: BUCKET_NAME,
        Key: settings.Settings.Documents.PrincipalSignatureKey,
      })
      .promise()

    return sigObj.Body || null
  } catch (err) {
    console.error('Failed to load principal signature from S3:', err.message)
    return null
  }
}

// Common function to draw admit card layout - Professional Design
const drawAdmitCard = async (doc, student, exams, institution, logoBuffer, instutionCode) => {
  const pageWidth = doc.page.width
  const pageHeight = doc.page.height
  const margin = 25
  const contentWidth = pageWidth - 2 * margin

  // Professional border with decorative corners
  doc.lineWidth(3)
  doc.strokeColor('#1e40af')
  doc.rect(margin, margin, contentWidth, pageHeight - 2 * margin).stroke()
  
  // Inner border for depth
  doc.lineWidth(1)
  doc.strokeColor('#3b82f6')
  doc.rect(margin + 3, margin + 3, contentWidth - 6, pageHeight - 2 * margin - 6).stroke()

  // Elegant header with gradient effect
  const headerHeight = 100
  const headerY = margin + 5
  
  // Main header background with gradient simulation
  doc.rect(margin + 5, headerY, contentWidth - 10, headerHeight).fill('#1e3a8a')
  
  // Gradient effect - lighter blue overlay
  doc.rect(margin + 5, headerY + headerHeight - 20, contentWidth - 10, 20).fill('#2563eb')
  
  // Decorative pattern lines
  doc.lineWidth(0.5)
  doc.strokeColor('#60a5fa')
  doc.moveTo(margin + 5, headerY + headerHeight - 1)
  doc.lineTo(margin + contentWidth - 5, headerY + headerHeight - 1)
  doc.stroke()
  
  // Logo with circular border
  if (logoBuffer) {
    try {
      const logoSize = 65
      const logoX = margin + 25
      const logoY = headerY + 15
      
      // Circular background for logo
      doc.circle(logoX + logoSize/2, logoY + logoSize/2, logoSize/2 + 3).fill('#ffffff')
      doc.circle(logoX + logoSize/2, logoY + logoSize/2, logoSize/2 + 2).fill('#e0e7ff')
      
      doc.image(logoBuffer, logoX, logoY, { width: logoSize, height: logoSize })
    } catch (err) {
      console.error('Error adding logo to admit card:', err.message)
    }
  }

  // Institution name - elegant typography
  doc.fillColor('#ffffff')
  doc.fontSize(22)
  doc.font('Helvetica-Bold')
  const instName = institution?.InstutionName || 'Educational Institution'
  // Ensure text fits and doesn't overflow
  const instNameWidth = contentWidth - 120
  doc.text(instName, margin + 100, headerY + 20, {
    width: instNameWidth,
    align: 'left',
    ellipsis: true,
  })

  // Subtitle
  doc.fontSize(12)
  doc.font('Helvetica')
  doc.fillColor('#e0e7ff')
  doc.text('Authorized Examination Center', margin + 100, headerY + 48, {
    width: contentWidth - 120,
    align: 'left',
  })

  // Main title - "EXAM ADMIT CARD"
  doc.fontSize(18)
  doc.font('Helvetica-Bold')
  doc.fillColor('#ffffff')
  doc.text('EXAM ADMIT CARD', margin + 100, headerY + 65, {
    width: contentWidth - 120,
    align: 'left',
  })

  let yPos = headerY + headerHeight + 25

  // Student photo section (if available)
  const studentPhotoBuffer = await getStudentPhotoBuffer(student)
  const photoBoxWidth = 100
  const photoBoxHeight = 120
  const photoX = margin + contentWidth - photoBoxWidth - 25
  
  if (studentPhotoBuffer) {
    try {
      // Photo frame with border
      doc.rect(photoX, yPos, photoBoxWidth, photoBoxHeight).fill('#f8fafc')
      doc.lineWidth(2)
      doc.strokeColor('#1e40af')
      doc.rect(photoX, yPos, photoBoxWidth, photoBoxHeight).stroke()
      
      doc.image(studentPhotoBuffer, photoX + 5, yPos + 5, { 
        width: photoBoxWidth - 10, 
        height: photoBoxHeight - 10,
        fit: [photoBoxWidth - 10, photoBoxHeight - 10]
      })
    } catch (err) {
      console.error('Error adding student photo:', err.message)
    }
  } else {
    // Placeholder box
    doc.rect(photoX, yPos, photoBoxWidth, photoBoxHeight).fill('#f1f5f9')
    doc.lineWidth(2)
    doc.strokeColor('#cbd5e1')
    doc.rect(photoX, yPos, photoBoxWidth, photoBoxHeight).stroke()
    doc.fillColor('#94a3b8')
    doc.fontSize(10)
    doc.font('Helvetica')
    doc.text('Photo', photoX + photoBoxWidth/2 - 15, yPos + photoBoxHeight/2 - 5, { width: 30, align: 'center' })
  }

  // Student Details Section - Professional card design
  const detailsSectionY = yPos
  const detailsSectionWidth = photoX - margin - 20
  
  // Section header with background
  doc.fillColor('#1e40af')
  doc.rect(margin + 5, detailsSectionY, detailsSectionWidth, 28).fill()
  doc.fillColor('#ffffff')
  doc.fontSize(13)
  doc.font('Helvetica-Bold')
  doc.text('STUDENT INFORMATION', margin + 12, detailsSectionY + 8, {
    width: detailsSectionWidth - 10,
    align: 'left',
  })

  yPos = detailsSectionY + 35

  // Student details with professional styling
  doc.fillColor('#000000')
  doc.fontSize(10)
  doc.font('Helvetica')
  
  const studentDetails = [
    { label: 'Registration Number', value: student.Registration_Number || 'N/A' },
    { label: 'Student Name', value: `${student.First_Name || ''} ${student.Last_Name || ''}`.trim() || 'N/A' },
    { label: 'Class', value: `${student.Class || 'N/A'}${student.Section ? ' - ' + student.Section : ''}` },
    { label: 'Father\'s Name', value: student.Father_Name || 'N/A' },
    { label: 'Mother\'s Name', value: student.Mother_Name || 'N/A' },
    { label: 'Contact Number', value: student.Contact_Number || 'N/A' },
  ]

  studentDetails.forEach((detail, index) => {
    const rowY = yPos + index * 20
    
    // Alternating row background
    if (index % 2 === 0) {
      doc.fillColor('#f8fafc')
      doc.rect(margin + 5, rowY - 3, detailsSectionWidth, 18).fill()
    }
    
    doc.fillColor('#1e3a8a')
    doc.font('Helvetica-Bold')
    doc.fontSize(8.5)
    doc.text(detail.label + ':', margin + 12, rowY, { width: 140 })
    
    doc.fillColor('#000000')
    doc.font('Helvetica')
    doc.fontSize(9)
    doc.text(detail.value, margin + 155, rowY, { width: detailsSectionWidth - 165 })
  })

  yPos = detailsSectionY + photoBoxHeight + 15

  // Exam Schedule Section - Professional table design
  if (exams && exams.length > 0) {
    // Section header
    doc.fillColor('#1e40af')
    doc.rect(margin + 5, yPos, contentWidth - 10, 26).fill()
    doc.fillColor('#ffffff')
    doc.fontSize(12)
    doc.font('Helvetica-Bold')
    doc.text('EXAMINATION SCHEDULE', margin + 12, yPos + 8, {
      width: contentWidth - 20,
      align: 'left',
    })
    yPos += 30

    // Table header with gradient
    doc.fillColor('#1e3a8a')
    doc.rect(margin + 5, yPos, contentWidth - 10, 24).fill()
    doc.fillColor('#ffffff')
    doc.fontSize(9)
    doc.font('Helvetica-Bold')
    
    const colWidths = [
      contentWidth * 0.12,  // Date
      contentWidth * 0.22,  // Subject
      contentWidth * 0.18,  // Time
      contentWidth * 0.12,   // Duration
      contentWidth * 0.10,   // Max Marks
      contentWidth * 0.26    // Venue
    ]
    const headers = ['Date', 'Subject', 'Time', 'Duration', 'Max Marks', 'Venue']
    
    let headerX = margin + 12
    headers.forEach((header, i) => {
      doc.text(header.toUpperCase(), headerX, yPos + 7, { width: colWidths[i] - 8 })
      headerX += colWidths[i]
    })

    yPos += 24
    doc.fillColor('#000000')
    doc.font('Helvetica')

    // Calculate fixed bottom section height
    // Separator: 8px + Instructions header: 20px + gap: 3px + Instructions content: 44px + spacing: 10px + Signatures: 42px + bottom margin: 5px = ~132px
    const fixedBottomHeight = 132
    const maxFooterY = pageHeight - margin - fixedBottomHeight // Reserve space for fixed bottom sections
    const maxExams = Math.floor((maxFooterY - yPos) / 22) // 22px per row
    const examsToShow = exams.slice(0, maxExams)

    // Table rows with professional styling
    examsToShow.forEach((exam, index) => {
      const rowHeight = 22
      const bgColor = index % 2 === 0 ? '#ffffff' : '#f8fafc'
      
      doc.fillColor(bgColor)
      doc.rect(margin + 5, yPos, contentWidth - 10, rowHeight).fill()
      
      // Row border
      doc.lineWidth(0.5)
      doc.strokeColor('#e2e8f0')
      doc.rect(margin + 5, yPos, contentWidth - 10, rowHeight).stroke()

      const examDate = exam.ExamDate ? dayjs(exam.ExamDate).format('DD/MM/YYYY') : 'N/A'
      const time = `${exam.StartTime || 'N/A'} - ${exam.EndTime || 'N/A'}`
      const duration = exam.Duration || 'N/A'
      const maxMarks = exam.MaxMarks?.toString() || 'N/A'
      const venue = exam.Venue || 'N/A'

      const rowData = [examDate, exam.Subject || 'N/A', time, duration, maxMarks, venue]
      
      let dataX = margin + 12
      rowData.forEach((data, i) => {
        doc.fontSize(8)
        doc.fillColor('#1e293b')
        doc.text(data, dataX, yPos + 7, { width: colWidths[i] - 8 })
        dataX += colWidths[i]
      })

      yPos += rowHeight
    })
    
    // Show note if more exams exist
    if (exams.length > maxExams) {
      yPos += 5
      doc.fillColor('#64748b')
      doc.fontSize(7)
      doc.font('Helvetica')
      doc.text(`... and ${exams.length - maxExams} more exam(s)`, margin + 12, yPos, {
        width: contentWidth - 24,
        align: 'center',
      })
      yPos += 12
    }
  } else {
    doc.fillColor('#fef3c7')
    doc.rect(margin + 5, yPos, contentWidth - 10, 26).fill()
    doc.fillColor('#92400e')
    doc.fontSize(9)
    doc.font('Helvetica-Bold')
    doc.text('No exam schedule found for this student.', margin + 12, yPos + 9, {
      width: contentWidth - 20,
      align: 'center',
    })
    yPos += 30
  }

  // Fixed bottom section - Instructions and Signatures always at bottom
  // Calculate fixed positions from bottom of page
  const sigBoxHeight = 42
  const sigBoxWidth = 170
  const instructionsHeaderHeight = 20
  const instructionsContentHeight = 44 // 4 lines * 11px
  const spacingBetween = 10
  const headerContentGap = 3 // Very small gap between header and content
  
  // Calculate Y positions from bottom (no footer note)
  const signaturesY = pageHeight - margin - sigBoxHeight - 5
  const instructionsContentY = signaturesY - instructionsContentHeight - spacingBetween
  const instructionsHeaderY = instructionsContentY - instructionsHeaderHeight - headerContentGap
  const separatorY = instructionsHeaderY - 8
  
  // Draw separator line above instructions
  doc.lineWidth(2)
  doc.strokeColor('#1e40af')
  doc.moveTo(margin + 5, separatorY)
  doc.lineTo(margin + contentWidth - 5, separatorY)
  doc.stroke()

  // Instructions section - fixed position at bottom
  doc.fillColor('#1e40af')
  doc.rect(margin + 5, instructionsHeaderY, contentWidth - 10, instructionsHeaderHeight).fill()
  doc.fillColor('#ffffff')
  doc.fontSize(10)
  doc.font('Helvetica-Bold')
  doc.text('IMPORTANT INSTRUCTIONS', margin + 10, instructionsHeaderY + 6, {
    width: contentWidth - 20,
    align: 'left',
  })

  // Instructions content - positioned right after header with minimal gap
  doc.fillColor('#000000')
  doc.fontSize(8)
  doc.font('Helvetica')
  
  const instructions = [
    '1. This admit card must be presented at the examination hall without fail.',
    '2. Students must arrive at least 15 minutes before the scheduled exam time.',
    '3. Carry a valid photo ID proof along with this admit card for verification.',
    '4. Mobile phones, calculators, and electronic devices are strictly prohibited.',
  ]
  
  instructions.forEach((instruction, i) => {
    doc.fillColor('#1e293b')
    doc.text(instruction, margin + 10, instructionsContentY + i * 11, { width: contentWidth - 20 })
  })

  // Signature section - fixed position at bottom (after instructions)
  doc.fillColor('#000000')
  doc.fontSize(8.5)
  doc.font('Helvetica-Bold')
  
  // Fetch principal signature
  const principalSigBuffer = await getPrincipalSignatureBuffer(instutionCode)
  
  // Student signature box
  doc.rect(margin + 5, signaturesY, sigBoxWidth, sigBoxHeight).fill('#ffffff')
  doc.lineWidth(1.5)
  doc.strokeColor('#1e40af')
  doc.rect(margin + 5, signaturesY, sigBoxWidth, sigBoxHeight).stroke()
  doc.fillColor('#1e3a8a')
  doc.fontSize(8.5)
  doc.text('Student Signature', margin + 10, signaturesY + 4, { width: sigBoxWidth - 10 })
  doc.lineWidth(1)
  doc.strokeColor('#cbd5e1')
  doc.moveTo(margin + 10, signaturesY + 30)
  doc.lineTo(margin + sigBoxWidth - 5, signaturesY + 30)
  doc.stroke()

  // Principal signature box
  const principalSigX = margin + contentWidth - sigBoxWidth - 5
  doc.rect(principalSigX, signaturesY, sigBoxWidth, sigBoxHeight).fill('#ffffff')
  doc.lineWidth(1.5)
  doc.strokeColor('#1e40af')
  doc.rect(principalSigX, signaturesY, sigBoxWidth, sigBoxHeight).stroke()
  doc.fillColor('#1e3a8a')
  doc.text('Principal Signature', principalSigX + 10, signaturesY + 4, { width: sigBoxWidth - 10 })
  
  // Add principal signature image if available
  if (principalSigBuffer) {
    try {
      doc.image(principalSigBuffer, principalSigX + 10, signaturesY + 12, { 
        width: 80, 
        height: 25,
        fit: [80, 25]
      })
    } catch (err) {
      console.error('Error adding principal signature:', err.message)
      // Fallback to line if image fails
      doc.lineWidth(1)
      doc.strokeColor('#cbd5e1')
      doc.moveTo(principalSigX + 10, signaturesY + 30)
      doc.lineTo(principalSigX + sigBoxWidth - 5, signaturesY + 30)
      doc.stroke()
    }
  } else {
    // Signature line if no image
    doc.lineWidth(1)
    doc.strokeColor('#cbd5e1')
    doc.moveTo(principalSigX + 10, signaturesY + 30)
    doc.lineTo(principalSigX + sigBoxWidth - 5, signaturesY + 30)
      doc.stroke()
  }
}

/**
 * Generate admit card for a single student
 */
const generateStudentAdmitCard = async (req, res, next) => {
  try {
    if (!PDFDocument) {
      return res.status(500).json({
        success: false,
        code: 500,
        message: 'PDFKit library is not installed. Please install it by running: npm install pdfkit --save in the BackEnd directory',
      })
    }

    const permissionsResult = await getPermissionSet(req)
    if (!permissionsResult.students || !permissionsResult.students.split('-').includes('R')) {
      return res.status(403).json({
        code: 403,
        success: false,
        message: 'You do not have the necessary permissions to generate admit cards.',
      })
    }

    const { registrationNumber, examType } = req.query
    const instutionCode = req.user?.InstutionCode

    if (!registrationNumber) {
      return res.status(400).json({
        success: false,
        code: 400,
        message: 'Registration Number is required',
      })
    }

    if (!instutionCode) {
      return res.status(400).json({
        success: false,
        code: 400,
        message: 'Institution code is required',
      })
    }

    // Fetch student data
    const student = await studentModel.findOne({
      Registration_Number: registrationNumber,
      InstutionCode: instutionCode,
    }).lean()

    if (!student) {
      return res.status(404).json({
        success: false,
        code: 404,
        message: 'Student not found',
      })
    }

    // Fetch institution details - try multiple sources
    let institution = await userModel.findOne({
      InstutionCode: instutionCode,
      UserType: 'SuperAdmin',
    }).select('InstutionName InstitutionName').lean()
    
    // If not found with SuperAdmin, try any user with this institution code
    if (!institution || (!institution.InstutionName && !institution.InstitutionName)) {
      institution = await userModel.findOne({
        InstutionCode: instutionCode,
      }).select('InstutionName InstitutionName').lean()
    }
    
    // Fallback: try to get from SystemSettings if not found
    if (!institution || (!institution.InstutionName && !institution.InstitutionName)) {
      const settings = await SystemSettings.findOne({ InstutionCode: instutionCode }).lean()
      if (settings && settings.Settings && settings.Settings.InstitutionName) {
        institution = { InstutionName: settings.Settings.InstitutionName }
      }
    }
    
    // Normalize the field name
    if (institution && institution.InstitutionName && !institution.InstutionName) {
      institution.InstutionName = institution.InstitutionName
    }

    // Fetch exam schedules for this student
    const examQuery = {
      InstutionCode: instutionCode,
      ClassCode: student.Class_Code,
    }

    if (student.SectionCode) {
      examQuery.SectionCode = student.SectionCode
    }

    if (examType) {
      examQuery.ExamType = examType
    }

    const exams = await examScheduleModel.find(examQuery).sort({ ExamDate: 1, StartTime: 1 }).lean()

    if (!exams || exams.length === 0) {
      return res.status(404).json({
        success: false,
        code: 404,
        message: 'No exam schedule found for this student',
      })
    }

    // Fetch logo
    const logoBuffer = await getLogoBuffer(instutionCode)

    // Set response headers
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `inline; filename="AdmitCard_${registrationNumber}.pdf"`)

    const doc = new PDFDocument({
      size: 'A4',
      margin: 0,
    })

    doc.pipe(res)

    doc.on('error', (err) => {
      console.error('PDF generation error:', err)
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          message: 'Error generating PDF: ' + err.message,
          code: 500,
        })
      }
    })

    await drawAdmitCard(doc, student, exams, institution, logoBuffer, instutionCode)

    doc.end()
  } catch (error) {
    console.error('Error generating student admit card:', error)
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        code: 500,
        message: 'Failed to generate admit card: ' + error.message,
      })
    }
  }
}

/**
 * Generate admit cards for all students in a class/section
 */
const generateClassAdmitCards = async (req, res, next) => {
  try {
    if (!PDFDocument) {
      return res.status(500).json({
        success: false,
        code: 500,
        message: 'PDFKit library is not installed. Please install it by running: npm install pdfkit --save in the BackEnd directory',
      })
    }

    const permissionsResult = await getPermissionSet(req)
    if (!permissionsResult.students || !permissionsResult.students.split('-').includes('R')) {
      return res.status(403).json({
        code: 403,
        success: false,
        message: 'You do not have the necessary permissions to generate admit cards.',
      })
    }

    const { ClassCode, SectionCode, examType } = req.query
    const instutionCode = req.user?.InstutionCode

    if (!ClassCode) {
      return res.status(400).json({
        success: false,
        code: 400,
        message: 'Class Code is required',
      })
    }

    if (!instutionCode) {
      return res.status(400).json({
        success: false,
        code: 400,
        message: 'Institution code is required',
      })
    }

    // Fetch students
    const studentQuery = {
      InstutionCode: instutionCode,
      Class_Code: ClassCode,
    }

    if (SectionCode) {
      studentQuery.SectionCode = SectionCode
    }

    const students = await studentModel.find(studentQuery).lean()

    if (!students || students.length === 0) {
      return res.status(404).json({
        success: false,
        code: 404,
        message: 'No students found for the selected class/section',
      })
    }

    // Fetch institution details - try multiple sources
    let institution = await userModel.findOne({
      InstutionCode: instutionCode,
      UserType: 'SuperAdmin',
    }).select('InstutionName InstitutionName').lean()
    
    // If not found with SuperAdmin, try any user with this institution code
    if (!institution || (!institution.InstutionName && !institution.InstitutionName)) {
      institution = await userModel.findOne({
        InstutionCode: instutionCode,
      }).select('InstutionName InstitutionName').lean()
    }
    
    // Fallback: try to get from SystemSettings if not found
    if (!institution || (!institution.InstutionName && !institution.InstitutionName)) {
      const settings = await SystemSettings.findOne({ InstutionCode: instutionCode }).lean()
      if (settings && settings.Settings && settings.Settings.InstitutionName) {
        institution = { InstutionName: settings.Settings.InstitutionName }
      }
    }
    
    // Normalize the field name
    if (institution && institution.InstitutionName && !institution.InstutionName) {
      institution.InstutionName = institution.InstitutionName
    }

    // Fetch logo
    const logoBuffer = await getLogoBuffer(instutionCode)

    // Fetch exam schedules for the class
    const examQuery = {
      InstutionCode: instutionCode,
      ClassCode: ClassCode,
    }

    if (SectionCode) {
      examQuery.SectionCode = SectionCode
    }

    if (examType) {
      examQuery.ExamType = examType
    }

    const allExams = await examScheduleModel.find(examQuery).sort({ ExamDate: 1, StartTime: 1 }).lean()

    if (!allExams || allExams.length === 0) {
      return res.status(404).json({
        success: false,
        code: 404,
        message: 'No exam schedule found for this class/section',
      })
    }

    // Set response headers
    res.setHeader('Content-Type', 'application/pdf')
    const className = students[0]?.Class || ClassCode
    const sectionName = students[0]?.Section || SectionCode || 'All'
    res.setHeader('Content-Disposition', `inline; filename="AdmitCards_${className}_${sectionName}.pdf"`)

    const doc = new PDFDocument({
      size: 'A4',
      margin: 0,
    })

    doc.pipe(res)

    doc.on('error', (err) => {
      console.error('PDF generation error:', err)
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          message: 'Error generating PDF: ' + err.message,
          code: 500,
        })
      }
    })

    // Generate admit card for each student
    for (let i = 0; i < students.length; i++) {
      const student = students[i]

      // Filter exams for this student's section (if section-specific)
      let studentExams = allExams
      if (SectionCode && student.SectionCode !== SectionCode) {
        // Skip if section doesn't match
        continue
      }

      if (i > 0) {
        doc.addPage()
      }

      await drawAdmitCard(doc, student, studentExams, institution, logoBuffer, instutionCode)
    }

    doc.end()
  } catch (error) {
    console.error('Error generating class admit cards:', error)
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        code: 500,
        message: 'Failed to generate admit cards: ' + error.message,
      })
    }
  }
}

module.exports = {
  generateStudentAdmitCard,
  generateClassAdmitCards,
}
