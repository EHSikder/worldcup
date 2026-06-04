'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { auth, googleProvider } from '@/lib/firebase';
import { signInWithPopup } from 'firebase/auth';
import api from '@/lib/api';
import Link from 'next/link';

export default function LoginPage() {
  const router = useRouter();
  const { user, login, isAuthenticated, loading } = useAuth();
  const [error, setError] = useState(null);
  const { t } = useLanguage();
  
  const [isLoggingIn, setIsLoggingIn] = useState(false);

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
      setIsLoggingIn(true);
      const result = await signInWithPopup(auth, googleProvider);
      const token = await result.user.getIdToken();
      
      const res = await api.post('/api/auth/firebase-login', { token });
      
      if (res.success) {
        login(res.data.token, res.data.user);
        router.push('/predictions');
      }
    } catch (err) {
      setError(err.data?.message || err.message || 'Failed to login with Google.');
      // If there's an error, sign out from firebase client side so they can try again or sign up
      auth.signOut().catch(()=> {});
    } finally {
      setIsLoggingIn(false);
    }
  };

  if (loading) {
    return <div className="loading-page"><div className="spinner spinner-lg"></div></div>;
  }

  return (
    <>
      <div className="auth-page">
        <div className="auth-card" style={{ maxWidth: 450, margin: '40px auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 'var(--space-6)' }}>
            <h1 style={{ marginBottom: 'var(--space-2)' }}>{t('login_title') || 'Welcome Back'}</h1>
            <p style={{ color: 'var(--color-text-muted)' }}>{t('login_subtitle') || 'Log in to continue your predictions'}</p>
          </div>

          {error && <div className="alert alert-error">{error}</div>}

          <button 
            type="button" 
            className="btn btn-secondary" 
            onClick={handleGoogleLogin}
            disabled={isLoggingIn}
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', padding: '12px' }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            {isLoggingIn ? 'Logging in...' : (t('login_google') || 'Log in with Google')}
          </button>
          
          <div style={{ textAlign: 'center', marginTop: 'var(--space-6)', fontSize: '0.95rem' }}>
            <span style={{ color: 'var(--color-text-muted)' }}>Don't have an account? </span>
            <Link href="/signup" style={{ color: 'var(--color-primary-red)', fontWeight: 'bold' }}>Sign up</Link>
          </div>
        </div>
      </div>
    </>
  );
}
