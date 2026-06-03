'use client';
import { useEffect, useState } from 'react';
import api from '@/lib/api';
import Footer from '@/components/layout/Footer';
import { useLanguage } from '@/context/LanguageContext';

function BigRankIcon({ rank }) {
  const colors = {
    1: ['#FFD700', '#FDB931'], // Gold
    2: ['#E0E0E0', '#BDBDBD'], // Silver
    3: ['#CD7F32', '#A0522D'], // Bronze
  };
  const [light, dark] = colors[rank] || ['#939598', '#636568'];
  
  return (
    <div style={{
      width: 80, height: 80, borderRadius: '50%',
      background: `linear-gradient(135deg, ${light}, ${dark})`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: 'white', fontSize: 36, fontWeight: 'bold',
      boxShadow: '0 4px 10px rgba(0,0,0,0.15)',
      border: '4px solid white',
      marginBottom: 10,
      textShadow: '1px 1px 2px rgba(0,0,0,0.3)'
    }}>
      {rank}
    </div>
  );
}

export default function LeaderboardPage() {
  const [leaders, setLeaders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const { t, locale } = useLanguage();

  const fetchLeaderboard = () => {
    api.get('/api/leaderboard?limit=100').then(res => {
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

  // Podium order: Rank 2, Rank 1, Rank 3
  const rank1 = topThree.find(u => u.rank === 1) || topThree[0];
  const rank2 = topThree.find(u => u.rank === 2) || topThree[1];
  const rank3 = topThree.find(u => u.rank === 3) || topThree[2];

  const podiumData = [
    { user: rank2, rank: 2, height: 160 },
    { user: rank1, rank: 1, height: 220 },
    { user: rank3, rank: 3, height: 130 },
  ];

  return (
    <>
      <div className="container" style={{ padding: 'var(--space-8) var(--space-6)', minHeight: '80vh' }}>
        <div className="section-header" style={{ marginBottom: 'var(--space-6)' }}>
          <h1>{t('lb_title')}</h1>
          <p>{t('lb_subtitle')}</p>
        </div>

        <div style={{ maxWidth: 400, margin: '0 auto var(--space-6)' }}>
          <input className="form-input" placeholder={t('lb_search')} value={search} onChange={e => setSearch(e.target.value)} />
        </div>

        {loading ? (
          <div className="loading-page">
            <div className="spinner spinner-lg" style={{ color: 'var(--color-gold)' }} />
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 'var(--space-12)', color: 'var(--color-text-muted)' }}>
            <p>{t('lb_empty')}</p>
          </div>
        ) : (
          <div>
            {/* Podium for Top 3 */}
            {!search && topThree.length > 0 && (
              <div className="podium-container" style={{ direction: 'ltr' }}>
                {podiumData.map((item, idx) => {
                  if (!item.user) return <div key={idx} className="podium-column" style={{ opacity: 0 }} />;
                  return (
                    <div key={idx} className="podium-column">
                      <div className="podium-avatar" style={{ position: 'relative' }}>
                        {item.user.rank === 1 && (
                          <div style={{
                            position: 'absolute', top: -20, left: '50%', transform: 'translateX(-50%)',
                            background: 'var(--color-gold)', color: '#111', padding: '4px 10px', borderRadius: 12,
                            fontSize: '0.85rem', fontWeight: 'bold', boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
                            zIndex: 10, whiteSpace: 'nowrap', border: '1px solid #FFD700'
                          }}>
                            {locale === 'ar' ? 'جائزة 1000 دولار' : '$1000 Prize'}
                          </div>
                        )}
                        <BigRankIcon rank={item.user.rank} />
                        <div style={{ fontWeight: 'bold', fontSize: '1.1rem', textAlign: 'center', marginBottom: 10 }}>
                          {item.user.full_name}
                        </div>
                      </div>
                      <div className={`podium-box`} style={{ height: item.height }}>
                        <div style={{ fontSize: '1.5rem', fontWeight: 'bold', marginTop: 'var(--space-4)', color: 'var(--color-gold)' }}>
                          {item.user.total_points}
                        </div>
                        <div style={{ fontSize: '0.8rem', opacity: 0.8 }}>{t('lb_points')}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* List for Rest (or everyone if searching) */}
            {(search ? sortedLeaders : restList).length > 0 && (
              <div style={{ maxWidth: 800, margin: '0 auto' }}>
                <div className="leaderboard-list">
                  <div className="leaderboard-list-header">
                    <div style={{ width: 40 }}>{t('lb_col_rank')}</div>
                    <div style={{ flex: 1 }}>{t('lb_col_user')}</div>
                    <div className="hide-mobile" style={{ flex: 1 }}>{t('lb_col_team')}</div>
                    <div style={{ width: 80, textAlign: locale === 'ar' ? 'left' : 'right' }}>{t('lb_points')}</div>
                  </div>
                  
                  {(search ? sortedLeaders : restList).map((user) => (
                    <div className="leaderboard-row" key={user.id}>
                      <div style={{ width: 40, fontWeight: 'bold', color: 'var(--color-text-muted)' }}>{user.rank}</div>
                      <div style={{ flex: 1, fontWeight: 600 }}>{user.full_name}</div>
                      <div className="hide-mobile" style={{ flex: 1 }}>
                        {user.favorite_team_flag && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <img src={user.favorite_team_flag} alt={user.favorite_team_name || ''} style={{ width: 20, height: 15, borderRadius: 2 }} />
                            <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--fs-xs)' }}>{user.favorite_team_name}</span>
                          </div>
                        )}
                      </div>
                      <div style={{ width: 80, textAlign: locale === 'ar' ? 'left' : 'right', fontWeight: 'bold', color: 'var(--color-gold)' }}>
                        {user.total_points}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      <Footer />
    </>
  );
}
