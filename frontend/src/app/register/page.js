'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';

export default function RegisterPage() {
  const router = useRouter();
  const { login, isAuthenticated } = useAuth();
  const [teams, setTeams] = useState([]);
  const [form, setForm] = useState({ full_name: '', mobile_number: '', email: '', password: '', civil_id: '', favorite_team_id: '' });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState('');

  useEffect(() => {
    if (isAuthenticated) router.replace('/bracket');
  }, [isAuthenticated, router]);

  useEffect(() => {
    api.get('/api/teams').then(res => setTeams(res.data || [])).catch(() => {});
  }, []);

  const validate = () => {
    const e = {};
    if (!form.full_name.trim()) e.full_name = 'Full name is required';
    if (!form.mobile_number.match(/^\+?\d{8,15}$/)) e.mobile_number = 'Valid mobile number with country code required';
    if (!form.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) e.email = 'Valid email required';
    if (form.password.length < 6) e.password = 'Password must be at least 6 characters';
    if (!form.civil_id.match(/^\d{12}$/)) e.civil_id = 'Civil ID must be exactly 12 digits';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    setServerError('');
    try {
      const body = { ...form };
      if (!body.favorite_team_id) delete body.favorite_team_id;
      const res = await api.post('/api/auth/register', body);
      login(res.data.token, res.data.user);
      router.push('/bracket');
    } catch (err) {
      setServerError(err.message || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field, value) => {
    setForm(f => ({ ...f, [field]: value }));
    if (errors[field]) setErrors(e => ({ ...e, [field]: '' }));
  };

  return (
    <div style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-8) var(--space-4)' }}>
      <div className="card card-elevated" style={{ width: '100%', maxWidth: 520, padding: 'var(--space-8)' }}>
        <h2 style={{ textAlign: 'center', marginBottom: 'var(--space-2)' }}>Create Your Account</h2>
        <p style={{ textAlign: 'center', color: 'var(--color-text-muted)', marginBottom: 'var(--space-6)', fontSize: 'var(--fs-sm)' }}>
          Join the World Cup 2026 prediction challenge
        </p>

        {serverError && (
          <div style={{ padding: 'var(--space-3) var(--space-4)', background: 'rgba(255,68,68,0.1)', border: '1px solid rgba(255,68,68,0.3)', borderRadius: 'var(--radius-md)', color: 'var(--color-error)', fontSize: 'var(--fs-sm)', marginBottom: 'var(--space-4)' }}>
            {serverError}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Full Name</label>
            <input className={`form-input ${errors.full_name ? 'error' : ''}`} type="text" placeholder="Enter your full name" value={form.full_name} onChange={e => handleChange('full_name', e.target.value)} />
            {errors.full_name && <span className="form-error">{errors.full_name}</span>}
          </div>
          <div className="form-group">
            <label className="form-label">Email Address</label>
            <input className={`form-input ${errors.email ? 'error' : ''}`} type="email" placeholder="your@email.com" value={form.email} onChange={e => handleChange('email', e.target.value)} />
            {errors.email && <span className="form-error">{errors.email}</span>}
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input className={`form-input ${errors.password ? 'error' : ''}`} type="password" placeholder="Min. 6 characters" value={form.password} onChange={e => handleChange('password', e.target.value)} />
            {errors.password && <span className="form-error">{errors.password}</span>}
          </div>
          <div className="form-group">
            <label className="form-label">Mobile Number</label>
            <input className={`form-input ${errors.mobile_number ? 'error' : ''}`} type="tel" placeholder="+1234567890" value={form.mobile_number} onChange={e => handleChange('mobile_number', e.target.value)} />
            {errors.mobile_number && <span className="form-error">{errors.mobile_number}</span>}
          </div>
          <div className="form-group">
            <label className="form-label">Civil ID (12 digits)</label>
            <input className={`form-input ${errors.civil_id ? 'error' : ''}`} type="text" placeholder="000000000000" maxLength={12} value={form.civil_id} onChange={e => handleChange('civil_id', e.target.value.replace(/\D/g, ''))} />
            {errors.civil_id && <span className="form-error">{errors.civil_id}</span>}
          </div>
          <div className="form-group">
            <label className="form-label">Favorite Team (optional)</label>
            <select className="form-input form-select" value={form.favorite_team_id} onChange={e => handleChange('favorite_team_id', e.target.value)}>
              <option value="">Select a team</option>
              {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div style={{ marginBottom: 'var(--space-5)', fontSize: 'var(--fs-sm)', color: 'var(--color-text-muted)' }}>
            By creating an account, you agree to our Terms of Service and Privacy Policy.
          </div>
          <button type="submit" className="btn btn-primary btn-lg" disabled={loading} style={{ width: '100%' }}>
            {loading ? <span className="spinner" /> : 'Create Account'}
          </button>
        </form>
        <p style={{ textAlign: 'center', marginTop: 'var(--space-5)', fontSize: 'var(--fs-sm)', color: 'var(--color-text-muted)' }}>
          Already have an account? <Link href="/login" style={{ color: 'var(--color-gold)' }}>Login here</Link>
        </p>
      </div>
    </div>
  );
}
