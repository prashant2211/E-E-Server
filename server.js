// Load SlowBuffer polyfill FIRST before any other modules
require('./slowbuffer-polyfill');

const express = require('express');
const mongoose = require('mongoose');
const morgan = require('morgan');
const bodyParser = require('body-parser');
const compression = require('compression');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const { assertJwtConfigForEnvironment } = require('./utils/jwtConfig');

// Fail fast in production if JWT is not configured
try {
  assertJwtConfigForEnvironment();
} catch (e) {
  // eslint-disable-next-line no-console
  console.error(e.message);
  if (process.env.NODE_ENV === 'production') {
    process.exit(1);
  }
}

// Import routes
const studentRoutes = require('./routes/studentRoute');
const classRoutes = require('./routes/classRoute');
const teacherRoutes = require('./routes/teacherRoute');
const studentFeeDetailsRoute = require('./routes/studentFeeDetailsRoute');
const admissionRoute = require('./routes/admissionRoute');
const staffJobformRoute = require('./routes/staffJobApplyRoutes');
const managementMemberRoute = require('./routes/managementRoute');
const AuthRoute = require('./routes/Auth');
const instution = require('./routes/InstutionRoute');
const teacherDocRoute = require('./routes/teacherDocRoute');
const staffSalaryDetailsRoutes = require('./routes/staffSalaryDetailsRoutes');
const staffSalaryPayment = require('./routes/staffSalaryPaymentDetailsRoute');
const permissionCheck = require('./routes/permissionAssinmentRoute');
const knowladgeCenter = require('./routes/knowladgeCenterRoute');
const attendenceRecordRoute = require('./routes/attendenceRecordRoute');
const supportTicket = require('./routes/supportTicket');
const scheduleClass = require('./routes/scheduleClassRoute');
const examScheduleRoute = require('./routes/examScheduleRoute');
const examSubjectMarksRoute = require('./routes/examSubjectMarksRoute');
const studentdocumentUpload = require('./routes/studentDocumentRoute');
const studentMarksheet = require('./routes/studentMarksheetRoute');
const AdmissionInquary = require('./routes/admissionEnquaryRoute');
const dashboard = require('./routes/dashboardRoutes');
const announcement = require('./routes/announcementRoute');
const holidays = require('./routes/holidaysRoute');
const feePayment = require('./routes/feePaymentRoute');
const feeStructure = require('./routes/feeStructureRoute');
const tc = require('./routes/transferCertificateRoute');
const userController = require('./routes/userControllerRoute');
const galaryImageUploadController = require('./routes/gallaryImageUploadcontrollerRoute');
const instutionBankingInfoRoute = require('./routes/instutionBankingInfoRoute');
const timetableRoute = require('./routes/timetableRoute');
const classScheduleNewRoute = require('./routes/classScheduleNewRoute');
const schoolOnboardingRoute = require('./routes/schoolOnboardingRoute');
const libraryRoute = require('./routes/libraryRoute');
const transportRoute = require('./routes/transportRoute');
const hostelRoute = require('./routes/hostelRoute');
const homeworkRoute = require('./routes/homeworkRoute');
const reportsRoute = require('./routes/reportsRoute');
const systemConfigRoute = require('./routes/systemConfigRoute');
const aiChatRoute = require('./routes/aiChatRoute');
const admitCardRoute = require('./routes/admitCardRoute');
const inventoryRoute = require('./routes/inventoryRoute');
const staffOnboardingRoute = require('./routes/staffOnboardingRoute');
const sectionRoute = require('./routes/sectionRoute');
const idCardRoute = require('./routes/idCardRoute');
const auditLogRoute = require('./routes/auditLogRoute');
const { getPublicInstitutionStatus } = require('./controller/publicInstitutionController');

// Import middleware
const errorHandler = require('./middleware/errorHandler');
const { logger, requestLogger } = require('./utils/logger');
const { scheduleMonthlyFeeJob } = require('./jobs/monthlyFeeJob');
const auditLogger = require('./middleware/auditLogger');

// Initialize Express app
const app = express();

