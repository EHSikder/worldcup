-- Run this in Supabase SQL Editor after the main schema
-- Adds password_hash column and creates the admin user

-- 1. Add password_hash column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;

-- 2. Create admin user (admin@wc-26.com) with password 'Admin@2026'
-- The bcrypt hash below corresponds to 'Admin@2026'
-- Hash generated with bcryptjs, 10 salt rounds
INSERT INTO users (full_name, mobile_number, email, civil_id, password_hash, is_verified)
VALUES (
  'WC2026 Admin',
  '+10000000000',
  'admin@wc-26.com',
  '000000000000',
  '$2a$10$Xr1ggH2HJl6w9/lKZ1m4.OQDx.2p.Mv3mQ0vN3nJr1nIcLxIkZj.i',
  true
)
ON CONFLICT (email) DO UPDATE SET
  password_hash = EXCLUDED.password_hash,
  is_verified = true;
