'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import Footer from '@/components/layout/Footer';
import { useLanguage } from '@/context/LanguageContext';
import { auth, googleProvider } from '@/lib/firebase';
import { createUserWithEmailAndPassword, signInWithPopup } from 'firebase/auth';
import Link from 'next/link';

export default function SignupPage() {
  const router = useRouter();
  const { user, isAuthenticated, loading } = useAuth();
  const [error, setError] = useState(null);
  const { t } = useLanguage();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    if (isAuthenticated && !loading) {
      if (!user?.full_name || !user?.favorite_team_id) {
        router.push('/complete-profile');
      } else {
        router.push('/predictions');
      }
    }
  }, [isAuthenticated, loading, user, router]);

  const handleEmailSignup = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please provide an email and password.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    try {
      setError(null);
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const token = await userCredential.user.getIdToken();
      
      // Store token so complete-profile can use it
      sessionStorage.setItem('temp_firebase_token', token);
      sessionStorage.setItem('temp_user_info', JSON.stringify({ email }));
      
      router.push('/complete-profile');
    } catch (err) {
      if (err.code === 'auth/email-already-in-use') {
        setError('This email is already in use. Please log in.');
      } else {
        setError(err.message || 'Failed to sign up.');
      }
    }
  };

  const handleGoogleSignup = async () => {
    try {
      setError(null);
      const result = await signInWithPopup(auth, googleProvider);
      const token = await result.user.getIdToken();
      
      // We pass it to Firebase token login endpoint to see if it's new or existing.
      // But since this is signup, we can just send them to complete profile.
      // To be safe, let's just store token and go to complete-profile.
      sessionStorage.setItem('temp_firebase_token', token);
      sessionStorage.setItem('temp_user_info', JSON.stringify({
        email: result.user.email,
        name: result.user.displayName,
      }));
      router.push('/complete-profile');
    } catch (err) {
      setError(err.message || 'Failed to sign up with Google.');
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
            <h1 style={{ marginBottom: 'var(--space-2)' }}>Create Account</h1>
            <p style={{ color: 'var(--color-text-muted)' }}>Join the challenge and predict the World Cup!</p>
          </div>

          {error && <div className="alert alert-error">{error}</div>}

          <form onSubmit={handleEmailSignup} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input 
                type="email" 
                className="form-input" 
                placeholder="you@example.com" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            
            <div className="form-group">
              <label className="form-label">Password</label>
              <input 
                type="password" 
                className="form-input" 
                placeholder="••••••••" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '12px', fontSize: '1.1rem' }}>
              Sign Up
            </button>
          </form>

          <div style={{ display: 'flex', alignItems: 'center', margin: 'var(--space-4) 0', color: 'var(--color-text-muted)' }}>
            <div style={{ flex: 1, height: 1, background: 'var(--color-border)' }}></div>
            <span style={{ padding: '0 10px', fontSize: '0.9rem' }}>OR</span>
            <div style={{ flex: 1, height: 1, background: 'var(--color-border)' }}></div>
          </div>

          <button 
            type="button" 
            className="btn btn-secondary" 
            onClick={handleGoogleSignup}
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', padding: '12px' }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Continue with Google
          </button>
          
          <div style={{ textAlign: 'center', marginTop: 'var(--space-6)', fontSize: '0.95rem' }}>
            <span style={{ color: 'var(--color-text-muted)' }}>Already have an account? </span>
            <Link href="/login" style={{ color: 'var(--color-primary-red)', fontWeight: 'bold' }}>Log in</Link>
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
}
