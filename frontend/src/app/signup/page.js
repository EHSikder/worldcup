'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import api from '@/lib/api';
import Link from 'next/link';

export default function SignupPage() {
  const router = useRouter();
  const { isAuthenticated, loading, user } = useAuth();
  const { t } = useLanguage();

  const [form, setForm]         = useState({ email: '', password: '', confirmPassword: '' });
  const [error, setError]       = useState(null);
  const [banner, setBanner]     = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isAuthenticated && !loading) {
      if (!user?.full_name || !user?.favorite_team_id) {
        router.push('/complete-profile');
      } else {
        router.push('/predictions');
      }
    }
  }, [isAuthenticated, loading, user, router]);

  useEffect(() => {
    if (banner) {
      const timer = setTimeout(() => setBanner(null), 6000);
      return () => clearTimeout(timer);
    }
  }, [banner]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setBanner(null);

    // Frontend validation
    if (!form.email || !form.password || !form.confirmPassword) {
      setError('Please fill in all fields.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      setError('Please enter a valid email address.');
      return;
    }
    if (form.password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    try {
      setSubmitting(true);

      // Validate email uniqueness + hash password on the backend
      const res = await api.post('/api/auth/pre-signup', {
        email:    form.email.trim().toLowerCase(),
        password: form.password,
      });

      if (res.success) {
        // Store the temp token (contains hashed password, expires in 30min)
        sessionStorage.setItem('temp_presignup_token', res.tempToken);
        sessionStorage.setItem('temp_user_info', JSON.stringify(res.user));
        router.push('/complete-profile');
      }
    } catch (err) {
      const msg    = err.data?.message || err.message || '';
      const status = err.status;

      if (status === 409 || msg.toLowerCase().includes('already exists')) {
        setBanner({ type: 'info', message: 'An account with this email already exists.', linkText: 'Log in instead', linkHref: '/login' });
      } else {
        setError(msg || 'Sign up failed. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="loading-page"><div className="spinner spinner-lg" /></div>;

  return (
    <>
      {banner && (
        <div className={`auth-banner auth-banner-${banner.type}`} style={{ animation: 'slideDown 0.3s ease' }}>
          <span>{banner.message}</span>
          {banner.linkHref && (
            <Link href={banner.linkHref} style={{ color: 'inherit', fontWeight: 700, textDecoration: 'underline', marginLeft: 8 }}>
              {banner.linkText}
            </Link>
          )}
          <button onClick={() => setBanner(null)} style={{ background: 'none', border: 'none', color: 'inherit', marginLeft: 'auto', cursor: 'pointer', fontSize: '1.2rem', padding: '0 4px' }}>&times;</button>
        </div>
      )}

      <div className="auth-page">
        <div className="auth-card" style={{ maxWidth: 440, margin: '40px auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 'var(--space-6)' }}>
            <h1 style={{ marginBottom: 'var(--space-2)' }}>Create Account</h1>
            <p style={{ color: 'var(--color-text-muted)' }}>Join the challenge and predict the World Cup!</p>
          </div>

          {error && <div className="alert alert-error" style={{ marginBottom: 'var(--space-4)' }}>{error}</div>}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input
                className="form-input"
                type="email"
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                placeholder="Enter your email"
                autoComplete="email"
                autoFocus
              />
            </div>
            <div className="form-group">
              <label className="form-label">Password</label>
              <input
                className="form-input"
                type="password"
                value={form.password}
                onChange={e => setForm({ ...form, password: e.target.value })}
                placeholder="At least 6 characters"
                autoComplete="new-password"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Confirm Password</label>
              <input
                className="form-input"
                type="password"
                value={form.confirmPassword}
                onChange={e => setForm({ ...form, confirmPassword: e.target.value })}
                placeholder="Repeat your password"
                autoComplete="new-password"
              />
            </div>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting}
              style={{ width: '100%', padding: '13px', marginTop: 'var(--space-2)' }}
            >
              {submitting ? 'Checking...' : 'Continue to Profile'}
            </button>
          </form>

          <div style={{ textAlign: 'center', marginTop: 'var(--space-6)', fontSize: '0.95rem' }}>
            <span style={{ color: 'var(--color-text-muted)' }}>Already have an account? </span>
            <Link href="/login" style={{ color: 'var(--color-primary-red)', fontWeight: 'bold' }}>Log in</Link>
          </div>
        </div>
      </div>
    </>
  );
}
