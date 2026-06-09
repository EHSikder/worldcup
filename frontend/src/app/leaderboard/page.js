'use client';
import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { useLanguage } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';

function getInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function getShortName(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0]}.`;
}

export default function LeaderboardPage() {
  const [leaders, setLeaders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const { t, locale } = useLanguage();
  const { user } = useAuth();

  const isArabic = locale === 'ar';

  const fetchLeaderboard = () => {
    api.get('/api/leaderboard?limit=200').then(res => {
      setLeaders(res.data || []);
    }).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchLeaderboard();
    const interval = setInterval(fetchLeaderboard, 60000);
    return () => clearInterval(interval);
  }, []);

  const filtered = leaders.filter(u =>
    u.full_name?.toLowerCase().includes(search.toLowerCase())
  );

  const sortedLeaders = [...filtered].sort((a, b) => a.rank - b.rank);
  const topThree = sortedLeaders.filter(u => u.rank <= 3);
  const restList = sortedLeaders.filter(u => u.rank > 3);
  const currentUser = user ? leaders.find(u => u.id === user.id) : null;

  const rank1 = topThree.find(u => u.rank === 1);
  const rank2 = topThree.find(u => u.rank === 2);
  const rank3 = topThree.find(u => u.rank === 3);

  const podiumStyles = {
    1: { bg: 'linear-gradient(180deg, #FFF8E1 0%, #FFD54F 100%)', border: '#FFD54F', color: '#D4A843', numBg: '#FFD54F', numColor: '#7A5A00' },
    2: { bg: 'linear-gradient(180deg, #FAFAFA 0%, #E0E0E0 100%)', border: '#E0E0E0', color: '#757575', numBg: '#E0E0E0', numColor: '#424242' },
    3: { bg: 'linear-gradient(180deg, #FFF3E0 0%, #FFCC80 100%)', border: '#FFCC80', color: '#BF7B3B', numBg: '#FFCC80', numColor: '#6D4C00' },
  };

  const renderPodiumCard = (userData, rank, isCenter) => {
    if (!userData) return <div style={{ flex: 1 }} />;
    const style = podiumStyles[rank];
    return (
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        marginTop: isCenter ? 0 : 24,
        position: 'relative'
      }}>
        {rank === 1 && (
          <div style={{ marginBottom: 4 }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M7 4V2H17V4H20C20.55 4 21 4.45 21 5V8C21 9.66 19.66 11 18 11H17.24C16.45 13.17 14.42 14.73 12 14.97V18H15V20H9V18H12V14.97C9.58 14.73 7.55 13.17 6.76 11H6C4.34 11 3 9.66 3 8V5C3 4.45 3.45 4 4 4H7ZM5 6V8C5 8.55 5.45 9 6 9H6.29C6.1 8.36 6 7.69 6 7V6H5ZM18 6H19V8C19 8.55 18.55 9 18 9H17.71C17.9 8.36 18 7.69 18 7V6ZM8 4V7C8 9.76 10.24 12 13 12H11C13.76 12 16 9.76 16 7V4H8Z" fill="#D4A843"/>
            </svg>
          </div>
        )}

        <div style={{
          width: isCenter ? 56 : 48,
          height: isCenter ? 56 : 48,
          borderRadius: '50%',
          background: style.numBg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 900,
          fontSize: isCenter ? '1.1rem' : '0.95rem',
          color: style.numColor,
          border: `3px solid white`,
          boxShadow: '0 3px 10px rgba(0,0,0,0.1)',
          marginBottom: 8
        }}>
          {getInitials(userData.full_name)}
        </div>

        <div style={{ fontWeight: 700, fontSize: isCenter ? '1rem' : '0.9rem', color: '#111827', textAlign: 'center', marginBottom: 2 }}>
          {getShortName(userData.full_name)}
        </div>

        <div style={{ fontWeight: 800, fontSize: isCenter ? '1.1rem' : '0.95rem', color: style.color, marginBottom: 8 }}>
          {userData.total_points} pts
        </div>

        <div style={{
          background: style.bg,
          borderRadius: '16px 16px 0 0',
          width: '100%',
          minHeight: isCenter ? 90 : 65,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: `1px solid ${style.border}`,
          borderBottom: 'none',
          position: 'relative'
        }}>
          <div style={{
            fontSize: isCenter ? '2.8rem' : '2.2rem',
            fontWeight: 900,
            color: style.numColor,
            opacity: 0.6,
            lineHeight: 1
          }}>
            {rank}
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <div className="container" style={{ padding: 'var(--space-6) var(--space-4)', minHeight: '80vh', maxWidth: 600, paddingBottom: currentUser ? 100 : 40 }}>
        <div style={{ marginBottom: 20 }}>
          <div
  style={{
    width: '100%',
    maxWidth: '600px',
    margin: '0 auto',
    overflow: 'hidden',
    borderRadius: 20,
    lineHeight: 0
  }}
>
            <picture>
              <source
                media="(max-width: 768px)"
                srcSet={
                  isArabic
                    ? '/images/leaderboard-banner-mobile-ar.webp'
                    : '/images/leaderboard-banner-mobile-en.webp'
                }
              />
              <source
                media="(min-width: 769px)"
                srcSet={
                  isArabic
                    ? '/images/leaderboard-banner-desktop-ar.webp'
                    : '/images/leaderboard-banner-desktop-en.webp'
                }
              />
              <img
  src={
    isArabic
      ? '/images/leaderboard-banner-desktop-ar.webp'
      : '/images/leaderboard-banner-desktop-en.webp'
  }
  alt="Leaderboard banner"
  width="600"
  height="132"
  style={{
    display: 'block',
    width: '100%',
    maxWidth: '600px',
    height: 'auto',
    margin: '0 auto'
  }}
/>
            </picture>
          </div>
        </div>

        <div style={{
          background: '#FFFFFF',
          borderRadius: 16,
          padding: '14px 18px',
          marginBottom: 20,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          border: '1px solid #F3F4F6',
          boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
        }}>
          <div style={{
            width: 40, height: 40, borderRadius: '50%',
            background: 'linear-gradient(135deg, #FFD700, #F7B731)',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 17.5L6 21L7.5 14.5L2 10H8.5L12 3L15.5 10H22L16.5 14.5L18 21L12 17.5Z" fill="#7A5A00" />
            </svg>
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#111827' }}>{t('lb_grand_champion_title')} <span style={{ fontWeight: 800, color: '#D4A843' }}>$1,000</span></div>
            <div style={{ fontSize: '0.8rem', color: '#9CA3AF', fontWeight: 500 }}>{t('lb_grand_champion_subtitle')}</div>
          </div>
        </div>

        <div style={{ marginBottom: 20 }}>
          <input
            className="form-input"
            placeholder={t('lb_search') || 'Search players...'}
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ borderRadius: 16, padding: '12px 18px', border: '1px solid #E5E7EB', fontSize: '0.95rem' }}
          />
        </div>

        {loading ? (
          <div className="loading-page">
            <div className="spinner spinner-lg" style={{ color: 'var(--color-gold)' }} />
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 'var(--space-12)', color: '#9CA3AF' }}>
            <p>{t('lb_empty') || 'No players found'}</p>
          </div>
        ) : (
          <div>
            {!search && topThree.length > 0 && (
              <div style={{
                display: 'flex',
                alignItems: 'flex-end',
                gap: 8,
                marginBottom: 24,
                padding: '0 8px',
                direction: 'ltr'
              }}>
                {renderPodiumCard(rank2, 2, false)}
                {renderPodiumCard(rank1, 1, true)}
                {renderPodiumCard(rank3, 3, false)}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(search ? sortedLeaders : restList).map((entry) => {
                const isCurrentUser = user && entry.id === user.id;
                return (
                  <div key={entry.id} style={{
                    background: isCurrentUser ? '#FEF2F2' : '#FFFFFF',
                    borderRadius: 16,
                    padding: '14px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    border: isCurrentUser ? '2px solid #EF4444' : '1px solid #F3F4F6',
                    transition: 'all 0.2s ease'
                  }}>
                    <div style={{
                      width: 32,
                      fontWeight: 900,
                      fontSize: '1.1rem',
                      color: isCurrentUser ? '#EF4444' : '#111827'
                    }}>
                      {entry.rank}
                    </div>

                    <div style={{
                      width: 36, height: 36, borderRadius: '50%',
                      background: isCurrentUser ? '#FEE2E2' : '#F3F4F6',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: 800, fontSize: '0.8rem',
                      color: isCurrentUser ? '#EF4444' : '#4B5563'
                    }}>
                      {getInitials(entry.full_name)}
                    </div>

                    <div style={{ flex: 1, fontWeight: 600, fontSize: '0.95rem', color: '#111827' }}>
                      {entry.full_name}
                      {isCurrentUser && <span style={{ color: '#EF4444', fontWeight: 500, fontSize: '0.85rem' }}> (You)</span>}
                    </div>

                    <div style={{
                      fontWeight: 900,
                      fontSize: '1.1rem',
                      color: isCurrentUser ? '#EF4444' : '#111827'
                    }}>
                      {entry.total_points} <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#9CA3AF' }}>pts</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {currentUser && !search && (
        <div style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 100,
          background: 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)',
          padding: '14px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          boxShadow: '0 -4px 20px rgba(0,0,0,0.15)',
          maxWidth: 600,
          margin: '0 auto',
          borderRadius: '20px 20px 0 0'
        }}>
          <div style={{ fontWeight: 900, fontSize: '1.3rem', color: 'white', minWidth: 30 }}>
            {currentUser.rank}
          </div>

          <div style={{
            width: 36, height: 36, borderRadius: '50%',
            background: 'rgba(255,255,255,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 800, fontSize: '0.8rem',
            color: 'white'
          }}>
            {getInitials(currentUser.full_name)}
          </div>

          <div style={{ flex: 1 }}>
            <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'white' }}>
              {getShortName(currentUser.full_name)}
            </span>
            <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.85rem', fontWeight: 500 }}> (You)</span>
          </div>

          <div style={{ textAlign: 'right' }}>
            <span style={{ fontWeight: 900, fontSize: '1.3rem', color: 'white' }}>{currentUser.total_points}</span>
            <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.7)', fontWeight: 600, marginLeft: 4 }}>pts</span>
          </div>
        </div>
      )}
    </>
  );
}
