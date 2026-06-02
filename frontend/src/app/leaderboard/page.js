'use client';
import { useEffect, useState } from 'react';
import api from '@/lib/api';
import Footer from '@/components/layout/Footer';

export default function LeaderboardPage() {
  const [leaders, setLeaders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

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

  return (
    <>
      <div className="container" style={{ padding: 'var(--space-8) var(--space-6)' }}>
        <div className="section-header" style={{ marginBottom: 'var(--space-6)' }}>
          <h1>Leaderboard</h1>
          <p>Top predictors ranked by total points earned</p>
        </div>

        <div style={{ maxWidth: 400, margin: '0 auto var(--space-6)' }}>
          <input className="form-input" placeholder="Search players..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>

        {loading ? (
          <div className="loading-page">
            <div className="spinner spinner-lg" style={{ color: 'var(--color-gold)' }} />
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 'var(--space-12)', color: 'var(--color-text-muted)' }}>
            <p>No predictions submitted yet. Be the first to fill your bracket.</p>
          </div>
        ) : (
          <div className="card" style={{ overflow: 'auto' }}>
            <table className="leaderboard-table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Player</th>
                  <th>Team</th>
                  <th>Correct</th>
                  <th style={{ textAlign: 'right' }}>Points</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((user, i) => (
                  <tr key={user.id}>
                    <td>
                      <span className={`rank-badge ${user.rank <= 3 ? `rank-${user.rank}` : ''}`}
                        style={user.rank > 3 ? { background: 'var(--color-surface-light)', color: 'var(--color-text-muted)' } : {}}>
                        {user.rank}
                      </span>
                    </td>
                    <td style={{ fontWeight: 600 }}>{user.full_name}</td>
                    <td>
                      {user.favorite_team_flag && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                          <img src={user.favorite_team_flag} alt={user.favorite_team_name || ''} className="team-flag-sm" />
                          <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--fs-xs)' }}>{user.favorite_team_name}</span>
                        </div>
                      )}
                    </td>
                    <td>{user.correct_predictions || 0}</td>
                    <td style={{ textAlign: 'right' }}>
                      <span className="points-display">{user.total_points}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <Footer />
    </>
  );
}