// CORS must run first. Express's built-in OPTIONS (Allow: POST + body) runs on routers when cors
// calls next() — e.g. Origin header stripped by a proxy → no Allow-Origin → browser CORS failure.
// This middleware always sets headers and ends OPTIONS before any router sees it.
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS,HEAD');
  const requestedHeaders = req.headers['access-control-request-headers'];
  res.setHeader(
    'Access-Control-Allow-Headers',
    requestedHeaders ||
      'Content-Type, Authorization, X-Requested-With, x-academic-year-id, x-target-institution-code, x-feature-name, x-latitude, x-longitude, x-request-id'
  );
  res.setHeader('Access-Control-Max-Age', '86400');
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  next();
});

// Security middleware (CORP same-origin can block cross-origin reads; API is cross-origin)
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// Compression middleware (gzip)
app.use(compression());

// Body parser middleware with size limits
app.use(bodyParser.json({ limit: '10mb', extended: true }));
app.use(bodyParser.urlencoded({ limit: '10mb', extended: true }));

// Request logging
if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined', { stream: { write: message => logger.info(message.trim()) } }));
}

// Custom request logger
app.use(requestLogger);
app.use(auditLogger);

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.RATE_LIMIT_MAX || 100, // limit each IP to 100 requests per windowMs
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.',
    code: 429
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', limiter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Readiness: process is up and MongoDB connection is ready
app.get('/ready', (req, res) => {
  const ready = mongoose.connection.readyState === 1;
  res.status(ready ? 200 : 503).json({
    success: ready,
    message: ready ? 'Database ready' : 'Database not ready',
    dbState: mongoose.connection.readyState,
    timestamp: new Date().toISOString()
  });
});

// MongoDB connection with optimized settings
const connectDB = async () => {
  try {
    const mongoOptions = {
      maxPoolSize: 10, // Maintain up to 10 socket connections
      minPoolSize: 5, // Maintain at least 5 socket connections
      serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
      socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
      family: 4, // Use IPv4, skip trying IPv6
    };

    // Use DBCONNECTIONURL from .env (required for MongoDB Atlas)
    const mongoUri = process.env.DBCONNECTIONURL;
    
    if (!mongoUri) {
      logger.error('DBCONNECTIONURL not set in .env file! Please set your MongoDB connection string.');
      process.exit(1);
    }
    
    logger.info(`Connecting to MongoDB: ${mongoUri.replace(/\/\/.*@/, '//***@')}`);
    
    await mongoose.connect(mongoUri, mongoOptions);

    const db = mongoose.connection;

    db.on('error', (err) => {
      logger.error('MongoDB connection error:', err);
      process.exit(1);
    });

    db.once('open', () => {
      logger.info('MongoDB connection established successfully');
      logger.info(`Database: ${db.name}`);
      logger.info(`Host: ${db.host}`);
    });

    db.on('disconnected', () => {
      logger.warn('MongoDB disconnected');
    });

    // Graceful shutdown
    process.on('SIGINT', async () => {
      await mongoose.connection.close();
      logger.info('MongoDB connection closed through app termination');
      process.exit(0);
    });

  } catch (error) {
    logger.error('MongoDB connection failed:', error);
    process.exit(1);
  }
};

// Connect to database
connectDB().then(() => {
  // Index creation is disabled temporarily to avoid startup crashes caused by
  // duplicate index definitions or legacy indexes in the database.
  // Existing indexes in MongoDB will continue to work as-is.
  //
  // If you want to re-enable automatic index creation after cleaning up
  // duplicates, uncomment the lines below:
  //
  // const { createIndexes } = require('./config/database');
  // createIndexes();

  // Schedule background jobs only after successful DB connection
  try {
    scheduleMonthlyFeeJob();
    logger.info('[MonthlyFeeJob] Scheduled (cron: 5 0 1 * * — 00:05 on 1st of each month)');
  } catch (jobError) {
    logger.error('Failed to schedule monthly fee job:', jobError);
  }
});

// API Routes (trim: spaced .env values like BASE_URL = /foo break path matching)
const BASE_URL = String(process.env.BASE_URL || '/api').trim();

// Public institution check — registered on app directly so deploys cannot miss it (same URL as frontend).
app.get(`${BASE_URL}/public/institution-status`, getPublicInstitutionStatus);
app.get(`${BASE_URL}/public/institution-ping`, (_req, res) => {
  res.status(200).json({ success: true, message: 'public routes reachable', baseUrl: BASE_URL });
});

