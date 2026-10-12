const studentModel = require('../models/studentModel')
const userModel = require('../models/User')
const classModel = require('../models/classModel')
const sectionModel = require('../models/sectionModel')
const { AcademicYear, SystemSettings } = require('../models/academicYearModel')
const { getPermissionSet } = require('./permissionAssinment')
const AWS = require('aws-sdk')

// S3 configuration for fetching student photos for ID cards
const ACCESS_KEY = process.env.ACCESS_KEY
const SECRET_ACCESS_KEY = process.env.SECRET_ACCESS_KEY
const BUCKET_NAME = process.env.BUCKET_NAME
const AWS_REGION = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'ap-southeast-2'

const s3 = new AWS.S3({
  accessKeyId: ACCESS_KEY,
  secretAccessKey: SECRET_ACCESS_KEY,
  region: AWS_REGION,
})

// Try to require pdfkit, with helpful error if not installed
let PDFDocument
try {
  PDFDocument = require('pdfkit')
} catch (error) {
  console.error('PDFKit is not installed. Please run: npm install pdfkit --save')
  PDFDocument = null
}

// Helper: fetch institution logo and principal signature image buffers from S3
const getInstitutionAssets = async (instutionCode) => {
  if (!instutionCode || !BUCKET_NAME || !ACCESS_KEY || !SECRET_ACCESS_KEY) {
    return { logoBuffer: null, principalSigBuffer: null }
  }

  try {
    const settings = await SystemSettings.findOne({
      InstutionCode: instutionCode,
    })

    if (!settings || !settings.Settings || !settings.Settings.Documents) {
      return { logoBuffer: null, principalSigBuffer: null }
    }

    const docs = settings.Settings.Documents
    let logoBuffer = null
    let principalSigBuffer = null

    if (docs.LogoKey) {
      try {
        const logoObj = await s3
          .getObject({
            Bucket: BUCKET_NAME,
            Key: docs.LogoKey,
          })
          .promise()
        logoBuffer = logoObj.Body || null
      } catch (err) {
        console.error('Failed to load institution logo from S3:', err.message)
      }
    }

    if (docs.PrincipalSignatureKey) {
      try {
        const sigObj = await s3
          .getObject({
            Bucket: BUCKET_NAME,
            Key: docs.PrincipalSignatureKey,
          })
          .promise()
        principalSigBuffer = sigObj.Body || null
      } catch (err) {
        console.error('Failed to load principal signature from S3:', err.message)
      }
    }

    return { logoBuffer, principalSigBuffer }
  } catch (err) {
    console.error('Error fetching institution assets:', err.message)
    return { logoBuffer: null, principalSigBuffer: null }
  }
}

/**
 * Generate ID card for a single student
 * Returns PDF buffer
 */
