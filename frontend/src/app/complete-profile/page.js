'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';
import Footer from '@/components/layout/Footer';
import { useLanguage } from '@/context/LanguageContext';

export default function CompleteProfilePage() {
  const router = useRouter();
  const { user, login, loading } = useAuth();
  const { t } = useLanguage();

  const [teams, setTeams] = useState([]);
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    mobile_number: '',
    civil_id: '',
    favoriteTeamId: ''
  });
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (!loading) {
      if (user) {
        if (user.full_name && user.favorite_team_id) {
          router.push('/predictions');
        } else {
          setFormData(prev => ({
            ...prev,
            fullName: user.full_name || '',
            email: user.email || '',
            favoriteTeamId: user.favorite_team_id || ''
          }));
        }
      } else {
        const tempUser = sessionStorage.getItem('temp_user_info');
        if (!tempUser) {
          router.push('/login');
        } else {
          const parsed = JSON.parse(tempUser);
          setFormData(prev => ({
            ...prev,
            fullName: parsed.name || '',
            email: parsed.email || ''
          }));
        }
      }
    }
  }, [user, loading, router]);

  useEffect(() => {
    api.get('/api/teams').then(res => setTeams(res.data || [])).catch(() => {});
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.fullName || !formData.mobile_number || !formData.civil_id || !formData.favoriteTeamId) {
      setError('Please fill in all required fields, including selecting a favorite team.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const token = sessionStorage.getItem('temp_firebase_token');
      const res = await api.post('/api/auth/complete-profile', {
        token,
        mobile_number: formData.mobile_number,
        civil_id: formData.civil_id,
        favorite_team_id: formData.favoriteTeamId,
        full_name: formData.fullName // Allowing them to edit the name if they want
      });
      login(res.data.token, res.data.user);
      sessionStorage.removeItem('temp_firebase_token');
      sessionStorage.removeItem('temp_user_info');
      router.push('/predictions');
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to complete profile');
      setSubmitting(false);
    }
  };

  const tempUserInfoExists = typeof window !== 'undefined' ? !!sessionStorage.getItem('temp_user_info') : false;
  if (loading && !user && !tempUserInfoExists) {
    return <div className="loading-page"><div className="spinner spinner-lg"></div></div>;
  }

  return (
    <>
      <div className="auth-page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '80vh', padding: 'var(--space-8) var(--space-4)' }}>
        <div className="auth-card" style={{ width: '100%', maxWidth: 700, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 'var(--space-6)' }}>
            <h1 style={{ marginBottom: 'var(--space-2)' }}>{t('profile_title')}</h1>
            <p style={{ color: 'var(--color-text-muted)' }}>{t('profile_subtitle')}</p>
          </div>

          {error && <div className="alert alert-error">{error}</div>}

          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'var(--space-4)' }}>
              
              <div className="form-group">
                <label className="form-label">{t('profile_name')}</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.fullName}
                  onChange={e => setFormData({ ...formData, fullName: e.target.value })}
                  required
                  placeholder="Enter your display name"
                />
              </div>
              
              <div className="form-group">
                <label className="form-label">{t('profile_email')}</label>
                <input
                  type="email"
                  className="form-input"
                  value={formData.email}
                  disabled
                  style={{ opacity: 0.5, cursor: 'not-allowed' }}
                />
              </div>
              
              <div className="form-group">
                <label className="form-label">Mobile Number</label>
                <input
                  type="tel"
                  className="form-input"
                  value={formData.mobile_number}
                  onChange={e => setFormData({ ...formData, mobile_number: e.target.value })}
                  required
                />
              </div>
              
              <div className="form-group">
                <label className="form-label">Civil ID</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.civil_id}
                  onChange={e => setFormData({ ...formData, civil_id: e.target.value })}
                  required
                />
              </div>

            </div>

            <div className="form-group" style={{ marginTop: 'var(--space-6)' }}>
              <label className="form-label" style={{ textAlign: 'center', display: 'block', fontSize: '1.2rem', marginBottom: 'var(--space-2)' }}>
                {t('profile_team') || 'Select Favorite Team'}
              </label>

              <div style={{ marginBottom: 'var(--space-4)', maxWidth: '400px', margin: '0 auto var(--space-4) auto' }}>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Search for a team..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  style={{ textAlign: 'center' }}
                />
              </div>
              
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', 
                gap: 'var(--space-3)',
                maxHeight: '300px',
                overflowY: 'auto',
                padding: '10px',
                background: 'var(--color-surface-dark)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border)'
              }}>
                {teams
                  .filter(team => team.name.toLowerCase().includes(searchQuery.toLowerCase()))
                  .map(team => (
                  <div 
                    key={team.id}
                    onClick={() => setFormData({ ...formData, favoriteTeamId: team.id })}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 8,
                      padding: '12px 8px',
                      cursor: 'pointer',
                      borderRadius: 'var(--radius-md)',
                      background: formData.favoriteTeamId === team.id ? 'var(--color-gold)' : 'var(--color-surface-light)',
                      color: '#111',
                      border: formData.favoriteTeamId === team.id ? '2px solid transparent' : '2px solid transparent',
                      transition: 'all 0.2s ease',
                      textAlign: 'center'
                    }}
                  >
                    <img 
                      src={team.flag_url} 
                      alt={team.name} 
                      style={{ 
                        width: 48, 
                        height: 32, 
                        objectFit: 'cover', 
                        borderRadius: 4,
                        boxShadow: '0 2px 5px rgba(0,0,0,0.2)'
                      }} 
                    />
                    <span style={{ fontSize: '0.75rem', fontWeight: formData.favoriteTeamId === team.id ? 'bold' : 'normal', lineHeight: 1.2 }}>
                      {team.name}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <button type="submit" className="btn btn-primary btn-xl" style={{ width: '100%', marginTop: 'var(--space-6)' }} disabled={submitting}>
              {submitting ? (t('profile_saving') || 'Saving...') : (t('profile_submit') || 'Complete Registration')}
            </button>
          </form>
        </div>
      </div>
      <Footer />
    </>
  );
}
