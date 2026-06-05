'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { auth, googleProvider } from '@/lib/firebase';
import { signInWithPopup, createUserWithEmailAndPassword, sendEmailVerification } from 'firebase/auth';
import api from '@/lib/api';
import Link from 'next/link';

export default function SignupPage() {
  const router = useRouter();
  const { user, isAuthenticated, loading } = useAuth();
  const [error, setError] = useState(null);
  const [banner, setBanner] = useState(null);
  const { t } = useLanguage();
  
  const [isSigningUp, setIsSigningUp] = useState(false);
  const [emailForm, setEmailForm] = useState({ email: '', password: '', confirmPassword: '' });
  const [isEmailSigningUp, setIsEmailSigningUp] = useState(false);
  const [verificationSent, setVerificationSent] = useState(false);
  const [checkingVerification, setCheckingVerification] = useState(false);
  const [pendingUser, setPendingUser] = useState(null);

  useEffect(() => {
    if (isAuthenticated && !loading) {
      if (!user?.full_name || !user?.favorite_team_id) {
        router.push('/complete-profile');
      } else {
        router.push('/predictions');
      }
    }
  }, [isAuthenticated, loading, user, router]);

  // Auto-dismiss banner
  useEffect(() => {
    if (banner) {
      const timer = setTimeout(() => setBanner(null), 6000);
      return () => clearTimeout(timer);
    }
  }, [banner]);

  const handleGoogleSignup = async () => {
    try {
      setError(null);
      setBanner(null);
      setIsSigningUp(true);
      const result = await signInWithPopup(auth, googleProvider);
      const token = await result.user.getIdToken();
      
      const res = await api.post('/api/auth/firebase-signup', { token });
      
      if (res.success && res.requiresProfileCompletion) {
        sessionStorage.setItem('temp_firebase_token', token);
        sessionStorage.setItem('temp_user_info', JSON.stringify(res.user));
        router.push('/complete-profile');
      }
    } catch (err) {
      const msg = err.data?.message || err.message || 'Failed to sign up with Google.';
      if (err.status === 409 || msg.includes('already exists') || msg.includes('log in')) {
        setBanner({ type: 'info', message: 'This email is already registered.', linkText: 'Log in instead', linkHref: '/login' });
      } else {
        setError(msg);
      }
      auth.signOut().catch(() => {});
    } finally {
      setIsSigningUp(false);
    }
  };

  const handleEmailSignup = async (e) => {
    e.preventDefault();
    setError(null);
    setBanner(null);

    if (!emailForm.email || !emailForm.password || !emailForm.confirmPassword) {
      setError('Please fill in all fields.');
      return;
    }
    if (emailForm.password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (emailForm.password !== emailForm.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    try {
      setIsEmailSigningUp(true);
      const result = await createUserWithEmailAndPassword(auth, emailForm.email, emailForm.password);
      
      // Send verification email with redirect URL back to our app
      const actionCodeSettings = {
        url: `${window.location.origin}/signup?verified=true&email=${encodeURIComponent(emailForm.email)}`,
        handleCodeInApp: false,
      };
      await sendEmailVerification(result.user, actionCodeSettings);
      
      setPendingUser(result.user);
      setVerificationSent(true);
    } catch (err) {
      const code = err.code || '';
      if (code === 'auth/email-already-in-use') {
        setBanner({ type: 'info', message: 'This email is already registered.', linkText: 'Try logging in', linkHref: '/login' });
      } else if (code === 'auth/weak-password') {
        setError('Password is too weak. Use at least 6 characters.');
      } else if (code === 'auth/invalid-email') {
        setError('Please enter a valid email address.');
      } else {
        setError(err.message || 'Sign up failed. Please try again.');
      }
      auth.signOut().catch(() => {});
    } finally {
      setIsEmailSigningUp(false);
    }
  };

  // Check if user clicked the verification link and came back
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('verified') === 'true') {
      // User came back after clicking verification link
      const email = params.get('email');
      if (email) {
        setVerificationSent(true);
        setBanner({ type: 'success', message: 'Email verified! Click "Continue" below to complete your signup.' });
      }
    }
  }, []);

  const handleContinueAfterVerification = useCallback(async () => {
    try {
      setCheckingVerification(true);
      setError(null);

      // Reload the user to check verification status
      const currentUser = auth.currentUser;
      if (currentUser) {
        await currentUser.reload();
        
        if (currentUser.emailVerified) {
          const token = await currentUser.getIdToken(true); // Force refresh token
          
          const res = await api.post('/api/auth/firebase-signup', { token });
          
          if (res.success && res.requiresProfileCompletion) {
            sessionStorage.setItem('temp_firebase_token', token);
            sessionStorage.setItem('temp_user_info', JSON.stringify(res.user));
            router.push('/complete-profile');
          }
        } else {
          setError('Email not yet verified. Please check your inbox and click the verification link, then try again.');
        }
      } else {
        // User not signed in (came from email link in different browser/session)
        setError('Please log in with your email and password to continue.');
        setVerificationSent(false);
      }
    } catch (err) {
      const msg = err.data?.message || err.message || '';
      if (err.status === 409 || msg.includes('already exists')) {
        setBanner({ type: 'info', message: 'Account already registered.', linkText: 'Log in instead', linkHref: '/login' });
      } else {
        setError(msg || 'Verification check failed. Please try again.');
      }
    } finally {
      setCheckingVerification(false);
    }
  }, [router]);

  const handleResendVerification = async () => {
    try {
      const currentUser = auth.currentUser;
      if (currentUser) {
        const actionCodeSettings = {
          url: `${window.location.origin}/signup?verified=true&email=${encodeURIComponent(currentUser.email)}`,
          handleCodeInApp: false,
        };
        await sendEmailVerification(currentUser, actionCodeSettings);
        setBanner({ type: 'success', message: 'Verification email resent! Check your inbox.' });
      } else {
        setError('No active session. Please sign up again.');
      }
    } catch (err) {
      if (err.code === 'auth/too-many-requests') {
        setError('Too many requests. Please wait a moment before trying again.');
      } else {
        setError('Failed to resend verification email.');
      }
    }
  };

  if (loading) {
    return <div className="loading-page"><div className="spinner spinner-lg"></div></div>;
  }

  // Verification waiting screen
  if (verificationSent) {
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
          <div className="auth-card" style={{ maxWidth: 480, margin: '40px auto', textAlign: 'center' }}>
            {/* Email icon */}
            <div style={{ marginBottom: 'var(--space-4)' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="var(--color-accent-blue)" strokeWidth="1.5" width="64" height="64" style={{ margin: '0 auto' }}>
                <path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <h1 style={{ marginBottom: 'var(--space-2)' }}>Verify Your Email</h1>
            <p style={{ color: 'var(--color-text-muted)', marginBottom: 'var(--space-6)', lineHeight: 1.6 }}>
              We've sent a verification email to <strong style={{ color: 'var(--color-text-primary)' }}>{pendingUser?.email || emailForm.email}</strong>. 
              Please check your inbox and click the verification link.
            </p>
            
            {error && <div className="alert alert-error" style={{ marginBottom: 'var(--space-4)', textAlign: 'left' }}>{error}</div>}

            <button 
              className="btn btn-primary" 
              onClick={handleContinueAfterVerification}
              disabled={checkingVerification}
              style={{ width: '100%', padding: '14px', marginBottom: 'var(--space-3)' }}
            >
              {checkingVerification ? 'Checking...' : "I've Verified My Email — Continue"}
            </button>

            <button 
              className="btn btn-ghost"
              onClick={handleResendVerification}
              style={{ width: '100%', padding: '10px', fontSize: 'var(--fs-sm)' }}
            >
              Resend Verification Email
            </button>

            <div style={{ marginTop: 'var(--space-4)', fontSize: 'var(--fs-sm)', color: 'var(--color-text-muted)' }}>
              <p>Didn't receive the email? Check your spam folder.</p>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      {/* Top Banner */}
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
        <div className="auth-card" style={{ maxWidth: 450, margin: '40px auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 'var(--space-6)' }}>
            <h1 style={{ marginBottom: 'var(--space-2)' }}>Create Account</h1>
            <p style={{ color: 'var(--color-text-muted)' }}>Join the challenge and predict the World Cup!</p>
          </div>

          {error && <div className="alert alert-error" style={{ marginBottom: 'var(--space-4)' }}>{error}</div>}

          {/* Google Signup */}
          <button 
            type="button" 
            className="btn btn-secondary" 
            onClick={handleGoogleSignup}
            disabled={isSigningUp}
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', padding: '12px' }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            {isSigningUp ? 'Signing up...' : 'Sign up with Google'}
          </button>

          {/* Divider */}
          <div className="auth-divider">
            <span>or</span>
          </div>

          {/* Email Signup Form */}
          <form onSubmit={handleEmailSignup}>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input 
                className="form-input" 
                type="email" 
                value={emailForm.email} 
                onChange={e => setEmailForm({ ...emailForm, email: e.target.value })}
                placeholder="Enter your email"
                autoComplete="email"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Password</label>
              <input 
                className="form-input" 
                type="password" 
                value={emailForm.password} 
                onChange={e => setEmailForm({ ...emailForm, password: e.target.value })}
                placeholder="At least 6 characters"
                autoComplete="new-password"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Confirm Password</label>
              <input 
                className="form-input" 
                type="password" 
                value={emailForm.confirmPassword} 
                onChange={e => setEmailForm({ ...emailForm, confirmPassword: e.target.value })}
                placeholder="Confirm your password"
                autoComplete="new-password"
              />
            </div>
            <button 
              type="submit" 
              className="btn btn-primary" 
              disabled={isEmailSigningUp}
              style={{ width: '100%', padding: '12px' }}
            >
              {isEmailSigningUp ? 'Creating account...' : 'Sign up with Email'}
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
