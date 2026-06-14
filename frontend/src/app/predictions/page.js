'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import MatchCard from '@/components/predictions/MatchCard';
import Footer from '@/components/layout/Footer';
import { useLanguage } from '@/context/LanguageContext';
import api from '@/lib/api';
import { supabase } from '@/lib/supabaseClient';
import { NotificationBanner } from '@/components/NotificationPrompt';

export default function PredictionsPage() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const router = useRouter();
  const { t, locale } = useLanguage();

  const [matches, setMatches]                   = useState([]);
  const [predictions, setPredictions]           = useState({});
  const [savedPredictions, setSavedPredictions] = useState({});
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [loading, setLoading]     = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]         = useState('');
  const [userStanding, setUserStanding] = useState(null);
  const [topPlayer, setTopPlayer]   = useState(null);
  const [targetMatchNum, setTargetMatchNum] = useState(null);
  const matchRefs = useRef({});

  // ── Redirect if not logged in ──────────────────────────────
  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push('/login');
  }, [isAuthenticated, authLoading, router]);

  // ── Fetch data + set up realtime ───────────────────────────
  useEffect(() => {
    if (!isAuthenticated || !user?.id) return;

    let channel = null;

    const fetchData = async () => {
      setLoading(true);
      try {
        const [resMatches, resPreds] = await Promise.all([
          api.get('/api/matches'),
          api.get('/api/predictions'),
        ]);

        const allMatches = resMatches.data;
        allMatches.sort((a, b) => {
          if (!a.kickoff_time) return 1;
          if (!b.kickoff_time) return -1;
          return new Date(a.kickoff_time) - new Date(b.kickoff_time);
        });
        setMatches(allMatches);

        // Find the match to jump to:
        // Priority 1 — any live match
        // Priority 2 — next upcoming scheduled match
        // Priority 3 — last finished match (fallback)
        const LIVE_STATUSES = ['live', 'halftime', 'extra_time', 'penalties'];
        const now = new Date();

        const liveMatch = allMatches.find(m => LIVE_STATUSES.includes(m.status));

        const nextScheduled = allMatches
          .filter(m => m.status === 'scheduled' && m.kickoff_time && new Date(m.kickoff_time) > now)
          .sort((a, b) => new Date(a.kickoff_time) - new Date(b.kickoff_time))[0];

        const lastFinished = [...allMatches]
          .filter(m => m.status === 'finished')
          .sort((a, b) => new Date(b.kickoff_time) - new Date(a.kickoff_time))[0];

        const jumpTarget = liveMatch || nextScheduled || lastFinished;
        if (jumpTarget) setTargetMatchNum(jumpTarget.match_number);

        // Build match lookup to resolve home/away team IDs
        const matchMap = {};
        allMatches.forEach(m => { matchMap[m.match_number] = m; });

        const predsData = resPreds.data.predictions || [];
        const predsObj  = {};

        predsData.forEach(p => {
          const match = matchMap[p.match_number];
          let winner = null;
          if (p.predicted_winner_team_id === null) {
            winner = 'draw';
          } else if (match?.home_team?.id && p.predicted_winner_team_id === match.home_team.id) {
            winner = 'home';
          } else if (match?.away_team?.id && p.predicted_winner_team_id === match.away_team.id) {
            winner = 'away';
          }

          predsObj[p.match_number] = {
            winner,
            homeScore:              p.predicted_home_score ?? 0,
            awayScore:              p.predicted_away_score ?? 0,
            predictedWinnerTeamId:  p.predicted_winner_team_id,
            isLocked:               p.is_locked,
            lockedReason:           p.locked_reason,
            pointsEarned:           p.points_earned,
          };
        });

        setPredictions(predsObj);
        setSavedPredictions(predsObj);

        // Non-blocking leaderboard fetch for standing card
        api.get('/api/leaderboard?limit=200')
          .then(resLb => {
            const lbData = resLb.data || [];
            if (lbData.length > 0) setTopPlayer(lbData[0]);
            const me = lbData.find(u => u.id === user.id);
            if (me) setUserStanding(me);
          })
          .catch(() => {});

      } catch (err) {
        console.error('Error fetching data:', err);
        setError(err.message || 'Failed to load data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    // ── Realtime subscriptions ─────────────────────────────
    // Set up AFTER fetchData so we don't miss any updates that happened
    // between the fetch and the subscription start.
    channel = supabase
      .channel('wc2026-predictions-page')
      // Live match score / status changes
      .on('postgres_changes', {
        event:  'UPDATE',
        schema: 'public',
        table:  'matches',
      }, (payload) => {
        setMatches(prev => prev.map(m =>
          m.match_number === payload.new.match_number
            ? {
                ...m,
                status:             payload.new.status,
                home_score:         payload.new.home_score,
                away_score:         payload.new.away_score,
                winner_team_id:     payload.new.winner_team_id,
                home_penalty_score: payload.new.home_penalty_score,
                away_penalty_score: payload.new.away_penalty_score,
              }
            : m
        ));
      })
      // Prediction lock + points awarded (fires via DB trigger after match finishes)
      .on('postgres_changes', {
        event:  'UPDATE',
        schema: 'public',
        table:  'predictions',
        filter: `user_id=eq.${user.id}`,
      }, (payload) => {
        const p = payload.new;
        setSavedPredictions(prev => ({
          ...prev,
          [p.match_number]: {
            ...(prev[p.match_number] || {}),
            isLocked:     p.is_locked,
            lockedReason: p.locked_reason,
            pointsEarned: p.points_earned,
          },
        }));
      })
      .subscribe();

    // ── Cleanup on unmount ─────────────────────────────────
    return () => {
      if (channel) supabase.removeChannel(channel);
    };

  }, [isAuthenticated, user?.id]);

  // ── Auto-scroll to live / next match ─────────────────────────
  useEffect(() => {
    if (!targetMatchNum || loading) return;
    // Small delay so DOM has rendered
    const timer = setTimeout(() => {
      const el = matchRefs.current[targetMatchNum];
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [targetMatchNum, loading]);

  // ── Unsaved changes detector ───────────────────────────────
  useEffect(() => {
    const changed = Object.keys(predictions).some(key => {
      const curr  = predictions[key];
      const saved = savedPredictions[key];
      if (!saved && curr) return true;
      return (
        curr?.homeScore !== saved?.homeScore ||
        curr?.awayScore !== saved?.awayScore ||
        curr?.winner   !== saved?.winner
      );
    });
    setHasUnsavedChanges(changed && Object.keys(predictions).length > 0);
  }, [predictions, savedPredictions]);

  // ── Scroll to target match ────────────────────────────────────
  const scrollToTarget = useCallback(() => {
    if (!targetMatchNum) return;
    const el = matchRefs.current[targetMatchNum];
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [targetMatchNum]);

  // ── Prediction update from MatchCard ──────────────────────
  const handlePredict = (matchNum, predictionData) => {
    setPredictions(prev => {
      const next = { ...prev };
      if (predictionData === null) delete next[matchNum];
      else next[matchNum] = predictionData;
      return next;
    });
  };

  // ── Submit all predictions ─────────────────────────────────
  const handleSubmit = async () => {
    if (!user?.id || Object.keys(predictions).length === 0) return;

    setSubmitting(true);
    setError('');

    try {
      const payload = Object.keys(predictions).map(matchNum => {
        const pred  = predictions[matchNum];
        const match = matches.find(m => m.match_number == matchNum);

        let winnerTeamId = null;
        if (pred.winner === 'home') winnerTeamId = match?.home_team?.id || null;
        if (pred.winner === 'away') winnerTeamId = match?.away_team?.id || null;
        // 'draw' → winnerTeamId stays null (stored as NULL in DB)

        return {
          match_number:              parseInt(matchNum),
          predicted_winner_team_id:  winnerTeamId,
          predicted_home_score:      pred.homeScore != null ? parseInt(pred.homeScore) : 0,
          predicted_away_score:      pred.awayScore != null ? parseInt(pred.awayScore) : 0,
        };
      });

      await api.put('/api/predictions', { predictions: payload });

      setSavedPredictions({ ...predictions });
      setHasUnsavedChanges(false);
      alert(t('pred_success') || 'Predictions saved successfully!');
    } catch (err) {
      console.error('Submit error', err);
      setError(err.message || 'Error saving predictions');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Loading state ─────────────────────────────────────────
  if (authLoading || loading) {
    return (
      <div className="loading-page">
        <div className="spinner spinner-lg" style={{ color: 'var(--color-gold)' }} />
      </div>
    );
  }

  // ── Group matches by round ─────────────────────────────────
  const groupedMatches = matches.reduce((acc, match) => {
    if (!acc[match.round]) acc[match.round] = [];
    acc[match.round].push(match);
    return acc;
  }, {});

  const stageOrder = [
    'group_stage', 'round_of_32', 'round_of_16',
    'quarterfinal', 'semifinal', 'third_place', 'final',
  ];

  const stageLabels = {
    group_stage:  locale === 'ar' ? 'مرحلة المجموعات' : 'Group Stage',
    round_of_32:  locale === 'ar' ? 'دور الـ 32'       : 'Round of 32',
    round_of_16:  locale === 'ar' ? 'دور الـ 16'       : 'Round of 16',
    quarterfinal: locale === 'ar' ? 'ربع النهائي'      : 'Quarter-Finals',
    semifinal:    locale === 'ar' ? 'نصف النهائي'      : 'Semi-Finals',
    third_place:  locale === 'ar' ? 'المركز الثالث'    : 'Third Place',
    final:        locale === 'ar' ? 'النهائي'          : 'Final',
  };

  return (
    <>
      <div className="container" style={{ padding: 'var(--space-8) var(--space-4)', maxWidth: 800, paddingBottom: 100 }}>

        <NotificationBanner />

        {/* Compete Banner */}
        <div style={{
          background: 'linear-gradient(135deg, #5F27E4 0%, #3d1a9e 100%)',
          borderRadius: 20, padding: '20px 24px', marginBottom: 20,
          textAlign: 'center', boxShadow: '0 8px 32px rgba(95,39,228,0.4)',
          position: 'relative', overflow: 'hidden', border: '2px solid #A9DF00',
        }}>
          <div style={{ position: 'absolute', top: -20, right: -20, width: 100, height: 100, borderRadius: '50%', background: 'rgba(169,223,0,0.15)', pointerEvents: 'none' }} />
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#A9DF00', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 6 }}>
              {t('pred_prize_label')}
            </div>
            <div style={{ fontSize: '2rem', fontWeight: 900, color: '#ffffff', letterSpacing: '0.02em', lineHeight: 1.1 }}>
              {t('pred_prize_tagline')}
            </div>
          </div>
        </div>

        {/* User Standing Card */}
        {userStanding && (
          <div style={{
            background: '#FFFFFF', borderRadius: 20, padding: '16px 20px',
            marginBottom: 24, border: '2px solid #F3F4F6',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{
                width: 42, height: 42, borderRadius: '50%',
                background: userStanding.rank <= 3 ? 'linear-gradient(135deg,#FFD700,#F7B731)' : '#F3F4F6',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 900, fontSize: '1.1rem',
                color: userStanding.rank <= 3 ? '#111' : '#4B5563',
                boxShadow: userStanding.rank <= 3 ? '0 3px 10px rgba(212,168,67,0.3)' : 'none',
              }}>
                {userStanding.rank}
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: '1rem', color: '#111827' }}>
                  {userStanding.full_name}{' '}
                  <span style={{ color: '#9CA3AF', fontWeight: 500, fontSize: '0.85rem' }}>{t('pred_you')}</span>
                </div>
                <div style={{ fontSize: '0.8rem', color: '#6B7280', fontWeight: 500 }}>
                  {t('pred_rank_label')} #{userStanding.rank}
                  {topPlayer ? ` · ${t('pred_leader_label')}: ${topPlayer.total_points} pts` : ''}
                </div>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#D4A843' }}>{userStanding.total_points}</div>
              <div style={{ fontSize: '0.75rem', color: '#9CA3AF', fontWeight: 600 }}>Points</div>
            </div>
          </div>
        )}

        <div className="section-header" style={{ marginBottom: 'var(--space-6)', textAlign: 'center' }}>
          <h1 style={{ fontSize: 'var(--fs-3xl)' }}>{t('pred_title') || 'Make Your Predictions'}</h1>
          <p>{t('pred_subtitle') || 'Predict the outcomes of all World Cup matches'}</p>
        </div>

        {error && <div className="alert alert-error" style={{ marginBottom: 20 }}>{error}</div>}

        {stageOrder.map(stage => {
          const stageMatches = groupedMatches[stage];
          if (!stageMatches?.length) return null;
          return (
            <div key={stage} style={{ marginBottom: 'var(--space-8)' }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
                <h2 style={{ margin: 0, fontSize: 'var(--fs-xl)' }}>{stageLabels[stage]}</h2>
                <div style={{ flex: 1, height: 1, background: 'var(--color-border)', margin: '0 var(--space-4)' }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                {stageMatches.map(match => (
                  <div
                    key={match.match_number}
                    ref={el => { matchRefs.current[match.match_number] = el; }}
                    style={{ scrollMarginTop: 80 }}
                  >
                    <MatchCard
                      match={match}
                      prediction={predictions[match.match_number]}
                      savedPrediction={savedPredictions[match.match_number]}
                      onPredict={handlePredict}
                    />
                  </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Floating Submit Bar */}
      <div style={{
        position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)',
        zIndex: 100, background: '#FFFFFF', padding: 'var(--space-3) var(--space-4)',
        borderRadius: 30, display: 'flex', alignItems: 'center', gap: 'var(--space-4)',
        direction: locale === 'ar' ? 'rtl' : 'ltr',
        border: hasUnsavedChanges ? '2px solid #A9DF00' : '2px solid #E5E7EB',
        transition: 'all 0.3s ease',
        boxShadow: hasUnsavedChanges ? '0 10px 30px rgba(169,223,0,0.25)' : '0 10px 25px rgba(0,0,0,0.15)',
      }}>
        {targetMatchNum && (
          <button
            onClick={scrollToTarget}
            style={{
              background: 'none', border: '1.5px solid #E5E7EB',
              borderRadius: 20, padding: '8px 16px',
              fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer',
              color: '#374151', display: 'flex', alignItems: 'center', gap: 6,
              flexShrink: 0,
            }}
          >
            ⚽ {(() => {
              const LIVE = ['live','halftime','extra_time','penalties'];
              const t = matches.find(m => m.match_number === targetMatchNum);
              return LIVE.includes(t?.status) ? 'Live Match' : 'Next Match';
            })()}
          </button>
        )}
        {hasUnsavedChanges && (
          <span style={{ fontWeight: 700, color: '#1a2e00', fontSize: '0.9rem' }}>
            {t('pred_unsaved') || 'Unsaved Changes'}
          </span>
        )}
        <button
          className="btn btn-gold"
          onClick={handleSubmit}
          disabled={submitting || Object.keys(predictions).length === 0}
          style={{
            borderRadius: 20, padding: '10px 28px',
            opacity: (submitting || Object.keys(predictions).length === 0) ? 0.5 : 1,
            background: Object.keys(predictions).length > 0 ? '#A9DF00' : undefined,
            color:      Object.keys(predictions).length > 0 ? '#1a2e00' : undefined,
            fontWeight: 800,
            boxShadow:  Object.keys(predictions).length > 0 ? '0 4px 16px rgba(169,223,0,0.5)' : undefined,
          }}
        >
          {submitting ? 'Saving…' : (t('pred_submit') || 'Save Predictions')}
        </button>
      </div>

      <Footer />
    </>
  );
}
