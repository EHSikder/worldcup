// Script to create an admin user in the admin_users table
// Run: node create_admin.js
// Then copy the SQL output and run it in your Supabase SQL Editor

const bcrypt = require('bcryptjs');

const USERNAME = 'admin';
const PASSWORD = 'Admin@2026!';

async function main() {
  const salt = await bcrypt.genSalt(10);
  const hash = await bcrypt.hash(PASSWORD, salt);

  console.log('\n=== Admin User Creation ===\n');
  console.log(`Username: ${USERNAME}`);
  console.log(`Password: ${PASSWORD}`);
  console.log(`Hash: ${hash}`);
  console.log('\n=== Run this SQL in Supabase SQL Editor ===\n');
  console.log(`-- Delete existing admin if any, then insert fresh`);
  console.log(`DELETE FROM admin_users WHERE username = '${USERNAME}';`);
  console.log(`INSERT INTO admin_users (username, password_hash)`);
  console.log(`VALUES ('${USERNAME}', '${hash}');`);
  console.log('\n=== Done! ===\n');
}

main().catch(console.error);
