'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import Footer from '@/components/layout/Footer';
import { useLanguage } from '@/context/LanguageContext';
import { auth, googleProvider } from '@/lib/firebase';
import { signInWithPopup } from 'firebase/auth';
import api from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const { user, login, isAuthenticated, loading } = useAuth();
  const [error, setError] = useState(null);
  const { t } = useLanguage();

  useEffect(() => {
    if (isAuthenticated && !loading) {
      if (!user?.full_name || !user?.favorite_team_id) {
        router.push('/complete-profile');
      } else {
        router.push('/predictions');
      }
    }
  }, [isAuthenticated, loading, user, router]);

  const handleGoogleLogin = async () => {
    try {
      setError(null);
      const result = await signInWithPopup(auth, googleProvider);
      const token = await result.user.getIdToken();
      
      const res = await api.post('/api/auth/firebase-login', { token });
      
      if (res.success) {
        if (res.requiresProfileCompletion) {
          sessionStorage.setItem('temp_firebase_token', token);
          sessionStorage.setItem('temp_user_info', JSON.stringify(res.user));
          router.push('/complete-profile');
        } else {
          login(res.data.token, res.data.user);
          router.push('/predictions');
        }
      } else {
        setError(res.message || 'Login failed.');
      }
    } catch (err) {
      setError(err.message || 'Failed to login with Google.');
    }
  };

  if (loading) {
    return <div className="loading-page"><div className="spinner spinner-lg"></div></div>;
  }

  return (
    <>
      <div className="auth-page">
        <div className="auth-card">
          <div style={{ textAlign: 'center', marginBottom: 'var(--space-6)' }}>
            <h1 style={{ marginBottom: 'var(--space-2)' }}>{t('login_title')}</h1>
            <p style={{ color: 'var(--color-text-muted)' }}>{t('login_subtitle')}</p>
          </div>

          {error && <div className="alert alert-error">{error}</div>}

          <button 
            type="button" 
            className="btn btn-secondary" 
            onClick={handleGoogleLogin}
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            {t('login_google')}
          </button>
        </div>
      </div>
      <Footer />
    </>
  );
}
