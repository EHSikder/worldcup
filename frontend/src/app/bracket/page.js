'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';
import { BRACKET_FLOW, R32_MATCH_INFO, LEFT_BRACKET, RIGHT_BRACKET } from '@/lib/constants';

const STORAGE_KEY = 'wc2026_bracket_picks';
const EXPIRY_MS = 60 * 24 * 60 * 60 * 1000; // 2 months

function saveDraftToStorage(picks) {
  try {
    const serialized = {};
    for (const [mn, pick] of Object.entries(picks)) {
      serialized[mn] = {
        homeTeamId: pick.homeTeam?.id || null,
        awayTeamId: pick.awayTeam?.id || null,
        homeScore: pick.homeScore,
        awayScore: pick.awayScore,
        winnerId: pick.winner?.id || null,
        isLocked: pick.isLocked || false,
      };
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ picks: serialized, timestamp: Date.now(), expiry: Date.now() + EXPIRY_MS }));
  } catch { /* quota */ }
}

function loadDraftFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (data.expiry && Date.now() > data.expiry) { localStorage.removeItem(STORAGE_KEY); return null; }
    return data.picks || null;
  } catch { return null; }
}

/* ── Icons ─────────────────────── */
function SearchIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35" strokeLinecap="round"/></svg>;
}

