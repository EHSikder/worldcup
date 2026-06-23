const dotenv = require('dotenv');
const path = require('path');

// Load .env from project root
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const required = ['SUPABASE_URL', 'SUPABASE_SERVICE_KEY', 'JWT_SECRET', 'ADMIN_JWT_SECRET'];

for (const key of required) {
  if (!process.env[key]) {
    console.error(`❌ Missing required environment variable: ${key}`);
    process.exit(1);
  }
}

const env = Object.freeze({
  PORT: parseInt(process.env.PORT, 10) || 3001,
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_KEY,
  JWT_SECRET: process.env.JWT_SECRET,
  ADMIN_JWT_SECRET: process.env.ADMIN_JWT_SECRET,
  // TheSportsDB V2 API (premium). Auth is sent as the X-API-KEY header.
  //   LEAGUE_ID 4429 = FIFA World Cup; SEASON e.g. 2026 — verify both in your
  //   TheSportsDB dashboard for the exact competition you're tracking.
  THESPORTSDB_API_KEY:   process.env.THESPORTSDB_API_KEY || '',
  THESPORTSDB_BASE_URL:  process.env.THESPORTSDB_BASE_URL || 'https://www.thesportsdb.com/api/v2/json',
  THESPORTSDB_LEAGUE_ID: process.env.THESPORTSDB_LEAGUE_ID || '4429',
  THESPORTSDB_SEASON:    process.env.THESPORTSDB_SEASON || '2026',
  TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID || '',
  TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN || '',
  TWILIO_PHONE_NUMBER: process.env.TWILIO_PHONE_NUMBER || '',
  MOCK_OTP: (process.env.MOCK_OTP || 'true').toLowerCase() === 'true',
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:3000',
});

module.exports = env;