app.use(`${BASE_URL}/student`, studentRoutes);
app.use(`${BASE_URL}/class`, classRoutes);
app.use(`${BASE_URL}/section`, sectionRoute);
app.use(`${BASE_URL}/teacher`, teacherRoutes);
app.use(`${BASE_URL}/feeStructure`, studentFeeDetailsRoute);
app.use(`${BASE_URL}/admission`, admissionRoute);
app.use(`${BASE_URL}/staffJobForm`, staffJobformRoute);
app.use(`${BASE_URL}/managementMember`, managementMemberRoute);
app.use(BASE_URL, AuthRoute);
app.use(`${BASE_URL}/instution`, instution);
app.use(`${BASE_URL}/upload`, teacherDocRoute);
app.use(`${BASE_URL}/salary`, staffSalaryDetailsRoutes);
app.use(`${BASE_URL}/salary_payment`, staffSalaryPayment);
app.use(`${BASE_URL}/permission`, permissionCheck);
app.use(`${BASE_URL}/Education`, knowladgeCenter);
app.use(`${BASE_URL}/attendenceRecord`, attendenceRecordRoute);
app.use(`${BASE_URL}/supoortTicket`, supportTicket);
app.use(`${BASE_URL}/scheduleClass`, scheduleClass);
app.use(`${BASE_URL}/examSchedule`, examScheduleRoute);
app.use(`${BASE_URL}/examMarks`, examSubjectMarksRoute);
app.use(`${BASE_URL}/studentDoc`, studentdocumentUpload);
app.use(`${BASE_URL}/academic`, studentMarksheet);
app.use(`${BASE_URL}/AdmissionInquary`, AdmissionInquary);
app.use(`${BASE_URL}/dashboard`, dashboard);
app.use(`${BASE_URL}/announcement`, announcement);
app.use(`${BASE_URL}/holidays`, holidays);
app.use(`${BASE_URL}/feePayment`, feePayment);
app.use(`${BASE_URL}/feeStructure`, feeStructure);
app.use(`${BASE_URL}/tc`, tc);
app.use(`${BASE_URL}/siteAccessCheck`, userController);
app.use(`${BASE_URL}/galary`, galaryImageUploadController);
app.use(`${BASE_URL}/instution-banking`, instutionBankingInfoRoute);
app.use(`${BASE_URL}/library`, libraryRoute);
app.use(`${BASE_URL}/transport`, transportRoute);
app.use(`${BASE_URL}/hostel`, hostelRoute);
app.use(`${BASE_URL}/homework`, homeworkRoute);
app.use(`${BASE_URL}/reports`, reportsRoute);
  app.use(`${BASE_URL}/system-config`, systemConfigRoute);
  app.use(`${BASE_URL}/ai-chat`, aiChatRoute);
  app.use(`${BASE_URL}/admit-card`, admitCardRoute);
app.use(`${BASE_URL}/inventory`, inventoryRoute);
app.use(`${BASE_URL}/onboard`, schoolOnboardingRoute);
app.use(`${BASE_URL}/staff-onboarding`, staffOnboardingRoute);
app.use(`${BASE_URL}/timetable`, timetableRoute);
app.use(`${BASE_URL}/class-schedule`, classScheduleNewRoute);
app.use(`${BASE_URL}/id-card`, idCardRoute);
app.use(`${BASE_URL}/audit-logs`, auditLogRoute);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    code: 404,
    path: req.originalUrl
  });
});

// Global error handler (must be last)
app.use(errorHandler);

// Start server
const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
  logger.info(`Server is running on PORT: ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`Base URL: ${BASE_URL}`);
  logger.info(`Institution guard: GET ${BASE_URL}/public/institution-status`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    logger.info('HTTP server closed');
    mongoose.connection.close(false, () => {
      logger.info('MongoDB connection closed');
      process.exit(0);
    });
  });
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  logger.error('Unhandled Promise Rejection:', err);
  server.close(() => {
    process.exit(1);
  });
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception:', err);
  process.exit(1);
});

module.exports = app;
