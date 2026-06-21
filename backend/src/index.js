const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const env = require('./config/env');
const errorHandler = require('./middleware/errorHandler');
const { generalLimiter } = require('./middleware/rateLimit');
const { startSyncCron } = require('./cron/syncMatches');
const { startNotificationCron } = require('./cron/notificationCron');

// Import routes
const authRoutes = require('./routes/auth');
const teamRoutes = require('./routes/teams');
const matchRoutes = require('./routes/matches');
const predictionRoutes = require('./routes/predictions');
const leaderboardRoutes = require('./routes/leaderboard');
const adminRoutes = require('./routes/admin');
const notificationRoutes = require('./routes/notifications');

const app = express();

// Trust Render/Heroku/Vercel reverse proxy so express-rate-limit
// reads the real client IP from X-Forwarded-For instead of the
// internal load-balancer IP (which would bucket ALL users together).
app.set('trust proxy', 1);

// ── Security & Parsing ──────────────────────────────────────
app.use(helmet());

// CORS: allow multiple origins (comma-separated in env) or wildcard in dev
const allowedOrigins = env.FRONTEND_URL
  ? env.FRONTEND_URL.split(',').map(o => o.trim().replace(/\/$/, ''))
  : ['http://localhost:3000'];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (server-to-server, curl, Render health checks)
    if (!origin) return callback(null, true);
    // Wildcard allows all — useful if FRONTEND_URL=*
    if (allowedOrigins.includes('*')) return callback(null, true);
    // Always allow in non-production
    if (process.env.NODE_ENV !== 'production') return callback(null, true);
    // In production: check against env list
    if (allowedOrigins.some(o => origin.startsWith(o) || o === origin)) {
      return callback(null, true);
    }
    console.error(`CORS blocked: ${origin} — add it to FRONTEND_URL in Render env`);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Rate Limiting ───────────────────────────────────────────
app.use('/api/', generalLimiter);

// ── Health Check ────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'WC2026 Predictor API is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
  });
});

// ── Mount Routes ────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/teams', teamRoutes);
app.use('/api/matches', matchRoutes);
app.use('/api/predictions', predictionRoutes);
app.use('/api/leaderboard', leaderboardRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/notifications', notificationRoutes);

// ── 404 Handler ─────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.path} not found.`,
  });
});

// ── Error Handler ───────────────────────────────────────────
app.use(errorHandler);

// ── Start Server & Crons ────────────────────────────────────
app.listen(env.PORT, () => {
  console.log(`
  ⚽ ═══════════════════════════════════════════════ ⚽
  ║                                                   ║
  ║   WC2026 Predictor API                            ║
  ║   Running on port ${env.PORT}                          ║
  ║   Environment: ${process.env.NODE_ENV || 'development'}                   ║
  ║   Mock OTP: ${env.MOCK_OTP}                              ║
  ║                                                   ║
  ⚽ ═══════════════════════════════════════════════ ⚽
  `);

  startSyncCron();
  startNotificationCron();
});

module.exports = app;
