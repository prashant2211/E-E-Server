// Load SlowBuffer polyfill FIRST before any other modules
require('./slowbuffer-polyfill');

const express = require('express');
const mongoose = require('mongoose');
const morgan = require('morgan');
const bodyParser = require('body-parser');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
require('dotenv').config();
const cors = require('cors');

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
const teacherAttendanceRoute = require('./routes/teacherAttendanceRoute');
const storeRoute = require('./routes/storeRoute');
const { getPublicInstitutionStatus } = require('./controller/publicInstitutionController');

// Import middleware
const errorHandler = require('./middleware/errorHandler');
const { logger, requestLogger } = require('./utils/logger');
const auditLogger = require('./middleware/auditLogger');

// Initialize Express app
const app = express();
app.disable('x-powered-by');

// Behind nginx / a load balancer: correct client IPs, secure cookies, rate-limit behavior
if (process.env.TRUST_PROXY === '1' || process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// API mount path — must match nginx location + VITE_API_BASE_URL (no trailing slash)
// Default matches ForntEnd vite proxy rewrite and production URLs like …/EducationalEternity
const BASE_URL =
  String(process.env.BASE_URL || '/EducationalEternity')
    .trim()
    .replace(/\/+$/, '') || '/EducationalEternity'

// Browsers still enforce CORS for cross-origin XHR/fetch; the only way to "allow everyone" is to
// send these headers on every response and answer OPTIONS with 204 (no Express router OPTIONS).
app.use(cors({
  origin: '*', // or your frontend URL
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS','HEAD'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'Accept',
    'X-Requested-With',
    'x-academic-year-id',
    'x-target-institution-code',
    'x-feature-name',
    'x-latitude',
    'x-longitude',
    'x-request-id'
  ],
  credentials: false // set true only if needed
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

// Rate limiting — ERP UIs can burst many API calls; tune via RATE_LIMIT_MAX / RATE_LIMIT_WINDOW_MS
const isProduction = process.env.NODE_ENV === 'production';
const rateLimitWindowMs = Number(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000;
const rateLimitMax =
  Number(process.env.RATE_LIMIT_MAX) || (isProduction ? 500 : 2000);

const limiter = rateLimit({
  windowMs: rateLimitWindowMs,
  max: rateLimitMax,
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.',
    code: 429,
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    if (process.env.RATE_LIMIT_DISABLED === '1' || process.env.RATE_LIMIT_DISABLED === 'true') {
      return true;
    }
    if (isProduction) return false;
    const ip = String(req.ip || '');
    return (
      ip === '127.0.0.1' ||
      ip === '::1' ||
      ip === '::ffff:127.0.0.1' ||
      ip.endsWith('127.0.0.1')
    );
  },
});

// Rate limit only real API traffic under BASE_URL (not root /health used by plain probes)
app.use((req, res, next) => {
  const p = req.path || '';
  if (p === '/health' || p === '/ready') return next();
  if (p === BASE_URL || p.startsWith(`${BASE_URL}/`)) return limiter(req, res, next);
  return next();
});

const healthJson = (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    baseUrl: BASE_URL,
  });
};

const readyJson = (req, res) => {
  const ready = mongoose.connection.readyState === 1;
  res.status(ready ? 200 : 503).json({
    success: ready,
    message: ready ? 'Database ready' : 'Database not ready',
    dbState: mongoose.connection.readyState,
    timestamp: new Date().toISOString(),
    baseUrl: BASE_URL,
  });
};

app.get('/health', healthJson);
app.get('/ready', readyJson);
// Same checks when nginx only proxies the subpath (e.g. /EducationalEternity/*)
app.get(`${BASE_URL}/health`, healthJson);
app.get(`${BASE_URL}/ready`, readyJson);

// MongoDB connection with optimized settings
const connectDB = async () => {
  try {
    const mongoOptions = {
      maxPoolSize: 10, // Maintain up to 10 socket connections
      minPoolSize: 0, // allow small VPS / low Atlas tiers without holding idle sockets
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

});

// API Routes (BASE_URL defined near top of file)

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
app.use(`${BASE_URL}/teacher-attendance`, teacherAttendanceRoute);
app.use(`${BASE_URL}/store`, storeRoute);

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

// Start server (bind all interfaces — required for many VPS / Docker setups)
const PORT = Number(process.env.PORT) || 5000;
const HOST = String(process.env.HOST || '0.0.0.0').trim() || '0.0.0.0';
const server = app.listen(PORT, HOST, () => {
  logger.info(`Server listening on http://${HOST}:${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`Base URL: ${BASE_URL}`);
  logger.info(`Auth login: POST http://${HOST}:${PORT}${BASE_URL}/login`);
  logger.info(`Institution guard: GET ${BASE_URL}/public/institution-status`);
  logger.info(`Health: GET /health or GET ${BASE_URL}/health`);
  if (process.env.RATE_LIMIT_DISABLED === '1' || process.env.RATE_LIMIT_DISABLED === 'true') {
    logger.info('Rate limit: disabled (RATE_LIMIT_DISABLED)');
  } else {
    logger.info(`Rate limit: ${rateLimitMax} requests / ${Math.round(rateLimitWindowMs / 60000)} min per IP`);
  }
});

const shutdown = (signal) => {
  logger.info(`${signal} signal received: closing HTTP server`);
  server.close(async () => {
    logger.info('HTTP server closed');
    try {
      await mongoose.connection.close(false);
      logger.info('MongoDB connection closed');
    } catch (error) {
      logger.error('MongoDB close failed', { error: error.message });
    }
    process.exit(0);
  });
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

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
