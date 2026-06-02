const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const env = require('./config/env');
const errorHandler = require('./middleware/errorHandler');
const { generalLimiter } = require('./middleware/rateLimit');
const { startSyncCron } = require('./cron/syncMatches');

// Import routes
const authRoutes = require('./routes/auth');
const teamRoutes = require('./routes/teams');
const matchRoutes = require('./routes/matches');
const predictionRoutes = require('./routes/predictions');
const leaderboardRoutes = require('./routes/leaderboard');
const adminRoutes = require('./routes/admin');

const app = express();

// ── Security & Parsing ──────────────────────────────────────
app.use(helmet());

// CORS: allow multiple origins (comma-separated in env) or wildcard in dev
const allowedOrigins = env.FRONTEND_URL
  ? env.FRONTEND_URL.split(',').map(o => o.trim().replace(/\/$/, ''))
  : ['http://localhost:3000'];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (server-to-server, curl, etc.)
    if (!origin) return callback(null, true);
    
    // Allow wildcard if configured
    if (allowedOrigins.includes('*')) {
      return callback(null, true);
    }
    
    if (allowedOrigins.includes(origin) || process.env.NODE_ENV !== 'production') {
      return callback(null, true);
    }
    
    console.error(`CORS Error: Origin ${origin} not allowed. Allowed origins: ${allowedOrigins.join(', ')}`);
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

// ── 404 Handler ─────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.path} not found.`,
  });
});

// ── Error Handler ───────────────────────────────────────────
app.use(errorHandler);

// ── Start Server & Cron ─────────────────────────────────────
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

  // Start the match sync cron job
  startSyncCron();
});

module.exports = app;