const generateIdCard = async (req, res, next) => {
  try {
    // Check if PDFKit is installed
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
        message: 'You do not have the necessary permissions to generate ID cards. Please contact your administrator',
      })
    }

    const { registrationNumber } = req.query
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

    // Fetch institution details
    const institution = await userModel.findOne({
      InstutionCode: instutionCode,
      UserType: 'SuperAdmin',
    }).select('InstutionName').lean()

    // Fetch institution logo & principal signature from S3
    const { logoBuffer, principalSigBuffer } = await getInstitutionAssets(instutionCode)

    // Fetch class and section details
    let className = student.Class || 'N/A'
    let sectionName = student.Section || ''

    if (student.Class_Code) {
      const classData = await classModel.findOne({ Class_Code: student.Class_Code }).lean()
      if (classData) {
        className = classData.Class_Name || className
      }
    }

    if (student.SectionCode) {
      const sectionData = await sectionModel.findOne({ SectionCode: student.SectionCode }).lean()
      if (sectionData) {
        sectionName = sectionData.SectionName || sectionName
      }
    }

    // Get current academic year (format: YYYY-YY)
    const currentYear = new Date().getFullYear()
    const nextYear = currentYear + 1
    const academicYear = `${currentYear}-${String(nextYear).slice(-2)}`

    // Create PDF with exact dimensions: 54mm × 86mm (vertical/portrait ID card size)
    // Convert mm to points: 1mm = 2.83465 points
    const widthMM = 54
    const heightMM = 86
    const width = widthMM * 2.83465 // ~153.07 points
    const height = heightMM * 2.83465 // ~243.78 points

    // Set response headers for PDF BEFORE creating the document
    // This ensures headers are set before any PDF operations
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `inline; filename="ID_Card_${registrationNumber}.pdf"`)

    const doc = new PDFDocument({
      size: [width, height],
      margin: 0,
    })

    // Pipe PDF to response
    doc.pipe(res)
    
    // Handle PDF errors
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

    // Beautiful Modern ID Card Design
    // Vertical orientation: 54mm width × 86mm height
    
    // Background - Light gradient effect
    doc.rect(0, 0, width, height).fill('#f8fafc')
    
    // Outer border with rounded effect (simulated with double border)
    doc.lineWidth(2)
    doc.strokeColor('#1e3a8a')
    doc.rect(2, 2, width - 4, height - 4).stroke()
    doc.lineWidth(0.5)
    doc.strokeColor('#3b82f6')
    doc.rect(3, 3, width - 6, height - 6).stroke()
    
    // Elegant header with gradient effect (darker blue at top, lighter at bottom)
    const headerHeight = 28
    doc.rect(2, 2, width - 4, headerHeight).fill('#1e40af')
    // Gradient effect simulation with lighter rectangle
    doc.rect(2, headerHeight - 5, width - 4, 5).fill('#3b82f6')
    
    // Decorative line under header
    doc.lineWidth(0.5)
    doc.strokeColor('#60a5fa')
    doc.moveTo(2, headerHeight + 2)
    doc.lineTo(width - 2, headerHeight + 2)
    doc.stroke()
    
    // Logo area (circular with elegant border)
    const logoSize = 20
    const logoX = 5
    const logoY = 5
    // Outer circle with shadow effect
    doc.circle(logoX + logoSize/2, logoY + logoSize/2, logoSize/2 + 1).fill('#ffffff')
    doc.circle(logoX + logoSize/2, logoY + logoSize/2, logoSize/2).fill('#ffffff')
    doc.lineWidth(1)
    doc.strokeColor('#1e40af')
    doc.circle(logoX + logoSize/2, logoY + logoSize/2, logoSize/2).stroke()

    // If logo image available in S3, draw it inside circle, otherwise placeholder text
    if (logoBuffer) {
      try {
        const innerSize = logoSize - 4
        doc.image(logoBuffer, logoX + 2, logoY + 2, {
          width: innerSize,
          height: innerSize,
          fit: [innerSize, innerSize],
          align: 'center',
          valign: 'center',
        })
      } catch (err) {
        console.error('Failed to render logo on ID card:', err.message)
        doc.fillColor('#1e40af')
        doc.fontSize(6.5)
        doc.font('Helvetica-Bold')
        doc.text('LOGO', logoX + logoSize/2 - 6, logoY + logoSize/2 - 2.5, { width: 12, align: 'center' })
      }
    } else {
      doc.fillColor('#1e40af')
      doc.fontSize(6.5)
      doc.font('Helvetica-Bold')
      doc.text('LOGO', logoX + logoSize/2 - 6, logoY + logoSize/2 - 2.5, { width: 12, align: 'center' })
    }
    
    // Institution name (elegant typography)
    doc.fillColor('#ffffff')
    doc.fontSize(10)
    doc.font('Helvetica-Bold')
    const institutionName =
      req.user?.InstutionName ||
      institution?.InstutionName ||
      'School Name'
    const headerNameX = logoX + logoSize + 5
    const institutionNameY = logoY + 3
    const maxNameWidth = width - headerNameX - 5
    doc.text(institutionName, headerNameX, institutionNameY, { width: maxNameWidth, ellipsis: true })
    
    // Subtitle removed as per design requirement
    
    // Middle section - background for photo & name
    const middleStartY = headerHeight + 3
    doc.rect(2, middleStartY, width - 4, 100).fill('#ffffff')
    
    // Photo placeholder with elegant frame and shadow
    const photoSize = 28 * 2.83465 // ~79.37 points
    const photoX = (width - photoSize) / 2
    const photoY = middleStartY + 4
    
    // Simple white background for photo (no colored border)
    doc.rect(photoX, photoY, photoSize, photoSize).fill('#ffffff')

    // Student photo from S3 (if available), otherwise placeholder label
    const drawPhotoPlaceholder = () => {
      doc.fillColor('#64748b')
      doc.fontSize(6)
      doc.font('Helvetica-Bold')
      doc.text('PHOTO', photoX + photoSize / 2 - 10, photoY + photoSize / 2 - 2.5, {
        width: 20,
        align: 'center',
      })
    }

    if (student.PhotoKey && BUCKET_NAME && ACCESS_KEY && SECRET_ACCESS_KEY) {
      try {
        const obj = await s3
          .getObject({
            Bucket: BUCKET_NAME,
            Key: student.PhotoKey,
          })
          .promise()

        if (obj && obj.Body) {
          doc.image(obj.Body, photoX, photoY, {
            width: photoSize,
            height: photoSize,
            fit: [photoSize, photoSize],
            align: 'center',
            valign: 'center',
          })
        } else {
          drawPhotoPlaceholder()
        }
      } catch (err) {
        console.error('Failed to load student photo for ID card:', err.message)
        drawPhotoPlaceholder()
      }
    } else {
      drawPhotoPlaceholder()
    }
    
    // Student name - centered just below photo with some spacing
    const nameY = photoY + photoSize + 6
    doc.fillColor('#1e293b')
    doc.fontSize(9.5)
    doc.font('Helvetica-Bold')
    const fullName = `${student.First_Name || ''} ${student.Last_Name || ''}`.trim() || 'N/A'
    const nameWidth = doc.widthOfString(fullName)
    const studentNameX = (width - nameWidth) / 2
    doc.text(fullName, studentNameX, nameY, { width: nameWidth, align: 'center' })
    
    // Decorative line under name removed as per design requirement
    
    // Bottom section - start clearly below photo & name
    const bottomStartY = nameY + 16
    const bottomHeight = height - bottomStartY - 2
    doc.rect(2, bottomStartY, width - 4, bottomHeight).fill('#ffffff')
    
    // Decorative border
    doc.lineWidth(0.5)
    doc.strokeColor('#e2e8f0')
    doc.rect(2, bottomStartY, width - 4, bottomHeight).stroke()
    
    // Details section as key (left) and value (right) under the name
    const detailsStartY = bottomStartY + 4
    const labelX = 8
    const valueX = 68 // fixed so all values line up
    let currentY = detailsStartY
    const lineHeight = 8.5
    const labelFontSize = 6
    const valueFontSize = 6.5

    const drawRow = (label, value) => {
      doc.fillColor('#475569')
      doc.fontSize(labelFontSize)
      doc.font('Helvetica-Bold')
      doc.text(label, labelX, currentY, { width: valueX - labelX - 2 })

      doc.fillColor('#1e293b')
      doc.fontSize(valueFontSize)
      doc.font('Helvetica')
      doc.text(String(value || 'N/A'), valueX, currentY, {
        width: width - valueX - 6,
      })

      currentY += lineHeight
    }

    const classSection = sectionName ? `${className} - ${sectionName}` : className

    drawRow('Registration No.', student.Registration_Number)
    drawRow('Class', classSection)
    drawRow('Academic Year', academicYear)
    drawRow('Father\'s Name', student.Father_Name)
    drawRow('Mother\'s Name', student.Mother_Name)
    drawRow('Contact No.', student.Contact_Number)
    drawRow('Address', student.Address)
    
    // Elegant footer with decorative line
    const footerY = height - 10
    doc.lineWidth(0.5)
    doc.strokeColor('#cbd5e1')
    doc.moveTo(2, footerY - 2)
    doc.lineTo(width - 2, footerY - 2)
    doc.stroke()
    
    // Left footer text (currently intentionally left blank - class/section removed)
    // Reserved space if needed in future
    // doc.fontSize(6.5)
    // doc.font('Helvetica-Bold')
    // doc.fillColor('#1e293b')
    // doc.text(`Class: ${classSection}`, 6, footerY, { width: 70 })
    
    // Signature on right with elegant styling (single line to avoid page overflow)
    const signatureWidth = 60
    const signatureX = width - signatureWidth - 4

    // Principal signature image (if available) just above the line
    if (principalSigBuffer) {
      try {
        const sigHeight = 10
        doc.image(principalSigBuffer, signatureX, footerY - sigHeight - 2, {
          width: signatureWidth,
          height: sigHeight,
          fit: [signatureWidth, sigHeight],
          align: 'center',
          valign: 'center',
        })
      } catch (err) {
        console.error('Failed to render principal signature on ID card:', err.message)
      }
    }

    doc.strokeColor('#1e40af')
    doc.lineWidth(1)
    doc.moveTo(signatureX, footerY - 1)
    doc.lineTo(signatureX + signatureWidth, footerY - 1)
    doc.stroke()
    doc.fillColor('#475569')
    doc.fontSize(5)
    doc.font('Helvetica')
    doc.text("Principal's Signature", signatureX, footerY + 1, {
      width: signatureWidth,
      align: 'center',
    })

    // Finalize PDF
    doc.end()
  } catch (error) {
    console.error('Error generating ID card:', error)
    console.error('Error stack:', error.stack)
    
    // If headers were already sent (PDF started), we can't send JSON
    if (res.headersSent) {
      console.error('Headers already sent, cannot send error response')
      return
    }
    
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to generate ID card',
      code: 500,
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    })
  }
}

