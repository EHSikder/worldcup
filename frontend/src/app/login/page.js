'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import api from '@/lib/api';
import Link from 'next/link';

export default function LoginPage() {
  const router = useRouter();
  const { user, login, isAuthenticated, loading } = useAuth();
  const { t } = useLanguage();

  const [form, setForm]         = useState({ email: '', password: '' });
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
      const t = setTimeout(() => setBanner(null), 6000);
      return () => clearTimeout(t);
    }
  }, [banner]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setBanner(null);

    if (!form.email || !form.password) {
      setError('Please enter your email and password.');
      return;
    }

    try {
      setSubmitting(true);
      const res = await api.post('/api/auth/login', {
        email:    form.email.trim().toLowerCase(),
        password: form.password,
      });

      if (res.success) {
        login(res.data.token, res.data.user);
        router.push('/predictions');
      }
    } catch (err) {
      const msg    = err.data?.message || err.message || '';
      const status = err.status;

      if (status === 404 || msg.toLowerCase().includes('no account')) {
        setBanner({ type: 'info', message: 'No account found with this email.', linkText: 'Sign up instead', linkHref: '/signup' });
      } else if (status === 401 || msg.toLowerCase().includes('incorrect password')) {
        setError('Incorrect password. Please try again.');
      } else {
        setError(msg || 'Login failed. Please try again.');
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
            <h1 style={{ marginBottom: 'var(--space-2)' }}>{t('login_title') || 'Welcome Back'}</h1>
            <p style={{ color: 'var(--color-text-muted)' }}>{t('login_subtitle') || 'Log in to continue your predictions'}</p>
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
                placeholder="Enter your password"
                autoComplete="current-password"
              />
            </div>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting}
              style={{ width: '100%', padding: '13px', marginTop: 'var(--space-2)' }}
            >
              {submitting ? 'Logging in...' : 'Log In'}
            </button>
          </form>

          <div style={{ textAlign: 'center', marginTop: 'var(--space-6)', fontSize: '0.95rem' }}>
            <span style={{ color: 'var(--color-text-muted)' }}>Don't have an account? </span>
            <Link href="/signup" style={{ color: 'var(--color-primary-red)', fontWeight: 'bold' }}>Sign up</Link>
          </div>
        </div>
      </div>
    </>
  );
}
