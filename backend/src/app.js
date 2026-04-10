// backend/src/app.js
// Main Express application entry point
require('dotenv').config();

const express  = require('express');
const cors     = require('cors');
const helmet   = require('helmet');
const morgan   = require('morgan');
const rateLimit = require('express-rate-limit');

const authRoutes    = require('./routes/auth');
const ehrRoutes     = require('./routes/ehr');
const accessRoutes  = require('./routes/access');
const auditRoutes   = require('./routes/audit');
const networkRoutes = require('./routes/network');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// ── Security middleware ────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));

// ── Rate limiting ──────────────────────────────────────────────────────────
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 100,
  message: 'Too many requests from this IP, please try again later.',
});
app.use('/api/', limiter);

// ── Body parsing ───────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Logging ────────────────────────────────────────────────────────────────
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('combined'));
}

// ── Health check ───────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── API routes ─────────────────────────────────────────────────────────────
const aiRoutes      = require('./routes/ai');

app.use('/api/auth',    authRoutes);
app.use('/api/ehr',     ehrRoutes);
app.use('/api/access',  accessRoutes);
app.use('/api/audit',   auditRoutes);
app.use('/api/network', networkRoutes);
app.use('/api/ai',      aiRoutes);

// ── Global error handler ───────────────────────────────────────────────────
app.use(errorHandler);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`[Server] Running on http://localhost:${PORT}`);
  console.log(`[Server] Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;
