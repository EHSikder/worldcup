'use client';
import { useState, useEffect } from 'react';
import api from '@/lib/api';

function StatCard({ value, label, color }) {
  return (
    <div className="stat-card">
      <div className="stat-card-value" style={color ? { color } : {}}>{value}</div>
      <div className="stat-card-label">{label}</div>
    </div>
  );
}

/* ═══════ ADMIN LOGIN ═══════ */
function AdminLogin({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await api.post('/api/admin/login', { username, password });
      localStorage.setItem('wc2026_admin_token', res.data.token);
      onLogin(res.data.admin);
    } catch (err) {
      setError(err.message || 'Invalid credentials or access denied');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="card card-elevated" style={{ width: '100%', maxWidth: 420, padding: 'var(--space-8)' }}>
        <div style={{ textAlign: 'center', marginBottom: 'var(--space-6)' }}>
          <svg viewBox="0 0 24 24" fill="var(--color-primary-red)" width="44" height="44" style={{ margin: '0 auto var(--space-3)' }}>
            <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"/>
          </svg>
          <h2 style={{ marginBottom: 'var(--space-1)' }}>Admin Panel</h2>
          <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--fs-sm)' }}>WC2026 Predictor Administration</p>
        </div>
        {error && (
          <div style={{ padding: 'var(--space-3)', background: 'rgba(255,68,68,0.1)', border: '1px solid rgba(255,68,68,0.3)', borderRadius: 'var(--radius-md)', color: 'var(--color-error)', fontSize: 'var(--fs-sm)', marginBottom: 'var(--space-4)' }}>
            {error}
          </div>
        )}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Admin Username</label>
            <input className="form-input" type="text" value={username} onChange={e => setUsername(e.target.value)} placeholder="admin" autoComplete="username" />
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input className="form-input" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter admin password" autoComplete="current-password" />
          </div>
          <button type="submit" className="btn btn-primary btn-lg" disabled={loading} style={{ width: '100%' }}>
            {loading ? <span className="spinner" /> : 'Login to Admin'}
          </button>
        </form>
      </div>
    </div>
  );
}

/* ═══════ MAIN ADMIN PANEL ═══════ */
export default function AdminPage() {
  const [admin, setAdmin] = useState(null);
  const [stats, setStats] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('wc2026_admin_token');
    if (token) {
      loadStats().then(() => setAdmin({ email: 'admin' })).catch(() => {
        localStorage.removeItem('wc2026_admin_token');
        setLoading(false);
      });
    } else {
      setLoading(false);
    }
  }, []);

  const loadStats = async () => {
    const res = await api.get('/api/admin/stats', { adminAuth: true });
    setStats(res.data);
    setLoading(false);
  };

  const handleLogout = () => {
    localStorage.removeItem('wc2026_admin_token');
    setAdmin(null);
    setStats(null);
  };

  if (loading) return <div className="loading-page"><div className="spinner spinner-lg" style={{ color: 'var(--color-gold)' }} /></div>;
  if (!admin) return <AdminLogin onLogin={(a) => { setAdmin(a); loadStats(); }} />;

  const tabs = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'users', label: 'Users' },
    { id: 'leaderboard', label: 'Leaderboard' },
    { id: 'bracket', label: 'Bracket Control' },
    { id: 'teams', label: 'Teams' },
  ];

  return (
    <div className="admin-layout">
      {/* Sidebar */}
      <aside className="admin-sidebar">
        <div style={{ marginBottom: 'var(--space-6)' }}>
          <h3 style={{ fontSize: 'var(--fs-lg)', marginBottom: 'var(--space-1)' }}>Admin Panel</h3>
          <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-muted)' }}>{admin.email || admin.full_name}</p>
        </div>
        <nav className="admin-sidebar-nav">
          {tabs.map(tab => (
            <button key={tab.id} className={`admin-sidebar-link ${activeTab === tab.id ? 'active' : ''}`} onClick={() => setActiveTab(tab.id)}>
              {tab.label}
            </button>
          ))}
          <button className="admin-sidebar-link" onClick={handleLogout} style={{ marginTop: 'var(--space-8)', color: 'var(--color-error)' }}>
            Logout
          </button>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="admin-main">
        {activeTab === 'dashboard' && <DashboardTab stats={stats} onRefresh={loadStats} />}
        {activeTab === 'users' && <UsersTab />}
        {activeTab === 'leaderboard' && <AdminLeaderboardTab />}
        {activeTab === 'bracket' && <BracketControlTab />}
        {activeTab === 'teams' && <TeamsTab />}
      </main>
    </div>
  );
}

