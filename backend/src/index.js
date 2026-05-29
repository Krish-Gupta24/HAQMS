const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

const authRoutes = require('./routes/auth');
const patientRoutes = require('./routes/patients');
const doctorRoutes = require('./routes/doctors');
const appointmentRoutes = require('./routes/appointments');
const queueRoutes = require('./routes/queue');
const reportRoutes = require('./routes/reports');

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS
// Slightly safer than allowing everything while still keeping
// development convenience.
app.use(
  cors({
    origin: process.env.CLIENT_URL || true,
    credentials: true,
  })
);

// Body parser
app.use(express.json());

// Simple request logger
app.use((req, res, next) => {
  console.log(
    `[${new Date().toISOString()}] ${req.method} ${req.path}`
  );
  next();
});

// Register routes
app.use('/api/auth', authRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/doctors', doctorRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/queue', queueRoutes);
app.use('/api/reports', reportRoutes);

// Root route
app.get('/', (req, res) => {
  res.json({
    message:
      'Hospital Appointment and Queue Management System (HAQMS) Backend API',
    status: 'Running',
    version: '1.0.0-deliberate-bugs',
  });
});

// GLOBAL ERROR HANDLER
// BUG FIXED:
// Do not expose internal error messages, stack traces,
// database structure, or filesystem information to clients.
app.use((err, req, res, next) => {
  console.error('[CRITICAL-ERROR]:', err);

  res.status(500).json({
    message: 'An unexpected internal server error occurred!',
  });
});

// Listen on port
app.listen(PORT, () => {
  console.log(
    `===================================================`
  );
  console.log(
    `   HAQMS BACKEND SERVER IS RUNNING ON PORT ${PORT}`
  );
  console.log(
    `   ENVIRONMENT: ${process.env.NODE_ENV}`
  );
  console.log(
    `===================================================`
  );
});

// Catch unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error(
    'Unhandled Rejection at:',
    promise,
    'reason:',
    reason
  );

  // Log the issue but keep application alive.
});
