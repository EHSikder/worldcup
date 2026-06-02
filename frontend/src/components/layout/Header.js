'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';

function TrophyIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width="32" height="32">
      <path d="M19 5h-2V3H7v2H5c-1.1 0-2 .9-2 2v1c0 2.55 1.92 4.63 4.39 4.94.63 1.5 1.98 2.63 3.61 2.96V19H7v2h10v-2h-4v-3.1c1.63-.33 2.98-1.46 3.61-2.96C19.08 12.63 21 10.55 21 8V7c0-1.1-.9-2-2-2zM5 8V7h2v3.82C5.84 10.4 5 9.3 5 8zm14 0c0 1.3-.84 2.4-2 2.82V7h2v1z"/>
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="24" height="24">
      <path d="M3 12h18M3 6h18M3 18h18" strokeLinecap="round"/>
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="24" height="24">
      <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round"/>
    </svg>
  );
}

export default function Header() {
  const { user, isAuthenticated, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="header">
      <div className="header-inner">
        <Link href="/" className="header-logo">
          {/* Placeholder for R-BUILD Primary Logo */}
          <img src="/images/rbuild-logo.png" alt="R-BUILD Logo" width="120" height="40" style={{ objectFit: 'contain' }} onError={(e) => { e.target.style.display = 'none'; if (e.target.nextSibling) e.target.nextSibling.style.display = 'block'; }} />
          <span style={{ display: 'none', fontStyle: 'italic', fontWeight: '900', letterSpacing: '-1px' }}>R BUILD</span>
        </Link>

        <nav className="header-nav">
          <Link href="/">Home</Link>
          <Link href="/bracket">Bracket</Link>
          <Link href="/leaderboard">Leaderboard</Link>
        </nav>

        <div className="header-actions">
          {isAuthenticated ? (
            <>
              <Link href="/profile" className="btn btn-ghost btn-sm" style={{ color: 'var(--color-gold)' }}>
                {user?.full_name}
              </Link>
              <button className="btn btn-ghost btn-sm" onClick={logout}>
                Logout
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="btn btn-ghost btn-sm">Login</Link>
              <Link href="/register" className="btn btn-primary btn-sm">Sign Up</Link>
            </>
          )}
          <button className="mobile-menu-btn" onClick={() => setMobileOpen(true)} aria-label="Open menu">
            <MenuIcon />
          </button>
        </div>
      </div>

      {mobileOpen && (
        <>
          <div className="mobile-nav-overlay" onClick={() => setMobileOpen(false)} />
          <div className="mobile-nav">
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
              <button className="mobile-menu-btn" onClick={() => setMobileOpen(false)} aria-label="Close menu">
                <CloseIcon />
              </button>
            </div>
            <Link href="/" onClick={() => setMobileOpen(false)}>Home</Link>
            <Link href="/bracket" onClick={() => setMobileOpen(false)}>Bracket</Link>
            <Link href="/leaderboard" onClick={() => setMobileOpen(false)}>Leaderboard</Link>
            {isAuthenticated ? (
              <>
                <Link href="/profile" onClick={() => setMobileOpen(false)}>My Profile</Link>
                <button
                  onClick={() => { logout(); setMobileOpen(false); }}
                  style={{ padding: '0.75rem 1rem', color: 'var(--color-primary-red)', background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer', fontSize: '1.125rem', fontFamily: 'var(--font-body)' }}
                >
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link href="/login" onClick={() => setMobileOpen(false)}>Login</Link>
                <Link href="/register" onClick={() => setMobileOpen(false)}>Sign Up</Link>
              </>
            )}
          </div>
        </>
      )}
    </header>
  );
}
