'use client';
import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';

export default function VerifyPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resendTimer, setResendTimer] = useState(60);
  const inputRefs = useRef([]);
  const mobile = typeof window !== 'undefined' ? sessionStorage.getItem('verify_mobile') : '';

  useEffect(() => {
    if (!mobile) router.replace('/login');
    inputRefs.current[0]?.focus();
  }, [mobile, router]);

  useEffect(() => {
    if (resendTimer > 0) {
      const t = setTimeout(() => setResendTimer(r => r - 1), 1000);
      return () => clearTimeout(t);
    }
  }, [resendTimer]);

  const handleChange = (index, value) => {
    if (!/^\d?$/.test(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    if (value && index < 5) inputRefs.current[index + 1]?.focus();
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    const newOtp = [...otp];
    for (let i = 0; i < pasted.length; i++) newOtp[i] = pasted[i];
    setOtp(newOtp);
    inputRefs.current[Math.min(pasted.length, 5)]?.focus();
  };

  const handleVerify = async () => {
    const code = otp.join('');
    if (code.length !== 6) { setError('Please enter all 6 digits'); return; }
    setLoading(true);
    setError('');
    try {
      const res = await api.post('/api/auth/verify-otp', { mobile_number: mobile, otp_code: code });
      login(res.data.token, res.data.user);
      sessionStorage.removeItem('verify_mobile');
      router.push('/bracket');
    } catch (err) {
      setError(err.message || 'Invalid OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    try {
      await api.post('/api/auth/login', { mobile_number: mobile });
      setResendTimer(60);
      setError('');
    } catch (err) {
      setError(err.message || 'Failed to resend OTP');
    }
  };

  return (
    <div style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-8) var(--space-4)' }}>
      <div className="card card-elevated" style={{ width: '100%', maxWidth: 440, padding: 'var(--space-8)', textAlign: 'center' }}>
        <svg viewBox="0 0 24 24" fill="var(--color-gold)" width="48" height="48" style={{ margin: '0 auto var(--space-4)' }}>
          <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>
        </svg>
        <h2 style={{ marginBottom: 'var(--space-2)' }}>Verify Your Number</h2>
        <p style={{ color: 'var(--color-text-muted)', marginBottom: 'var(--space-6)', fontSize: 'var(--fs-sm)' }}>
          Enter the 6-digit code sent to {mobile || 'your phone'}
        </p>

        {error && (
          <div style={{ padding: 'var(--space-3)', background: 'rgba(255,68,68,0.1)', border: '1px solid rgba(255,68,68,0.3)', borderRadius: 'var(--radius-md)', color: 'var(--color-error)', fontSize: 'var(--fs-sm)', marginBottom: 'var(--space-4)' }}>
            {error}
          </div>
        )}

        <div className="otp-container" onPaste={handlePaste}>
          {otp.map((digit, i) => (
            <input
              key={i}
              ref={el => inputRefs.current[i] = el}
              className="otp-input"
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={e => handleChange(i, e.target.value)}
              onKeyDown={e => handleKeyDown(i, e)}
              autoComplete="one-time-code"
            />
          ))}
        </div>

        <button className="btn btn-primary btn-lg" onClick={handleVerify} disabled={loading} style={{ width: '100%', marginTop: 'var(--space-6)' }}>
          {loading ? <span className="spinner" /> : 'Verify Code'}
        </button>

        <p style={{ marginTop: 'var(--space-4)', fontSize: 'var(--fs-sm)', color: 'var(--color-text-muted)' }}>
          {resendTimer > 0 ? (
            <>Resend code in {resendTimer}s</>
          ) : (
            <button className="btn btn-ghost btn-sm" onClick={handleResend}>Resend Code</button>
          )}
        </p>

        <p style={{ marginTop: 'var(--space-2)', fontSize: 'var(--fs-xs)', color: 'var(--color-text-muted)' }}>
          Mock mode: use code <strong style={{ color: 'var(--color-gold)' }}>123456</strong>
        </p>
      </div>
    </div>
  );
}