/**
 * Generate ID cards for multiple students (bulk generation)
 */
const generateBulkIdCards = async (req, res, next) => {
  try {
    // Check if PDFKit is installed
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
        message: 'You do not have the necessary permissions to generate ID cards. Please contact your administrator',
      })
    }

    const { registrationNumbers, class: className, section } = req.body
    const instutionCode = req.user?.InstutionCode

    if (!instutionCode) {
      return res.status(400).json({
        success: false,
        code: 400,
        message: 'Institution code is required',
      })
    }

    let students = []

    if (registrationNumbers && Array.isArray(registrationNumbers) && registrationNumbers.length > 0) {
      // Generate for specific registration numbers
      students = await studentModel.find({
        Registration_Number: { $in: registrationNumbers },
        InstutionCode: instutionCode,
      }).lean()
    } else if (className) {
      // Generate for entire class or class-section
      const query = {
        Class: className,
        InstutionCode: instutionCode,
      }
      if (section) {
        query.Section = section
      }
      students = await studentModel.find(query).lean()
    } else {
      return res.status(400).json({
        success: false,
        code: 400,
        message: 'Please provide registrationNumbers array or class name',
      })
    }

    if (students.length === 0) {
      return res.status(404).json({
        success: false,
        code: 404,
        message: 'No students found',
      })
    }

    // Fetch institution details once
    const institution = await userModel.findOne({
      InstutionCode: instutionCode,
      UserType: 'SuperAdmin',
    }).select('InstutionName').lean()

    // Fetch institution logo & principal signature once for all cards
    const { logoBuffer, principalSigBuffer } = await getInstitutionAssets(instutionCode)

    // Get current academic year
    const currentYear = new Date().getFullYear()
    const nextYear = currentYear + 1
    const academicYear = `${currentYear}-${String(nextYear).slice(-2)}`

    // PDF dimensions - same as single card (vertical/portrait)
    const widthMM = 54
    const heightMM = 86
    const width = widthMM * 2.83465 // ~153.07 points
    const height = heightMM * 2.83465 // ~243.78 points

    // Set response headers for PDF BEFORE creating the document
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `inline; filename="ID_Cards_Bulk_${students.length}_students.pdf"`)

    // Create PDF with multiple pages (one per student)
    const doc = new PDFDocument({
      size: [width, height],
      margin: 0,
    })

    doc.pipe(res)
    
    // Handle PDF errors
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

    // Generate ID card for each student
    for (let i = 0; i < students.length; i++) {
      const student = students[i]

      // Fetch class and section details
      let className = student.Class || 'N/A'
      let sectionName = student.Section || ''

      if (student.Class_Code) {
        const classData = await classModel.findOne({ Class_Code: student.Class_Code }).lean()
        if (classData) {
          className = classData.Class_Name || className
        }
      }

      if (student.SectionCode) {
        const sectionData = await sectionModel.findOne({ SectionCode: student.SectionCode }).lean()
        if (sectionData) {
          sectionName = sectionData.SectionName || sectionName
        }
      }

      // Add new page for each student (except first)
      if (i > 0) {
        doc.addPage()
      }

      // Beautiful Modern ID Card Design
      // Vertical orientation: 54mm width × 86mm height
      
      // Background - Light gradient effect
      doc.rect(0, 0, width, height).fill('#f8fafc')
      
      // Outer border with rounded effect (simulated with double border)
      doc.lineWidth(2)
      doc.strokeColor('#1e3a8a')
      doc.rect(2, 2, width - 4, height - 4).stroke()
      doc.lineWidth(0.5)
      doc.strokeColor('#3b82f6')
      doc.rect(3, 3, width - 6, height - 6).stroke()
      
      // Elegant header with gradient effect (darker blue at top, lighter at bottom)
      const headerHeight = 28
      doc.rect(2, 2, width - 4, headerHeight).fill('#1e40af')
      // Gradient effect simulation with lighter rectangle
      doc.rect(2, headerHeight - 5, width - 4, 5).fill('#3b82f6')
      
      // Decorative line under header
      doc.lineWidth(0.5)
      doc.strokeColor('#60a5fa')
      doc.moveTo(2, headerHeight + 2)
      doc.lineTo(width - 2, headerHeight + 2)
      doc.stroke()
      
      // Logo area (circular with elegant border)
      const logoSize = 20
      const logoX = 5
      const logoY = 5
      // Outer circle with shadow effect
      doc.circle(logoX + logoSize/2, logoY + logoSize/2, logoSize/2 + 1).fill('#ffffff')
      doc.circle(logoX + logoSize/2, logoY + logoSize/2, logoSize/2).fill('#ffffff')
      doc.lineWidth(1)
      doc.strokeColor('#1e40af')
      doc.circle(logoX + logoSize/2, logoY + logoSize/2, logoSize/2).stroke()

      if (logoBuffer) {
        try {
          const innerSize = logoSize - 4
          doc.image(logoBuffer, logoX + 2, logoY + 2, {
            width: innerSize,
            height: innerSize,
            fit: [innerSize, innerSize],
            align: 'center',
            valign: 'center',
          })
        } catch (err) {
          console.error('Failed to render logo on bulk ID card:', err.message)
          doc.fillColor('#1e40af')
          doc.fontSize(6.5)
          doc.font('Helvetica-Bold')
          doc.text('LOGO', logoX + logoSize/2 - 6, logoY + logoSize/2 - 2.5, { width: 12, align: 'center' })
        }
      } else {
        doc.fillColor('#1e40af')
        doc.fontSize(6.5)
        doc.font('Helvetica-Bold')
        doc.text('LOGO', logoX + logoSize/2 - 6, logoY + logoSize/2 - 2.5, { width: 12, align: 'center' })
      }
      
      // Institution name (elegant typography)
      doc.fillColor('#ffffff')
      doc.fontSize(10)
      doc.font('Helvetica-Bold')
      const institutionName =
        req.user?.InstutionName ||
        institution?.InstutionName ||
        'School Name'
      const headerNameX = logoX + logoSize + 5
      const institutionNameY = logoY + 3
      const maxNameWidth = width - headerNameX - 5
      doc.text(institutionName, headerNameX, institutionNameY, { width: maxNameWidth, ellipsis: true })
      
      // Subtitle removed as per design requirement
      
      // Middle section - Elegant white background with subtle border
      const middleStartY = headerHeight + 3
      const middleHeight = 38
      doc.rect(2, middleStartY, width - 4, middleHeight).fill('#ffffff')
      
      // Decorative border around middle section
      doc.lineWidth(0.5)
      doc.strokeColor('#e2e8f0')
      doc.rect(2, middleStartY, width - 4, middleHeight).stroke()
      
      // Photo placeholder with elegant frame and shadow
      const photoSize = 28 * 2.83465 // ~79.37 points
      const photoX = (width - photoSize) / 2
      const photoY = middleStartY + 4
      
      // Shadow effect (simulated with gray rectangle)
      doc.rect(photoX + 1, photoY + 1, photoSize, photoSize).fill('#cbd5e1')
      
      // Outer decorative border
      doc.lineWidth(2)
      doc.strokeColor('#1e40af')
      doc.rect(photoX - 1, photoY - 1, photoSize + 2, photoSize + 2).stroke()
      
      // Inner border
      doc.lineWidth(1)
      doc.strokeColor('#3b82f6')
      doc.rect(photoX, photoY, photoSize, photoSize).stroke()
      
      // Photo background
      doc.rect(photoX, photoY, photoSize, photoSize).fill('#ffffff')
      
      // Photo label (elegant styling)
      doc.fillColor('#64748b')
      doc.fontSize(6)
      doc.font('Helvetica-Bold')
      doc.text('PHOTO', photoX + photoSize/2 - 10, photoY + photoSize/2 - 2.5, { width: 20, align: 'center' })
      
      // Student name with elegant styling
      const nameY = photoY + photoSize + 4
      doc.fillColor('#1e293b')
      doc.fontSize(9.5)
      doc.font('Helvetica-Bold')
      const fullName = `${student.First_Name || ''} ${student.Last_Name || ''}`.trim() || 'N/A'
      const nameWidth = doc.widthOfString(fullName)
      doc.text(fullName, (width - nameWidth) / 2, nameY, { align: 'center' })
      
      // Decorative line under name
      doc.lineWidth(0.5)
      doc.strokeColor('#cbd5e1')
      doc.moveTo(photoX, nameY + 6)
      doc.lineTo(photoX + photoSize, nameY + 6)
      doc.stroke()
      
      // Bottom section - Details with elegant layout
      const bottomStartY = middleStartY + middleHeight
      const bottomHeight = height - bottomStartY - 2
      doc.rect(2, bottomStartY, width - 4, bottomHeight).fill('#ffffff')
      
      // Decorative border
      doc.lineWidth(0.5)
      doc.strokeColor('#e2e8f0')
      doc.rect(2, bottomStartY, width - 4, bottomHeight).stroke()
      
      // Details section with improved spacing
      const detailsStartY = bottomStartY + 3
      const detailsLeftX = 5
      const detailsRightX = width / 2 + 3
      let currentY = detailsStartY
      const lineHeight = 7
      const labelFontSize = 6
      const valueFontSize = 6.5
      
      // Left column - Registration Number
      doc.fillColor('#475569')
      doc.fontSize(labelFontSize)
      doc.font('Helvetica-Bold')
      doc.text('Registration No.', detailsLeftX, currentY, { width: 55 })
      doc.fontSize(valueFontSize)
      doc.font('Helvetica')
      doc.fillColor('#1e293b')
      doc.text(`: ${student.Registration_Number || 'N/A'}`, detailsLeftX + 48, currentY, { width: width/2 - 55 })
      currentY += lineHeight
      
      // Class
      doc.fillColor('#475569')
      doc.fontSize(labelFontSize)
      doc.font('Helvetica-Bold')
      doc.text('Class', detailsLeftX, currentY, { width: 55 })
      doc.fontSize(valueFontSize)
      doc.font('Helvetica')
      doc.fillColor('#1e293b')
      const classSection = sectionName ? `${className} - ${sectionName}` : className
      doc.text(`: ${classSection}`, detailsLeftX + 48, currentY, { width: width/2 - 55 })
      currentY += lineHeight
      
      // Academic Year
      doc.fillColor('#475569')
      doc.fontSize(labelFontSize)
      doc.font('Helvetica-Bold')
      doc.text('Academic Year', detailsLeftX, currentY, { width: 55 })
      doc.fontSize(valueFontSize)
      doc.font('Helvetica')
      doc.fillColor('#1e293b')
      doc.text(`: ${academicYear}`, detailsLeftX + 48, currentY, { width: width/2 - 55 })
      currentY += lineHeight
      
      // Right column
      let rightY = detailsStartY
      
      // Father's Name
      if (student.Father_Name) {
        doc.fillColor('#475569')
        doc.fontSize(labelFontSize)
        doc.font('Helvetica-Bold')
        doc.text('Father\'s Name', detailsRightX, rightY, { width: 55 })
        doc.fontSize(valueFontSize)
        doc.font('Helvetica')
        doc.fillColor('#1e293b')
        const fatherName = student.Father_Name.length > 20 ? student.Father_Name.substring(0, 20) + '...' : student.Father_Name
        doc.text(`: ${fatherName}`, detailsRightX + 48, rightY, { width: width/2 - 55 })
        rightY += lineHeight
      }
      
      // Mother's Name
      if (student.Mother_Name) {
        doc.fillColor('#475569')
        doc.fontSize(labelFontSize)
        doc.font('Helvetica-Bold')
        doc.text('Mother\'s Name', detailsRightX, rightY, { width: 55 })
        doc.fontSize(valueFontSize)
        doc.font('Helvetica')
        doc.fillColor('#1e293b')
        const motherName = student.Mother_Name.length > 20 ? student.Mother_Name.substring(0, 20) + '...' : student.Mother_Name
        doc.text(`: ${motherName}`, detailsRightX + 48, rightY, { width: width/2 - 55 })
        rightY += lineHeight
      }
      
      // Contact Number
      if (student.Contact_Number) {
        doc.fillColor('#475569')
        doc.fontSize(labelFontSize)
        doc.font('Helvetica-Bold')
        doc.text('Contact No.', detailsRightX, rightY, { width: 55 })
        doc.fontSize(valueFontSize)
        doc.font('Helvetica')
        doc.fillColor('#1e293b')
        doc.text(`: ${student.Contact_Number}`, detailsRightX + 48, rightY, { width: width/2 - 55 })
        rightY += lineHeight
      }
      
      // Address
      if (student.Address) {
        doc.fillColor('#475569')
        doc.fontSize(labelFontSize)
        doc.font('Helvetica-Bold')
        doc.text('Address', detailsRightX, rightY, { width: 55 })
        doc.fontSize(valueFontSize)
        doc.font('Helvetica')
        doc.fillColor('#1e293b')
        const addressText = student.Address.length > 22 ? student.Address.substring(0, 22) + '...' : student.Address
        doc.text(`: ${addressText}`, detailsRightX + 48, rightY, { width: width/2 - 55 })
        rightY += lineHeight
      }
      
      // Elegant footer with decorative line
      const footerY = height - 10
      doc.lineWidth(0.5)
      doc.strokeColor('#cbd5e1')
      doc.moveTo(2, footerY - 2)
      doc.lineTo(width - 2, footerY - 2)
      doc.stroke()
      
      // Class on left
      doc.fontSize(6.5)
      doc.font('Helvetica-Bold')
      doc.fillColor('#1e293b')
      doc.text(`Class: ${classSection}`, detailsLeftX, footerY, { width: 70 })
      
      // Signature on right with elegant styling
      const signatureX = width - 52

      if (principalSigBuffer) {
        try {
          const sigHeight = 10
          doc.image(principalSigBuffer, signatureX, footerY - sigHeight - 2, {
            width: 48,
            height: sigHeight,
            fit: [48, sigHeight],
            align: 'center',
            valign: 'center',
          })
        } catch (err) {
          console.error('Failed to render principal signature on bulk ID card:', err.message)
        }
      }
      doc.strokeColor('#1e40af')
      doc.lineWidth(1)
      doc.moveTo(signatureX, footerY - 1)
      doc.lineTo(signatureX + 48, footerY - 1)
      doc.stroke()
      doc.fillColor('#475569')
      doc.fontSize(5.5)
      doc.font('Helvetica')
      doc.text('Principal\'s Signature', signatureX, footerY + 1, { width: 48, align: 'center' })
    }

    doc.end()
  } catch (error) {
    console.error('Error generating bulk ID cards:', error)
    console.error('Error stack:', error.stack)
    
    // If headers were already sent (PDF started), we can't send JSON
    if (res.headersSent) {
      console.error('Headers already sent, cannot send error response')
      return
    }
    
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to generate bulk ID cards',
      code: 500,
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    })
  }
}

module.exports = {
  generateIdCard,
  generateBulkIdCards,
}