/* ── Team Selector Modal ───────── */
function TeamSelectorModal({ teams, onSelect, onClose, title }) {
  const [search, setSearch] = useState('');
  const filtered = teams.filter(t => t.name.toLowerCase().includes(search.toLowerCase()));
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{title || 'Select Team'}</h3>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <div className="team-selector-search">
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }}><SearchIcon /></span>
            <input className="form-input" placeholder="Search teams..." value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: 36 }} autoFocus />
          </div>
        </div>
        <div className="team-selector-list">
          {filtered.length === 0 && <p style={{ padding: '1rem', color: 'var(--color-text-muted)', textAlign: 'center', fontSize: 'var(--fs-sm)' }}>No teams found</p>}
          {filtered.map(t => (
            <button key={t.id} className="team-selector-item" onClick={() => { onSelect(t); onClose(); }}>
              <img src={t.flag_url} alt={t.name} className="team-flag-sm" loading="lazy" />
              <span style={{ flex: 1, fontSize: 'var(--fs-sm)', fontWeight: 500 }}>{t.name}</span>
              <span className="team-selector-group">Group {t.group_letter}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Auto-compute winner from scores ── */
function computeWinner(pick) {
  if (!pick || !pick.homeTeam || !pick.awayTeam) return null;
  const h = typeof pick.homeScore === 'number' ? pick.homeScore : NaN;
  const a = typeof pick.awayScore === 'number' ? pick.awayScore : NaN;
  if (isNaN(h) || isNaN(a)) return null;
  if (h > a) return pick.homeTeam;
  if (a > h) return pick.awayTeam;
  return null; // draw — no auto winner in knockout
}

/* ── Single Match Slot ─────────── */
function MatchSlot({ matchNumber, matchData, picks, allTeams, onTeamSelect, onScoreChange, locked }) {
  const [showSelector, setShowSelector] = useState(null);
  const pick = picks[matchNumber] || {};
  const isR32 = matchNumber >= 73 && matchNumber <= 88;

  const homeTeam = pick.homeTeam || null;
  const awayTeam = pick.awayTeam || null;
  const winner = pick.winner || null;
  const homePlaceholder = matchData?.home_placeholder || (R32_MATCH_INFO[matchNumber]?.label?.split(' vs ')[0]) || 'Home';
  const awayPlaceholder = matchData?.away_placeholder || (R32_MATCH_INFO[matchNumber]?.label?.split(' vs ')[1]) || 'Away';

  const getEligibleTeams = (slot) => {
    if (isR32) {
      const info = R32_MATCH_INFO[matchNumber];
      if (!info) return allTeams;
      const slotInfo = slot === 'home' ? info.home : info.away;
      if (slotInfo.type === '3rd') return allTeams;
      return allTeams.filter(t => t.group_letter === slotInfo.group);
    }
    // For later rounds, team comes from feeder match winner
    const feeders = Object.entries(BRACKET_FLOW).filter(([, v]) => v.feedsInto === matchNumber && v.slot === slot);
    if (feeders.length === 0) return allTeams;
    const feederMatch = parseInt(feeders[0][0]);
    const feederPick = picks[feederMatch];
    if (feederPick?.winner) return [feederPick.winner];
    return [];
  };

  const handleTeamSlotClick = (slot) => {
    if (locked) return;
    if (isR32) {
      const eligible = getEligibleTeams(slot);
      if (eligible.length > 0) setShowSelector(slot);
    }
    // Non-R32: teams come from previous round winners, not clickable
  };

  return (
    <>
      <div className="match-slot-wrapper">
        <span className="match-number-label">M{matchNumber}</span>
        <div className={`match-slot ${locked ? 'match-slot-locked' : ''}`}>
          {/* Home team */}
          <div
            className={`match-team ${winner && homeTeam && winner.id === homeTeam.id ? 'match-team-winner' : ''}`}
            onClick={() => handleTeamSlotClick('home')}
            style={isR32 && !locked ? { cursor: 'pointer' } : {}}
          >
            <div className="match-team-info">
              {homeTeam ? (
                <>
                  <img src={homeTeam.flag_url} alt={homeTeam.name} className="team-flag-sm" />
                  <span className="match-team-name">{homeTeam.short_code || homeTeam.name}</span>
                </>
              ) : (
                <span className="match-team-empty">{homePlaceholder}</span>
              )}
            </div>
            <input
              className="match-score-input"
              type="number"
              min="0"
              value={pick.homeScore ?? ''}
              onClick={e => e.stopPropagation()}
              onChange={e => { e.stopPropagation(); onScoreChange(matchNumber, 'homeScore', e.target.value); }}
              disabled={locked || !homeTeam || !awayTeam}
              placeholder="-"
            />
          </div>
          {/* Away team */}
          <div
            className={`match-team ${winner && awayTeam && winner.id === awayTeam.id ? 'match-team-winner' : ''}`}
            onClick={() => handleTeamSlotClick('away')}
            style={isR32 && !locked ? { cursor: 'pointer' } : {}}
          >
            <div className="match-team-info">
              {awayTeam ? (
                <>
                  <img src={awayTeam.flag_url} alt={awayTeam.name} className="team-flag-sm" />
                  <span className="match-team-name">{awayTeam.short_code || awayTeam.name}</span>
                </>
              ) : (
                <span className="match-team-empty">{awayPlaceholder}</span>
              )}
            </div>
            <input
              className="match-score-input"
              type="number"
              min="0"
              value={pick.awayScore ?? ''}
              onClick={e => e.stopPropagation()}
              onChange={e => { e.stopPropagation(); onScoreChange(matchNumber, 'awayScore', e.target.value); }}
              disabled={locked || !homeTeam || !awayTeam}
              placeholder="-"
            />
          </div>
        </div>
      </div>

      {showSelector && (
        <TeamSelectorModal
          teams={getEligibleTeams(showSelector)}
          title={`Pick ${showSelector === 'home' ? 'Home' : 'Away'} Team — M${matchNumber}`}
          onSelect={team => { onTeamSelect(matchNumber, showSelector, team); }}
          onClose={() => setShowSelector(null)}
        />
      )}
    </>
  );
}

/* ── Bracket Round Column ──────── */
function BracketRound({ title, matchNumbers, picks, allTeams, bracketMatches, onTeamSelect, onScoreChange, lockedRounds }) {
  return (
    <div className="bracket-round">
      <div className="bracket-round-title">{title}</div>
      {matchNumbers.map(mn => {
        const md = bracketMatches.find(m => m.match_number === mn);
        const roundLocked = md ? lockedRounds.includes(md.round) : false;
        const predLocked = picks[mn]?.isLocked || false;
        return (
          <MatchSlot
            key={mn}
            matchNumber={mn}
            matchData={md}
            picks={picks}
            allTeams={allTeams}
            onTeamSelect={onTeamSelect}
            onScoreChange={onScoreChange}
            locked={roundLocked || predLocked}
          />
        );
      })}
    </div>
  );
}

/* ── Main Bracket Page ─────────── */
export default function BracketPage() {
  const router = useRouter();
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const [allTeams, setAllTeams] = useState([]);
  const [bracketMatches, setBracketMatches] = useState([]);
  const [picks, setPicks] = useState({});
  const [lockedRounds, setLockedRounds] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [error, setError] = useState('');
  const initialLoadDone = useRef(false);

  // Save to localStorage on every pick change (after initial load)
  useEffect(() => {
    if (initialLoadDone.current && Object.keys(picks).length > 0) {
      saveDraftToStorage(picks);
    }
  }, [picks]);

  // Load data
  useEffect(() => {
    const loadData = async () => {
      try {
        const [teamsRes, matchesRes] = await Promise.all([
          api.get('/api/teams'),
          api.get('/api/matches'),
        ]);
        const teamsList = Array.isArray(teamsRes.data) ? teamsRes.data : [];
        setAllTeams(teamsList);
        const knockoutMatches = (matchesRes.data || []).filter(m => m.match_number >= 73);
        setBracketMatches(knockoutMatches);

        // Load bracket locks
        try {
          const lockData = await api.get('/api/admin/bracket-locks', { adminAuth: true });
          setLockedRounds((lockData.data || []).filter(l => l.is_locked).map(l => l.round));
        } catch { /* not admin */ }

        // Load existing predictions if authenticated
        let loadedFromServer = false;
        if (isAuthenticated) {
          try {
            const predRes = await api.get('/api/predictions');
            const serverPreds = predRes.data?.predictions || [];
            if (serverPreds.length > 0) {
              const existingPicks = {};
              serverPreds.forEach(p => {
                const winnerTeam = teamsList.find(t => t.id === p.predicted_winner_team_id);
                const homeTeam = p.predicted_home_team_id ? teamsList.find(t => t.id === p.predicted_home_team_id) : null;
                const awayTeam = p.predicted_away_team_id ? teamsList.find(t => t.id === p.predicted_away_team_id) : null;
                existingPicks[p.match_number] = {
                  homeTeam: homeTeam || null,
                  awayTeam: awayTeam || null,
                  homeScore: p.predicted_home_score ?? '',
                  awayScore: p.predicted_away_score ?? '',
                  winner: winnerTeam || null,
                  isLocked: p.is_locked,
                  predictionId: p.id,
                };
              });
              setPicks(existingPicks);
              loadedFromServer = true;
            }
          } catch { /* first time */ }
        }

        // Fallback to localStorage draft
        if (!loadedFromServer) {
          const draft = loadDraftFromStorage();
          if (draft && teamsList.length > 0) {
            const restoredPicks = {};
            for (const [mn, d] of Object.entries(draft)) {
              restoredPicks[mn] = {
                homeTeam: d.homeTeamId ? teamsList.find(t => t.id === d.homeTeamId) || null : null,
                awayTeam: d.awayTeamId ? teamsList.find(t => t.id === d.awayTeamId) || null : null,
                homeScore: d.homeScore,
                awayScore: d.awayScore,
                winner: d.winnerId ? teamsList.find(t => t.id === d.winnerId) || null : null,
                isLocked: d.isLocked || false,
              };
            }
            setPicks(restoredPicks);
          }
        }

        initialLoadDone.current = true;
      } catch (err) {
        console.error('Failed to load bracket data:', err);
      } finally {
        setPageLoading(false);
      }
    };
    if (!authLoading) loadData();
  }, [isAuthenticated, authLoading]);

  // Cascade winner into next round
  const cascadeWinner = (updated, matchNumber) => {
    const flow = BRACKET_FLOW[matchNumber];
    if (!flow?.feedsInto) return;
    const nextMatch = flow.feedsInto;
    const nextPick = { ...(updated[nextMatch] || {}) };
    const winner = updated[matchNumber]?.winner;

    if (flow.slot === 'home') {
      nextPick.homeTeam = winner || null;
    } else {
      nextPick.awayTeam = winner || null;
    }

    // If teams changed, clear scores and recompute
    nextPick.homeScore = '';
    nextPick.awayScore = '';
    nextPick.winner = null;
    updated[nextMatch] = nextPick;

    // Continue cascade downstream
    cascadeWinner(updated, nextMatch);
  };

  // Handle team selection for R32 slots
  const handleTeamSelect = useCallback((matchNumber, slot, team) => {
    setPicks(prev => {
      const updated = { ...prev };
      const current = { ...(updated[matchNumber] || {}) };
      if (slot === 'home') current.homeTeam = team;
      else current.awayTeam = team;
      // Recompute winner
      current.winner = computeWinner(current);
      updated[matchNumber] = current;
      // Cascade
      cascadeWinner(updated, matchNumber);
      return updated;
    });
  }, []);

  // Handle score change — auto-compute winner
  const handleScoreChange = useCallback((matchNumber, field, value) => {
    setPicks(prev => {
      const updated = { ...prev };
      const current = { ...(updated[matchNumber] || {}) };
      current[field] = value === '' ? '' : parseInt(value, 10);
      const oldWinnerId = current.winner?.id;
      current.winner = computeWinner(current);
      updated[matchNumber] = current;
      // If winner changed, cascade
      if (current.winner?.id !== oldWinnerId) {
        cascadeWinner(updated, matchNumber);
      }
      return updated;
    });
  }, []);

  // Submit predictions
  const handleSubmit = async () => {
    if (!isAuthenticated) { router.push('/login'); return; }
    setSubmitting(true);
    setError('');
    try {
      const predictions = Object.entries(picks)
        .filter(([, p]) => p.winner)
        .map(([mn, p]) => ({
          match_number: parseInt(mn, 10),
          predicted_winner_team_id: p.winner.id,
          predicted_home_team_id: p.homeTeam?.id || null,
          predicted_away_team_id: p.awayTeam?.id || null,
          predicted_home_score: typeof p.homeScore === 'number' ? p.homeScore : null,
          predicted_away_score: typeof p.awayScore === 'number' ? p.awayScore : null,
        }));

      const champion = picks[104]?.winner;
      const method = user?.has_submitted_prediction ? 'put' : 'post';

      await api[method]('/api/predictions', {
        predictions,
        champion_prediction_team_id: champion?.id || null,
      });

      router.push('/thank-you');
    } catch (err) {
      setError(err.message || 'Failed to submit predictions');
    } finally {
      setSubmitting(false);
    }
  };

  if (pageLoading || authLoading) {
    return (
      <div className="loading-page">
        <div className="spinner spinner-lg" style={{ color: 'var(--color-gold)' }} />
        <p style={{ color: 'var(--color-text-muted)' }}>Loading bracket...</p>
      </div>
    );
  }

  const pickCount = Object.values(picks).filter(p => p.winner).length;
  const totalKnockout = 31;

  return (
    <div style={{ padding: 'var(--space-6) 0' }}>
      <div className="container">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-4)', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
          <div>
            <h1 style={{ fontSize: 'var(--fs-3xl)' }}>Your Bracket</h1>
            <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--fs-sm)' }}>
              Pick teams for each match, then enter scores. The higher score automatically wins and advances.
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
            <span className="badge badge-gold">{pickCount}/{totalKnockout} winners</span>
            <button className="btn btn-primary" onClick={handleSubmit} disabled={submitting || pickCount === 0}>
              {submitting ? <span className="spinner" /> : (user?.has_submitted_prediction ? 'Update Predictions' : 'Submit Predictions')}
            </button>
          </div>
        </div>

        {!isAuthenticated && (
          <div style={{ padding: 'var(--space-4)', background: 'rgba(212,168,67,0.1)', border: '1px solid rgba(212,168,67,0.3)', borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-4)', fontSize: 'var(--fs-sm)', color: 'var(--color-gold)' }}>
            You are viewing the bracket as a guest. Your picks are saved locally. Log in or register to submit your predictions.
          </div>
        )}

        {error && (
          <div style={{ padding: 'var(--space-3) var(--space-4)', background: 'rgba(255,68,68,0.1)', border: '1px solid rgba(255,68,68,0.3)', borderRadius: 'var(--radius-md)', color: 'var(--color-error)', fontSize: 'var(--fs-sm)', marginBottom: 'var(--space-4)' }}>
            {error}
          </div>
        )}

        <div className="bracket-scroll-hint">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round"/></svg>
          Scroll horizontally to see the full bracket
        </div>

        {/* BRACKET TREE */}
        <div className="bracket-container">
          <div className="bracket-tree">
            <BracketRound title="Round of 32" matchNumbers={LEFT_BRACKET.round_of_32} picks={picks} allTeams={allTeams} bracketMatches={bracketMatches} onTeamSelect={handleTeamSelect} onScoreChange={handleScoreChange} lockedRounds={lockedRounds} />
            <BracketRound title="Round of 16" matchNumbers={LEFT_BRACKET.round_of_16} picks={picks} allTeams={allTeams} bracketMatches={bracketMatches} onTeamSelect={handleTeamSelect} onScoreChange={handleScoreChange} lockedRounds={lockedRounds} />
            <BracketRound title="Quarterfinals" matchNumbers={LEFT_BRACKET.quarterfinal} picks={picks} allTeams={allTeams} bracketMatches={bracketMatches} onTeamSelect={handleTeamSelect} onScoreChange={handleScoreChange} lockedRounds={lockedRounds} />
            <BracketRound title="Semifinals" matchNumbers={LEFT_BRACKET.semifinal} picks={picks} allTeams={allTeams} bracketMatches={bracketMatches} onTeamSelect={handleTeamSelect} onScoreChange={handleScoreChange} lockedRounds={lockedRounds} />

            {/* Center: Final */}
            <div className="bracket-round" style={{ justifyContent: 'center' }}>
              <div className="bracket-round-title" style={{ borderColor: 'var(--color-gold)' }}>Final</div>
              <MatchSlot matchNumber={104} matchData={bracketMatches.find(m => m.match_number === 104)} picks={picks} allTeams={allTeams} onTeamSelect={handleTeamSelect} onScoreChange={handleScoreChange} locked={lockedRounds.includes('final')} />
              {picks[104]?.winner && (
                <div className="card card-highlighted" style={{ textAlign: 'center', marginTop: 'var(--space-4)', padding: 'var(--space-4)' }}>
                  <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-gold)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 'var(--space-2)' }}>Your Champion</div>
                  <img src={picks[104].winner.flag_url} alt={picks[104].winner.name} className="team-flag-lg" style={{ margin: '0 auto var(--space-2)' }} />
                  <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 'var(--fs-lg)' }}>{picks[104].winner.name}</div>
                </div>
              )}
            </div>

            <BracketRound title="Semifinals" matchNumbers={RIGHT_BRACKET.semifinal} picks={picks} allTeams={allTeams} bracketMatches={bracketMatches} onTeamSelect={handleTeamSelect} onScoreChange={handleScoreChange} lockedRounds={lockedRounds} />
            <BracketRound title="Quarterfinals" matchNumbers={RIGHT_BRACKET.quarterfinal} picks={picks} allTeams={allTeams} bracketMatches={bracketMatches} onTeamSelect={handleTeamSelect} onScoreChange={handleScoreChange} lockedRounds={lockedRounds} />
            <BracketRound title="Round of 16" matchNumbers={RIGHT_BRACKET.round_of_16} picks={picks} allTeams={allTeams} bracketMatches={bracketMatches} onTeamSelect={handleTeamSelect} onScoreChange={handleScoreChange} lockedRounds={lockedRounds} />
            <BracketRound title="Round of 32" matchNumbers={RIGHT_BRACKET.round_of_32} picks={picks} allTeams={allTeams} bracketMatches={bracketMatches} onTeamSelect={handleTeamSelect} onScoreChange={handleScoreChange} lockedRounds={lockedRounds} />
          </div>
        </div>

        <div style={{ textAlign: 'center', padding: 'var(--space-8) 0' }}>
          <button className="btn btn-gold btn-xl" onClick={handleSubmit} disabled={submitting || pickCount === 0}>
            {submitting ? <span className="spinner" /> : `Submit ${pickCount} Predictions`}
          </button>
        </div>
      </div>
    </div>
  );
}
