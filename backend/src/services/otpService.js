const crypto = require('crypto');
const env = require('../config/env');
const supabase = require('../config/database');

let twilioClient = null;

/**
 * Lazily initialize Twilio client (only when not in mock mode)
 */
function getTwilioClient() {
  if (twilioClient) return twilioClient;
  if (!env.MOCK_OTP && env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN) {
    const twilio = require('twilio');
    twilioClient = twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN);
  }
  return twilioClient;
}

/**
 * Generate a 6-digit OTP code
 */
function generateOtp() {
  return crypto.randomInt(100000, 999999).toString();
}

/**
 * Hash an OTP code for storage
 */
function hashOtp(otp) {
  return crypto.createHash('sha256').update(otp).digest('hex');
}

/**
 * Send OTP to a user's mobile number
 * In mock mode, logs to console and stores '123456' as the OTP
 */
async function sendOtp(mobileNumber) {
  const otp = env.MOCK_OTP ? '123456' : generateOtp();
  const otpHash = hashOtp(otp);
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // 5 minutes

  // Store hashed OTP and expiry in users table
  const { error } = await supabase
    .from('users')
    .update({
      otp_code: otpHash,
      otp_expires_at: expiresAt,
    })
    .eq('mobile_number', mobileNumber);

  if (error) {
    throw new Error(`Failed to store OTP: ${error.message}`);
  }

  if (env.MOCK_OTP) {
    console.log(`📱 [MOCK OTP] Code for ${mobileNumber}: ${otp}`);
    return { success: true, mock: true };
  }

  // Send via Twilio
  const client = getTwilioClient();
  if (!client) {
    throw new Error('Twilio not configured. Set MOCK_OTP=true or provide Twilio credentials.');
  }

  try {
    await client.messages.create({
      body: `Your WC2026 Predictor verification code is: ${otp}. It expires in 5 minutes.`,
      from: env.TWILIO_PHONE_NUMBER,
      to: mobileNumber,
    });
    return { success: true, mock: false };
  } catch (twilioError) {
    console.error('Twilio error:', twilioError.message);
    throw new Error('Failed to send SMS. Please try again.');
  }
}

/**
 * Verify an OTP code against the stored hash
 * Returns true if valid and not expired
 */
async function verifyOtp(mobileNumber, otpCode) {
  const { data: user, error } = await supabase
    .from('users')
    .select('id, otp_code, otp_expires_at')
    .eq('mobile_number', mobileNumber)
    .single();

  if (error || !user) {
    return { valid: false, message: 'User not found.' };
  }

  if (!user.otp_code || !user.otp_expires_at) {
    return { valid: false, message: 'No OTP requested. Please request a new one.' };
  }

  // Check expiry
  if (new Date(user.otp_expires_at) < new Date()) {
    return { valid: false, message: 'OTP has expired. Please request a new one.' };
  }

  // Compare hash
  const providedHash = hashOtp(otpCode);
  if (providedHash !== user.otp_code) {
    return { valid: false, message: 'Invalid OTP code.' };
  }

  // Clear OTP after successful verification
  await supabase
    .from('users')
    .update({
      otp_code: null,
      otp_expires_at: null,
      is_verified: true,
    })
    .eq('id', user.id);

  return { valid: true, userId: user.id };
}

module.exports = {
  sendOtp,
  verifyOtp,
};
