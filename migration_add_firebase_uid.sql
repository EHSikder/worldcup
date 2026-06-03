-- Adds firebase_uid to users table to link Firebase auth users
ALTER TABLE users ADD COLUMN IF NOT EXISTS firebase_uid TEXT UNIQUE;
