'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const { login, isAuthenticated } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isAuthenticated) router.replace('/bracket');
  }, [isAuthenticated, router]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) { setError('Please fill in all fields'); return; }
    setLoading(true);
    setError('');
    try {
      const res = await api.post('/api/auth/login', { email, password });
      login(res.data.token, res.data.user);
      router.push('/bracket');
    } catch (err) {
      setError(err.message || 'Invalid credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-8) var(--space-4)' }}>
      <div className="card card-elevated" style={{ width: '100%', maxWidth: 440, padding: 'var(--space-8)' }}>
        <h2 style={{ textAlign: 'center', marginBottom: 'var(--space-2)' }}>Welcome Back</h2>
        <p style={{ textAlign: 'center', color: 'var(--color-text-muted)', marginBottom: 'var(--space-6)', fontSize: 'var(--fs-sm)' }}>
          Log in to view and edit your bracket predictions
        </p>
        {error && (
          <div style={{ padding: 'var(--space-3)', background: 'rgba(255,68,68,0.1)', border: '1px solid rgba(255,68,68,0.3)', borderRadius: 'var(--radius-md)', color: 'var(--color-error)', fontSize: 'var(--fs-sm)', marginBottom: 'var(--space-4)' }}>
            {error}
          </div>
        )}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Email Address</label>
            <input className="form-input" type="email" placeholder="your@email.com" value={email} onChange={e => setEmail(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input className="form-input" type="password" placeholder="Enter your password" value={password} onChange={e => setPassword(e.target.value)} />
          </div>
          <button type="submit" className="btn btn-primary btn-lg" disabled={loading} style={{ width: '100%' }}>
            {loading ? <span className="spinner" /> : 'Login'}
          </button>
        </form>
        <p style={{ textAlign: 'center', marginTop: 'var(--space-5)', fontSize: 'var(--fs-sm)', color: 'var(--color-text-muted)' }}>
          No account? <Link href="/register" style={{ color: 'var(--color-gold)' }}>Register here</Link>
        </p>
      </div>
    </div>
  );
}
