'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';
import { useLanguage } from '@/context/LanguageContext';

const HEAR_ABOUT_OPTIONS = [
  { value: 'instagram', label: 'Instagram' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'twitter', label: 'Twitter / X' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'friend', label: 'Friend or Family' },
  { value: 'work', label: 'Colleague / Work' },
  { value: 'other', label: 'Other' },
];

export default function CompleteProfilePage() {
  const router = useRouter();
  const { user, login, loading } = useAuth();
  const { t } = useLanguage();

  const [teams, setTeams] = useState([]);
  const [formData, setFormData] = useState({
    fullName: '',
    displayName: '',
    companyName: '',
    email: '',
    mobile_number: '',
    civil_id: '',
    favoriteTeamId: '',
    hearAbout: '',
    hearAboutOther: '',
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

    if (!formData.fullName.trim()) {
      setError('Full name is required.');
      return;
    }
    if (!formData.displayName.trim()) {
      setError('Display name is required. This is what others will see on the leaderboard.');
      return;
    }
    if (!formData.mobile_number.trim()) {
      setError('Mobile number is required.');
      return;
    }
    // Civil ID: only validate format if one was entered (it's optional)
    if (formData.civil_id.trim() && !/^\d{12}$/.test(formData.civil_id)) {
      setError('Civil ID must be exactly 12 numeric digits (e.g., 281234567890).');
      return;
    }
    if (!formData.favoriteTeamId) {
      setError('Please select a favorite team by tapping on one below.');
      return;
    }
    if (!formData.hearAbout) {
      setError('Please let us know how you heard about us.');
      return;
    }
    if (formData.hearAbout === 'other' && !formData.hearAboutOther.trim()) {
      setError('Please tell us how you heard about us.');
      return;
    }
    if (!formData.companyName.trim()) {
      setError('Company Name is required.');
      return;
    }
    
    setSubmitting(true);
    setError(null);

    try {
      const token = sessionStorage.getItem('temp_firebase_token');
      if (!token) {
        setError('Session expired. Please try signing up again.');
        setSubmitting(false);
        return;
      }

      const hearAboutFinal = formData.hearAbout === 'other'
        ? `Other: ${formData.hearAboutOther.trim()}`
        : formData.hearAbout;

      const res = await api.post('/api/auth/complete-profile', {
        token,
        mobile_number: formData.mobile_number,
        civil_id: formData.civil_id.trim() || null,
        favorite_team_id: formData.favoriteTeamId,
        full_name: formData.fullName,
        display_name: formData.displayName,
        company_name: formData.companyName.trim(),
        hear_about_us: hearAboutFinal,
      });

      login(res.data.token, res.data.user);
      sessionStorage.removeItem('temp_firebase_token');
      sessionStorage.removeItem('temp_user_info');
      sessionStorage.setItem('wc2026_new_signup', 'true');
      router.push('/predictions');
    } catch (err) {
      setError(err.data?.message || err.message || 'Failed to complete profile');
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
            <h1 style={{ marginBottom: 'var(--space-2)' }}>{t('profile_title') || 'Complete Your Profile'}</h1>
            <p style={{ color: 'var(--color-text-muted)' }}>{t('profile_subtitle') || 'Just a few details to get you started'}</p>
          </div>

          {error && (
            <div className="alert alert-error" style={{
              marginBottom: 'var(--space-4)',
              padding: 'var(--space-3) var(--space-4)',
              background: 'rgba(228, 0, 43, 0.08)',
              border: '1px solid rgba(228, 0, 43, 0.3)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--color-error)',
              fontSize: 'var(--fs-sm)',
              fontWeight: 500,
              animation: 'slideDown 0.3s ease'
            }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'var(--space-4)' }}>

              {/* Full Name */}
              <div className="form-group">
                <label className="form-label">{t('profile_name') || 'Full Name'} <span style={{ color: 'var(--color-primary-red)' }}>*</span></label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.fullName}
                  onChange={e => setFormData({ ...formData, fullName: e.target.value })}
                  placeholder="Your legal full name"
                />
              </div>

              {/* Display Name */}
              <div className="form-group">
                <label className="form-label">
                  Display Name <span style={{ color: 'var(--color-primary-red)' }}>*</span>
                  <span style={{ fontWeight: 400, fontSize: '0.78rem', color: 'var(--color-text-muted)', marginLeft: 6 }}>shown on leaderboard</span>
                </label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.displayName}
                  onChange={e => setFormData({ ...formData, displayName: e.target.value })}
                  placeholder="Nickname visible to others"
                />
              </div>

              {/* Company Name */}
              <div className="form-group">
                <label className="form-label">{t('company_name') || 'Company Name'} <span style={{ color: 'var(--color-primary-red)' }}>*</span></label>                
                <input
                  type="text"
                  className="form-input"
                  value={formData.companyName}
                  onChange={e => setFormData({ ...formData, companyName: e.target.value })}
                  placeholder="Your company or organisation"
                />
              </div>

              {/* Email (read-only) */}
              <div className="form-group">
                <label className="form-label">{t('profile_email') || 'Email'}</label>
                <input
                  type="email"
                  className="form-input"
                  value={formData.email}
                  disabled
                  style={{ opacity: 0.5, cursor: 'not-allowed' }}
                />
              </div>

              {/* Mobile Number */}
              <div className="form-group">
                <label className="form-label">Mobile Number <span style={{ color: 'var(--color-primary-red)' }}>*</span></label>
                <input
                  type="tel"
                  className="form-input"
                  value={formData.mobile_number}
                  onChange={e => setFormData({ ...formData, mobile_number: e.target.value })}
                  placeholder="+965 XXXX XXXX"
                />
              </div>

              {/* Civil ID (optional) */}
              <div className="form-group">
                <label className="form-label">
                  Civil ID
                  <span style={{ fontWeight: 400, fontSize: '0.78rem', color: 'var(--color-text-muted)', marginLeft: 6 }}>optional · 12 digits</span>
                </label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.civil_id}
                  onChange={e => setFormData({ ...formData, civil_id: e.target.value })}
                  placeholder="e.g. 281234567890"
                  maxLength={12}
                  inputMode="numeric"
                />
              </div>

            </div>

            {/* Where did you hear about us */}
            <div className="form-group" style={{ marginTop: 'var(--space-4)' }}>
              <label className="form-label">
                Where did you hear about us? <span style={{ color: 'var(--color-primary-red)' }}>*</span>
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
                {HEAR_ABOUT_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setFormData({ ...formData, hearAbout: opt.value, hearAboutOther: '' })}
                    style={{
                      padding: '10px 14px',
                      borderRadius: '14px',
                      border: formData.hearAbout === opt.value ? '2px solid var(--color-gold)' : '1px solid var(--color-border)',
                      background: formData.hearAbout === opt.value ? 'rgba(212,168,67,0.12)' : 'var(--color-surface-light)',
                      color: formData.hearAbout === opt.value ? 'var(--color-gold)' : 'var(--color-text-primary)',
                      fontWeight: formData.hearAbout === opt.value ? 700 : 500,
                      fontSize: '0.85rem',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      textAlign: 'center',
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              {formData.hearAbout === 'other' && (
                <input
                  type="text"
                  className="form-input"
                  style={{ marginTop: 'var(--space-3)' }}
                  value={formData.hearAboutOther}
                  onChange={e => setFormData({ ...formData, hearAboutOther: e.target.value })}
                  placeholder="Tell us how you found out..."
                  autoFocus
                />
              )}
            </div>

            {/* Favourite Team */}
            <div className="form-group" style={{ marginTop: 'var(--space-6)' }}>
              <label className="form-label" style={{ textAlign: 'center', display: 'block', fontSize: '1.2rem', marginBottom: 'var(--space-2)' }}>
                {t('profile_team') || 'Select Favourite Team'} <span style={{ color: 'var(--color-primary-red)' }}>*</span>
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
                        border: '2px solid transparent',
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
                          objectFit: 'contain',
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
    </>
  );
}
