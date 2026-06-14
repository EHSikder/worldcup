'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useLanguage } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';
import { ROUND_NAMES } from '@/lib/constants';
import { NotificationBanner } from '@/components/NotificationPrompt';

export default function ProfilePage() {
  const router = useRouter();
  const { user, isAuthenticated, loading: authLoading, logout } = useAuth();
  const [profile, setProfile]           = useState(null);
  const [loading, setLoading]           = useState(true);

  // Display name editing
  const [editingName, setEditingName]   = useState(false);
  const [newDisplayName, setNewDisplayName] = useState('');
  const [nameError, setNameError]       = useState('');
  const [nameSaving, setNameSaving]     = useState(false);
  const [nameSuccess, setNameSuccess]   = useState(false);

  const fetchProfile = () => {
    api.get('/api/auth/me').then(res => {
      setProfile(res.data);
      setNewDisplayName(res.data.display_name || '');
    }).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.replace('/login');
      return;
    }
    if (isAuthenticated) fetchProfile();
  }, [isAuthenticated, authLoading, router]);

  const handleSaveDisplayName = async () => {
    setNameError('');
    setNameSuccess(false);
    if (!newDisplayName.trim()) {
      setNameError('Display name cannot be empty.');
      return;
    }
    if (newDisplayName.trim().length > 30) {
      setNameError('Display name must be 30 characters or less.');
      return;
    }
    try {
      setNameSaving(true);
      await api.put('/api/auth/profile', { display_name: newDisplayName.trim() });
      setNameSuccess(true);
      setEditingName(false);
      fetchProfile();
      setTimeout(() => setNameSuccess(false), 3000);
    } catch (err) {
      setNameError(err.data?.message || err.message || 'Failed to update display name.');
    } finally {
      setNameSaving(false);
    }
  };

  if (authLoading || loading) {
    return <div className="loading-page"><div className="spinner spinner-lg" style={{ color: 'var(--color-gold)' }} /></div>;
  }

  if (!profile) return null;

  const { stats } = profile;

  return (
    <div className="container" style={{ padding: 'var(--space-8) var(--space-6)', maxWidth: 800 }}>
      <h1 style={{ marginBottom: 'var(--space-8)' }}>My Profile</h1>

      <NotificationBanner />

      {nameSuccess && (
        <div className="alert alert-success" style={{ marginBottom: 'var(--space-4)' }}>
          ✅ Display name updated successfully!
        </div>
      )}

      {/* Points Banner */}
      <div className="card card-highlighted" style={{ textAlign: 'center', marginBottom: 'var(--space-6)', padding: 'var(--space-8)' }}>
        <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-gold)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 'var(--space-2)' }}>Total Points</div>
        <div style={{ fontFamily: 'var(--font-heading)', fontSize: 'var(--fs-6xl)', fontWeight: 800, color: 'var(--color-gold)', lineHeight: 1 }}>
          {profile.total_points || 0}
        </div>
        <div style={{ color: 'var(--color-text-muted)', fontSize: 'var(--fs-sm)', marginTop: 'var(--space-2)' }}>
          {stats?.correct_predictions || 0} Correct Out of {stats?.total_predictions || 0} predictions
        </div>
      </div>

      {/* Stats Grid */}
      <div className="stats-grid" style={{ marginBottom: 'var(--space-6)' }}>
        <div className="stat-card">
          <div className="stat-card-value">{stats?.total_predictions || 0}</div>
          <div className="stat-card-label">Predictions Made</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-value">{stats?.correct_predictions || 0}</div>
          <div className="stat-card-label">Correct Predictions</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-value" style={{ color: profile.has_submitted_prediction ? 'var(--color-green)' : 'var(--color-warning)' }}>
            {profile.has_submitted_prediction ? 'Yes' : 'No'}
          </div>
          <div className="stat-card-label">Prediction Submitted</div>
        </div>
      </div>

      {/* Points Breakdown */}
      {stats?.points_breakdown && Object.keys(stats.points_breakdown).length > 0 && (
        <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
          <h3 style={{ marginBottom: 'var(--space-4)', fontSize: 'var(--fs-lg)' }}>Points Breakdown</h3>
          {Object.entries(stats.points_breakdown).map(([round, pts]) => (
            <div key={round} style={{ display: 'flex', justifyContent: 'space-between', padding: 'var(--space-3) 0', borderBottom: '1px solid var(--color-border)' }}>
              <span style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--fs-sm)' }}>{ROUND_NAMES[round] || round}</span>
              <span className="points-display" style={{ fontSize: 'var(--fs-base)' }}>{pts} pts</span>
            </div>
          ))}
        </div>
      )}

      {/* Account Details */}
      <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
        <h3 style={{ marginBottom: 'var(--space-4)', fontSize: 'var(--fs-lg)' }}>Account Details</h3>
        <div style={{ display: 'grid', gap: 'var(--space-3)' }}>

          {/* Display Name — editable */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--space-2) 0', borderBottom: '1px solid var(--color-border)', gap: 'var(--space-3)' }}>
            <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--fs-sm)', flexShrink: 0 }}>Display Name</span>
            {editingName ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flex: 1, justifyContent: 'flex-end' }}>
                <input
                  autoFocus
                  type="text"
                  value={newDisplayName}
                  onChange={e => setNewDisplayName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleSaveDisplayName(); if (e.key === 'Escape') setEditingName(false); }}
                  maxLength={30}
                  className="form-input"
                  style={{ maxWidth: 200, padding: '5px 10px', fontSize: 'var(--fs-sm)' }}
                />
                <button
                  className="btn btn-primary btn-sm"
                  onClick={handleSaveDisplayName}
                  disabled={nameSaving}
                  style={{ padding: '5px 12px', fontSize: '0.8rem' }}
                >
                  {nameSaving ? '...' : 'Save'}
                </button>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => { setEditingName(false); setNameError(''); setNewDisplayName(profile.display_name || ''); }}
                  style={{ padding: '5px 10px', fontSize: '0.8rem' }}
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 500 }}>{profile.display_name || '—'}</span>
                <button
                  onClick={() => { setEditingName(true); setNameError(''); }}
                  style={{
                    background: 'none', border: '1px solid var(--color-border)',
                    borderRadius: 6, padding: '3px 10px', fontSize: '0.75rem',
                    cursor: 'pointer', color: 'var(--color-text-muted)',
                  }}
                >
                  ✏️ Edit
                </button>
              </div>
            )}
          </div>
          {nameError && (
            <div style={{ fontSize: '0.8rem', color: 'var(--color-error)', marginTop: -8 }}>{nameError}</div>
          )}

          {/* Other read-only fields */}
          {[
            ['Name',          profile.full_name],
            ['Company',       profile.company_name || '—'],
            ['Email',         profile.email],
            ['Mobile',        profile.mobile_number],
            ['Favorite Team', profile.favorite_team?.name || 'Not selected'],
            ['Joined',        new Date(profile.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })],
          ].map(([label, value]) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: 'var(--space-2) 0', borderBottom: '1px solid var(--color-border)' }}>
              <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--fs-sm)' }}>{label}</span>
              <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 500 }}>{value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
        <Link href="/predictions" className="btn btn-primary">Edit Predictions</Link>
        <Link href="/leaderboard" className="btn btn-secondary">Leaderboard</Link>
        <button className="btn btn-ghost" onClick={() => { logout(); router.push('/'); }} style={{ color: 'var(--color-error)' }}>Logout</button>
      </div>
    </div>
  );
}