/* ═══════════════════════════════════
   TAB: DASHBOARD
   ═══════════════════════════════════ */
function DashboardTab({ stats, onRefresh }) {
  const [syncing, setSyncing] = useState(false);

  const triggerSync = async () => {
    setSyncing(true);
    try {
      await api.post('/api/admin/trigger-sync', {}, { adminAuth: true });
      setTimeout(onRefresh, 3000);
    } catch (err) { alert('Sync failed: ' + err.message); }
    setSyncing(false);
  };

  return (
    <div>
      <div className="admin-header">
        <h2>Dashboard</h2>
        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <button className="btn btn-secondary btn-sm" onClick={triggerSync} disabled={syncing}>
            {syncing ? <><span className="spinner" style={{ width: 14, height: 14 }} /> Syncing...</> : 'Sync API-Football'}
          </button>
          <button className="btn btn-ghost btn-sm" onClick={onRefresh}>Refresh</button>
        </div>
      </div>
      <div className="stats-grid">
        <StatCard value={stats?.total_users || 0} label="Total Users" />
        <StatCard value={stats?.verified_users || 0} label="Verified Users" color="var(--color-green)" />
        <StatCard value={stats?.predicting_users || 0} label="Brackets Submitted" color="var(--color-gold)" />
        <StatCard value={stats?.total_predictions || 0} label="Individual Picks" />
        <StatCard value={stats?.finished_knockout_matches || 0} label="Matches Finished" />
        <StatCard value={stats?.live_matches?.length || 0} label="Live Now" color="var(--color-primary-red)" />
      </div>

      {/* Live Matches */}
      {stats?.live_matches?.length > 0 && (
        <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
          <h3 style={{ marginBottom: 'var(--space-4)', fontSize: 'var(--fs-lg)', color: 'var(--color-primary-red)' }}>Live Matches</h3>
          {stats.live_matches.map(m => (
            <div key={m.match_number} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--space-3)', borderBottom: '1px solid var(--color-border)' }}>
              <span style={{ fontSize: 'var(--fs-sm)' }}>Match {m.match_number} — {m.round}</span>
              <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 700 }}>{m.home_score} - {m.away_score}</span>
              <span className="badge badge-red">{m.status}</span>
            </div>
          ))}
        </div>
      )}

      {/* Upcoming Matches */}
      {stats?.upcoming_matches?.length > 0 && (
        <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
          <h3 style={{ marginBottom: 'var(--space-4)', fontSize: 'var(--fs-lg)' }}>Next Upcoming Matches</h3>
          {stats.upcoming_matches.map(m => (
            <div key={m.match_number} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--space-3)', borderBottom: '1px solid var(--color-border)' }}>
              <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 600 }}>M{m.match_number}</span>
              <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-muted)' }}>{m.home_placeholder} vs {m.away_placeholder}</span>
              <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-muted)' }}>{m.kickoff_time ? new Date(m.kickoff_time).toLocaleDateString() : 'TBD'}</span>
            </div>
          ))}
        </div>
      )}

      {/* Last Sync */}
      {stats?.last_sync && (
        <div className="card">
          <h3 style={{ marginBottom: 'var(--space-4)', fontSize: 'var(--fs-lg)' }}>Last API Sync</h3>
          <div style={{ display: 'grid', gap: 'var(--space-2)', fontSize: 'var(--fs-sm)', color: 'var(--color-text-muted)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Status</span>
              <span className={`badge ${stats.last_sync.status === 'completed' ? 'badge-green' : 'badge-red'}`}>{stats.last_sync.status}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Time</span>
              <span style={{ color: 'var(--color-white)' }}>{new Date(stats.last_sync.started_at).toLocaleString()}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Matches Updated</span>
              <span style={{ color: 'var(--color-white)' }}>{stats.last_sync.matches_updated || 0}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════
   TAB: USERS
   ═══════════════════════════════════ */

/* ═══════════════════════════════════
   TAB: USERS
   ═══════════════════════════════════ */
function UsersTab() {
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({});
  const [selectedUser, setSelectedUser] = useState(null);
  const [userPreds, setUserPreds] = useState(null);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const q = search ? `&search=${encodeURIComponent(search)}` : '';
      const res = await api.get(`/api/admin/users?page=${page}&limit=20${q}`, { adminAuth: true });
      setUsers(res.data || []);
      setPagination(res.pagination || {});
    } catch { /* ignore */ }
    setLoading(false);
  };

  useEffect(() => { fetchUsers(); }, [page]);

  useEffect(() => {
    const t = setTimeout(() => { setPage(1); fetchUsers(); }, 400);
    return () => clearTimeout(t);
  }, [search]);

  const viewPredictions = async (user) => {
    setSelectedUser(user);
    try {
      const res = await api.get(`/api/admin/users/${user.id}/predictions`, { adminAuth: true });
      setUserPreds(res.data);
    } catch { setUserPreds(null); }
  };

  const [banTarget, setBanTarget] = useState(null);
  const [banLoading, setBanLoading] = useState(false);

  const handleBan = async () => {
    if (!banTarget) return;
    setBanLoading(true);
    try {
      await api.post(`/api/admin/users/${banTarget.id}/ban`, {
        is_banned: !banTarget.is_banned
      }, { adminAuth: true });
      setBanTarget(null);
      fetchUsers();
    } catch (err) {
      alert('Action failed: ' + (err.message || 'Unknown error'));
    }
    setBanLoading(false);
  };

  const handleExport = async (format) => {
    try {
      const res = await api.request(`/api/admin/export?type=users&format=${format}`, { adminAuth: true });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `wc2026_users.${format}`; a.click();
      URL.revokeObjectURL(url);
    } catch (err) { alert('Export failed: ' + err.message); }
  };

  return (
    <div>
      <div className="admin-header">
        <h2>Users ({pagination.total || 0})</h2>
        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <button className="btn btn-secondary btn-sm" onClick={() => handleExport('csv')}>⬇ CSV</button>
          <button className="btn btn-secondary btn-sm" onClick={() => handleExport('xlsx')}>⬇ XLSX</button>
        </div>
      </div>

      <div style={{ marginBottom: 'var(--space-4)' }}>
        <input className="form-input" placeholder="Search by name, display name, email, or mobile..." value={search} onChange={e => setSearch(e.target.value)} style={{ maxWidth: 420 }} />
      </div>

      {loading ? (
        <div className="loading-page" style={{ minHeight: '20vh' }}><div className="spinner spinner-lg" style={{ color: 'var(--color-gold)' }} /></div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Full Name</th>
                <th>Display Name</th>
                <th>Company</th>
                <th>Email</th>
                <th>Mobile</th>
                <th>Civil ID</th>
                <th>Heard Via</th>
                <th>Status</th>
                <th>Points</th>
                <th>Joined</th>
                <th>Banned</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id}>
                  <td style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{u.full_name}</td>
                  <td style={{ color: 'var(--color-text-muted)', fontSize: 'var(--fs-xs)', whiteSpace: 'nowrap' }}>
                    {u.display_name || <span style={{ opacity: 0.4 }}>—</span>}
                  </td>
                  <td style={{ color: 'var(--color-text-muted)', fontSize: 'var(--fs-xs)', whiteSpace: 'nowrap' }}>
                    {u.company_name || <span style={{ opacity: 0.4 }}>—</span>}
                  </td>
                  <td style={{ color: 'var(--color-text-muted)', fontSize: 'var(--fs-xs)' }}>{u.email}</td>
                  <td style={{ color: 'var(--color-text-muted)', fontSize: 'var(--fs-xs)', whiteSpace: 'nowrap' }}>{u.mobile_number}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: 'var(--fs-xs)' }}>
                    {u.civil_id || <span style={{ opacity: 0.4 }}>—</span>}
                  </td>
                  <td style={{ fontSize: 'var(--fs-xs)', maxWidth: 120, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={u.hear_about_us}>
                    {u.hear_about_us || <span style={{ opacity: 0.4 }}>—</span>}
                  </td>
                  <td>
                    <span className={`badge ${u.has_submitted_prediction ? 'badge-green' : 'badge-muted'}`}>
                      {u.has_submitted_prediction ? 'Submitted' : 'Pending'}
                    </span>
                  </td>
                  <td><span className="points-display" style={{ fontSize: 'var(--fs-sm)' }}>{u.total_points || 0}</span></td>
                  <td style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>{new Date(u.created_at).toLocaleDateString()}</td>
                  <td>
                    {u.is_banned && (
                      <span className="badge badge-red" style={{ fontSize: '0.7rem' }}>Banned</span>
                    )}
                  </td>
                  <td style={{ display: 'flex', gap: 4 }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => viewPredictions(u)}>View</button>
                    <button
                      className="btn btn-sm"
                      onClick={() => setBanTarget(u)}
                      style={{
                        background: u.is_banned ? 'rgba(0,200,100,0.1)' : 'rgba(228,0,43,0.1)',
                        border: u.is_banned ? '1px solid rgba(0,200,100,0.4)' : '1px solid rgba(228,0,43,0.4)',
                        color: u.is_banned ? '#00c864' : '#E4002B',
                        fontWeight: 600, fontSize: '0.78rem', padding: '4px 10px'
                      }}
                    >
                      {u.is_banned ? 'Unban' : 'Ban'}
                    </button>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr><td colSpan={11} style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: 'var(--space-8)' }}>No users found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {pagination.pages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 'var(--space-2)', marginTop: 'var(--space-4)' }}>
          <button className="btn btn-ghost btn-sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</button>
          <span style={{ padding: 'var(--space-2) var(--space-4)', fontSize: 'var(--fs-sm)', color: 'var(--color-text-muted)' }}>Page {page} of {pagination.pages}</span>
          <button className="btn btn-ghost btn-sm" disabled={page >= pagination.pages} onClick={() => setPage(p => p + 1)}>Next</button>
        </div>
      )}

      {/* Ban / Unban Confirmation Modal */}
      {banTarget && (
        <div className="modal-backdrop" onClick={() => setBanTarget(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 440 }}>
            <div className="modal-header">
              <h3>{banTarget.is_banned ? 'Unban User' : 'Ban User'}</h3>
              <button className="modal-close" onClick={() => setBanTarget(null)}>&times;</button>
            </div>
            <div className="modal-body">
              <p style={{ marginBottom: 'var(--space-4)', color: 'var(--color-text-muted)' }}>
                {banTarget.is_banned
                  ? <>Are you sure you want to <strong style={{ color: '#00c864' }}>unban</strong> <strong>{banTarget.full_name}</strong>? They will be able to sign in again.</>
                  : <>Are you sure you want to <strong style={{ color: '#E4002B' }}>ban</strong> <strong>{banTarget.full_name}</strong>? They will be blocked from signing in. Their Firebase account remains intact.</>
                }
              </p>
              <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
                <button className="btn btn-secondary btn-sm" onClick={() => setBanTarget(null)}>Cancel</button>
                <button
                  className="btn btn-sm"
                  onClick={handleBan}
                  disabled={banLoading}
                  style={{
                    background: banTarget.is_banned ? 'rgba(0,200,100,0.15)' : 'rgba(228,0,43,0.15)',
                    border: banTarget.is_banned ? '1px solid #00c864' : '1px solid #E4002B',
                    color: banTarget.is_banned ? '#00c864' : '#E4002B',
                    fontWeight: 700
                  }}
                >
                  {banLoading ? '...' : banTarget.is_banned ? 'Yes, Unban' : 'Yes, Ban User'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* User Predictions Modal */}
      {selectedUser && (
        <div className="modal-backdrop" onClick={() => { setSelectedUser(null); setUserPreds(null); }}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 640 }}>
            <div className="modal-header">
              <div>
                <h3>{selectedUser.full_name}</h3>
                {selectedUser.display_name && (
                  <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-muted)', marginTop: 2 }}>
                    Display: <strong>{selectedUser.display_name}</strong>
                    {selectedUser.company_name && <> · {selectedUser.company_name}</>}
                  </div>
                )}
              </div>
              <button className="modal-close" onClick={() => { setSelectedUser(null); setUserPreds(null); }}>&times;</button>
            </div>
            <div className="modal-body">
              {/* User detail strip */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)', marginBottom: 'var(--space-4)', padding: 'var(--space-3)', background: 'var(--color-surface-dark)', borderRadius: 'var(--radius-md)', fontSize: 'var(--fs-xs)', color: 'var(--color-text-muted)' }}>
                {selectedUser.email && <span>📧 {selectedUser.email}</span>}
                {selectedUser.mobile_number && <span>📱 {selectedUser.mobile_number}</span>}
                {selectedUser.civil_id && <span>🪪 {selectedUser.civil_id}</span>}
                {selectedUser.hear_about_us && <span>💬 {selectedUser.hear_about_us}</span>}
              </div>

              {!userPreds ? (
                <div className="loading-page" style={{ minHeight: '10vh' }}><div className="spinner" style={{ color: 'var(--color-gold)' }} /></div>
              ) : (
                <>
                  <div style={{ marginBottom: 'var(--space-4)', display: 'flex', gap: 'var(--space-4)' }}>
                    <div className="stat-card" style={{ flex: 1 }}>
                      <div className="stat-card-value" style={{ fontSize: 'var(--fs-2xl)' }}>{userPreds.user?.total_points || 0}</div>
                      <div className="stat-card-label">Points</div>
                    </div>
                    <div className="stat-card" style={{ flex: 1 }}>
                      <div className="stat-card-value" style={{ fontSize: 'var(--fs-2xl)' }}>{userPreds.predictions?.length || 0}</div>
                      <div className="stat-card-label">Predictions</div>
                    </div>
                  </div>
                  {userPreds.champion_prediction && (
                    <div style={{ marginBottom: 'var(--space-4)', padding: 'var(--space-3)', background: 'rgba(212,168,67,0.1)', border: '1px solid rgba(212,168,67,0.3)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                      <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-gold)', textTransform: 'uppercase', fontWeight: 600 }}>Champion Pick:</span>
                      {userPreds.champion_prediction.predicted_champion && (
                        <>
                          <img src={userPreds.champion_prediction.predicted_champion.flag_url} className="team-flag-sm" alt="" />
                          <span style={{ fontWeight: 600, fontSize: 'var(--fs-sm)' }}>{userPreds.champion_prediction.predicted_champion.name}</span>
                        </>
                      )}
                    </div>
                  )}
                  <div style={{ maxHeight: 400, overflowY: 'auto' }}>
                    {userPreds.predictions?.map(p => (
                      <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--space-2) 0', borderBottom: '1px solid var(--color-border)', fontSize: 'var(--fs-sm)' }}>
                        <span style={{ color: 'var(--color-text-muted)', minWidth: 50 }}>M{p.match_number}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flex: 1 }}>
                          {p.predicted_winner && (
                            <>
                              <img src={p.predicted_winner.flag_url} className="team-flag-sm" alt="" />
                              <span>{p.predicted_winner.name}</span>
                            </>
                          )}
                        </div>
                        {p.predicted_home_score != null && (
                          <span className="badge badge-muted">{p.predicted_home_score}-{p.predicted_away_score}</span>
                        )}
                        <span className="points-display" style={{ fontSize: 'var(--fs-sm)', minWidth: 50, textAlign: 'right' }}>
                          {p.points_earned > 0 ? `+${p.points_earned}` : '-'}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


/* ═══════════════════════════════════
   TAB: LEADERBOARD
   ═══════════════════════════════════ */
function AdminLeaderboardTab() {
  const [leaders, setLeaders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/api/leaderboard?limit=100').then(res => setLeaders(res.data || [])).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const handleExport = async (format) => {
    try {
      const res = await api.request(`/api/admin/export?type=leaderboard&format=${format}`, { adminAuth: true });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `wc2026_leaderboard.${format}`; a.click();
      URL.revokeObjectURL(url);
    } catch (err) { alert('Export failed: ' + err.message); }
  };

  return (
    <div>
      <div className="admin-header">
        <h2>Leaderboard</h2>
        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <button className="btn btn-secondary btn-sm" onClick={() => handleExport('csv')}>CSV</button>
          <button className="btn btn-secondary btn-sm" onClick={() => handleExport('xlsx')}>XLSX</button>
        </div>
      </div>
      {loading ? (
        <div className="loading-page" style={{ minHeight: '20vh' }}><div className="spinner spinner-lg" style={{ color: 'var(--color-gold)' }} /></div>
      ) : (
        <table className="data-table">
          <thead><tr><th>Rank</th><th>Player</th><th>Correct</th><th>Points</th></tr></thead>
          <tbody>
            {leaders.map(u => (
              <tr key={u.id}>
                <td>
                  <span className={`rank-badge ${u.rank <= 3 ? `rank-${u.rank}` : ''}`} style={u.rank > 3 ? { background: 'var(--color-surface-light)', color: 'var(--color-text-muted)' } : {}}>
                    {u.rank}
                  </span>
                </td>
                <td style={{ fontWeight: 600 }}>{u.full_name}</td>
                <td>{u.correct_predictions || 0}</td>
                <td><span className="points-display">{u.total_points}</span></td>
              </tr>
            ))}
            {leaders.length === 0 && <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: 'var(--space-8)' }}>No data yet</td></tr>}
          </tbody>
        </table>
      )}
    </div>
  );
}

/* ═══════════════════════════════════
   TAB: BRACKET CONTROL
   ═══════════════════════════════════ */
function BracketControlTab() {
  const [locks, setLocks] = useState([]);
  const [syncLogs, setSyncLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      const [locksRes, syncRes] = await Promise.all([
        api.get('/api/admin/bracket-locks', { adminAuth: true }),
        api.get('/api/admin/sync-status?limit=10', { adminAuth: true }),
      ]);
      setLocks(locksRes.data || []);
      setSyncLogs(syncRes.data || []);
    } catch { /* ignore */ }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const toggleLock = async (round, currentState) => {
    try {
      await api.post('/api/admin/lock-round', { round, is_locked: !currentState }, { adminAuth: true });
      loadData();
    } catch (err) { alert('Failed: ' + err.message); }
  };

  const roundLabels = {
    round_of_32: 'Round of 32',
    round_of_16: 'Round of 16',
    quarterfinal: 'Quarterfinals',
    semifinal: 'Semifinals',
    third_place: 'Third Place',
    final: 'Final',
  };

  if (loading) return <div className="loading-page" style={{ minHeight: '30vh' }}><div className="spinner spinner-lg" style={{ color: 'var(--color-gold)' }} /></div>;

  return (
    <div>
      <div className="admin-header">
        <h2>Bracket Control</h2>
      </div>

      {/* Round Locks */}
      <h3 style={{ marginBottom: 'var(--space-4)', fontSize: 'var(--fs-lg)' }}>Round Locks</h3>
      <p style={{ marginBottom: 'var(--space-4)', fontSize: 'var(--fs-sm)', color: 'var(--color-text-muted)' }}>
        Locking a round prevents users from editing predictions for that round. Predictions are auto-locked when matches start.
      </p>
      <div className="card" style={{ marginBottom: 'var(--space-8)' }}>
        {locks.map(lock => (
          <div key={lock.round} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--space-4)', borderBottom: '1px solid var(--color-border)' }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 'var(--fs-sm)' }}>{roundLabels[lock.round] || lock.round}</div>
              {lock.locked_at && <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-muted)', marginTop: 2 }}>Locked at {new Date(lock.locked_at).toLocaleString()}</div>}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
              <span className={`badge ${lock.is_locked ? 'badge-red' : 'badge-green'}`}>{lock.is_locked ? 'Locked' : 'Open'}</span>
              <button className={`toggle ${lock.is_locked ? 'active' : ''}`} onClick={() => toggleLock(lock.round, lock.is_locked)} aria-label={`Toggle ${lock.round}`} />
            </div>
          </div>
        ))}
        {locks.length === 0 && <div style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--color-text-muted)' }}>No bracket lock records found</div>}
      </div>

      {/* Sync History */}
      <h3 style={{ marginBottom: 'var(--space-4)', fontSize: 'var(--fs-lg)' }}>API-Football Sync History</h3>
      <table className="data-table">
        <thead><tr><th>Started At</th><th>Completed</th><th>Status</th><th>Matches Updated</th><th>Predictions Locked</th></tr></thead>
        <tbody>
          {syncLogs.map(log => (
            <tr key={log.id}>
              <td style={{ fontSize: 'var(--fs-xs)' }}>{new Date(log.started_at).toLocaleString()}</td>
              <td style={{ fontSize: 'var(--fs-xs)' }}>{log.completed_at ? new Date(log.completed_at).toLocaleString() : '-'}</td>
              <td>
                <span className={`badge ${log.status === 'completed' ? 'badge-green' : log.status === 'failed' ? 'badge-red' : 'badge-gold'}`}>
                  {log.status}
                </span>
              </td>
              <td>{log.matches_updated || 0}</td>
              <td>{log.predictions_locked || 0}</td>
            </tr>
          ))}
          {syncLogs.length === 0 && <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: 'var(--space-6)' }}>No sync history</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

/* ═══════════════════════════════════
   TAB: TEAMS
   ═══════════════════════════════════ */
function TeamsTab() {
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', logo_url: '', flag_url: '' });

  useEffect(() => {
    api.get('/api/teams').then(res => setTeams(res.data || [])).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const startEdit = (team) => {
    setEditingId(team.id);
    setEditForm({ name: team.name, logo_url: team.logo_url || '', flag_url: team.flag_url || '' });
  };

  const saveEdit = async (id) => {
    try {
      const body = {};
      if (editForm.name) body.name = editForm.name;
      if (editForm.logo_url) body.logo_url = editForm.logo_url;
      if (editForm.flag_url) body.flag_url = editForm.flag_url;
      await api.put(`/api/admin/teams/${id}`, body, { adminAuth: true });
      setEditingId(null);
      const res = await api.get('/api/teams');
      setTeams(res.data || []);
    } catch (err) { alert('Update failed: ' + err.message); }
  };

  if (loading) return <div className="loading-page" style={{ minHeight: '30vh' }}><div className="spinner spinner-lg" style={{ color: 'var(--color-gold)' }} /></div>;

  const groups = [...new Set(teams.map(t => t.group_letter))].sort();

  return (
    <div>
      <div className="admin-header">
        <h2>Teams ({teams.length})</h2>
      </div>

      {groups.map(g => (
        <div key={g} style={{ marginBottom: 'var(--space-6)' }}>
          <h3 style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-primary-red)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 'var(--space-3)' }}>Group {g}</h3>
          <div className="card">
            {teams.filter(t => t.group_letter === g).map(team => (
              <div key={team.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--space-3) var(--space-4)', borderBottom: '1px solid var(--color-border)', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                {editingId === team.id ? (
                  <div style={{ width: '100%' }}>
                    <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-2)', flexWrap: 'wrap' }}>
                      <input className="form-input" placeholder="Team name" value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} style={{ flex: '1 1 150px' }} />
                      <input className="form-input" placeholder="Logo URL" value={editForm.logo_url} onChange={e => setEditForm(f => ({ ...f, logo_url: e.target.value }))} style={{ flex: '1 1 200px' }} />
                      <input className="form-input" placeholder="Flag URL" value={editForm.flag_url} onChange={e => setEditForm(f => ({ ...f, flag_url: e.target.value }))} style={{ flex: '1 1 200px' }} />
                    </div>
                    <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                      <button className="btn btn-primary btn-sm" onClick={() => saveEdit(team.id)}>Save</button>
                      <button className="btn btn-ghost btn-sm" onClick={() => setEditingId(null)}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flex: 1 }}>
                      <img src={team.flag_url} alt={team.name} className="team-flag" loading="lazy" />
                      <span style={{ fontWeight: 500, fontSize: 'var(--fs-sm)' }}>{team.name}</span>
                      <span className="badge badge-muted">{team.short_code}</span>
                    </div>
                    <button className="btn btn-ghost btn-sm" onClick={() => startEdit(team)}>Edit</button>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
