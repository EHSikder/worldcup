/**
 * Setup Admin User Script
 * Run this once to create or update the admin user in the database.
 * Usage: node scripts/setup-admin.js
 */
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const ADMIN_EMAIL = 'admin@wc-26.com';
const ADMIN_PASSWORD = 'Admin@2026';

async function main() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  console.log('Setting up admin user...');
  console.log(`Email: ${ADMIN_EMAIL}`);
  console.log(`Password: ${ADMIN_PASSWORD}`);

  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
  console.log(`Generated hash: ${passwordHash}`);

  // Check if user exists
  const { data: existing } = await supabase
    .from('users')
    .select('id')
    .eq('email', ADMIN_EMAIL)
    .single();

  if (existing) {
    // Update password
    const { error } = await supabase
      .from('users')
      .update({ password_hash: passwordHash, is_verified: true })
      .eq('email', ADMIN_EMAIL);

    if (error) {
      console.error('Failed to update admin:', error.message);
      process.exit(1);
    }
    console.log('Admin user password updated successfully.');
  } else {
    // Create admin user
    const { error } = await supabase.from('users').insert({
      full_name: 'WC2026 Admin',
      mobile_number: '+10000000000',
      email: ADMIN_EMAIL,
      civil_id: '000000000000',
      password_hash: passwordHash,
      is_verified: true,
    });

    if (error) {
      console.error('Failed to create admin:', error.message);
      process.exit(1);
    }
    console.log('Admin user created successfully.');
  }

  console.log('\nAdmin panel URL: http://localhost:3000/admin-6788157');
  console.log('Login with:', ADMIN_EMAIL, '/', ADMIN_PASSWORD);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
