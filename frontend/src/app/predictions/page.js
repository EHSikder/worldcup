'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import MatchCard from '@/components/predictions/MatchCard';
import Footer from '@/components/layout/Footer';
import { useLanguage } from '@/context/LanguageContext';
import api from '@/lib/api';

export default function PredictionsPage() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const router = useRouter();
  const { t, locale } = useLanguage();
  
  const [matches, setMatches] = useState([]);
  const [predictions, setPredictions] = useState({});
  const [savedPredictions, setSavedPredictions] = useState({});
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [userStanding, setUserStanding] = useState(null);
  const [topPlayer, setTopPlayer] = useState(null);
  
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, authLoading, router]);

  useEffect(() => {
    if (!isAuthenticated) return;
    
    const fetchData = async () => {
      setLoading(true);
      try {
        const resMatches = await api.get('/api/matches');
        const allMatches = resMatches.data;
        // Sort all matches by kickoff_time for correct chronological order
        allMatches.sort((a, b) => {
          if (!a.kickoff_time) return 1;
          if (!b.kickoff_time) return -1;
          return new Date(a.kickoff_time) - new Date(b.kickoff_time);
        });
        setMatches(allMatches);

        // Fetch user predictions
        const resPreds = await api.get('/api/predictions');
        const predsData = resPreds.data.predictions || [];
        
        const predsObj = {};
        predsData.forEach(p => {
          predsObj[p.match_number] = {
            winner: p.predicted_winner_team_id === p.predicted_home_team_id ? 'home' 
                  : (p.predicted_winner_team_id === p.predicted_away_team_id ? 'away' : 'draw'),
            homeScore: p.predicted_home_score,
            awayScore: p.predicted_away_score,
            predictedWinnerTeamId: p.predicted_winner_team_id,
            isLocked: p.is_locked,
            lockedReason: p.locked_reason,
            pointsEarned: p.points_earned
          };
        });
        
        setPredictions(predsObj);
        setSavedPredictions(predsObj);
      } catch (err) {
        console.error('Error fetching data:', err);
        setError(err.message || 'Failed to load data');
      } finally {
        setLoading(false);
      }

      // Fetch leaderboard for user standing
      try {
        const resLb = await api.get('/api/leaderboard?limit=200');
        const lbData = resLb.data || [];
        if (lbData.length > 0) setTopPlayer(lbData[0]);
        if (user?.id) {
          const me = lbData.find(u => u.id === user.id);
          if (me) setUserStanding(me);
        }
      } catch(e) {}
    };

    fetchData();
  }, [isAuthenticated]);

  useEffect(() => {
    const isChanged = Object.keys(predictions).some(key => 
      predictions[key]?.homeScore !== savedPredictions[key]?.homeScore ||
      predictions[key]?.awayScore !== savedPredictions[key]?.awayScore ||
      predictions[key]?.winner !== savedPredictions[key]?.winner
    );
    setHasUnsavedChanges(isChanged && Object.keys(predictions).length > 0);
  }, [predictions, savedPredictions]);

  const handlePredict = (matchId, predictionData) => {
    setPredictions(prev => {
      const newPreds = { ...prev };
      if (predictionData === null) {
        delete newPreds[matchId];
      } else {
        newPreds[matchId] = predictionData;
      }
      return newPreds;
    });
  };

  const handleSubmit = async () => {
    if (!user?.id || Object.keys(predictions).length === 0) return;
    
    setSubmitting(true);
    try {
      const payload = Object.keys(predictions).map(matchNum => {
        const pred = predictions[matchNum];
        const match = matches.find(m => m.match_number == matchNum);
        
        let winnerTeamId = null;
        if (pred.winner === 'home') winnerTeamId = match.home_team?.id;
        if (pred.winner === 'away') winnerTeamId = match.away_team?.id;
        
        return {
          match_number: parseInt(matchNum),
          predicted_winner_team_id: winnerTeamId || null,
          predicted_home_score: pred.homeScore != null ? parseInt(pred.homeScore) : 0,
          predicted_away_score: pred.awayScore != null ? parseInt(pred.awayScore) : 0
        };
      });

      // Always use PUT - it handles both create and update
      await api.put('/api/predictions', { predictions: payload });

      setSavedPredictions(predictions);
      setHasUnsavedChanges(false);
      alert(t('pred_success') || 'Predictions saved successfully!');
    } catch (err) {
      console.error('Submit error', err);
      alert(err.message || 'Error saving predictions');
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="loading-page">
        <div className="spinner spinner-lg" style={{ color: 'var(--color-gold)' }} />
      </div>
    );
  }

  const groupedMatches = matches.reduce((acc, match) => {
    if (!acc[match.round]) acc[match.round] = [];
    acc[match.round].push(match);
    return acc;
  }, {});

  const stageOrder = ['group_stage', 'round_of_32', 'round_of_16', 'quarterfinal', 'semifinal', 'third_place', 'final'];

  const stageTranslations = {
    'group_stage': locale === 'ar' ? 'مرحلة المجموعات' : 'Group Stage',
    'round_of_32': locale === 'ar' ? 'دور الـ 32' : 'Round of 32',
    'round_of_16': locale === 'ar' ? 'دور الـ 16' : 'Round of 16',
    'quarterfinal': locale === 'ar' ? 'ربع النهائي' : 'Quarter-Finals',
    'semifinal': locale === 'ar' ? 'نصف النهائي' : 'Semi-Finals',
    'third_place': locale === 'ar' ? 'المركز الثالث' : 'Third Place',
    'final': locale === 'ar' ? 'النهائي' : 'Final',
  };

  return (
    <>
      <div className="container" style={{ padding: 'var(--space-8) var(--space-4)', maxWidth: 800, paddingBottom: 100 }}>
        {/* Prize Pool Banner */}
        <div style={{
          background: 'linear-gradient(135deg, #5F27E4 0%, #3d1a9e 100%)',
          borderRadius: 20,
          padding: '20px 24px',
          marginBottom: 20,
          textAlign: 'center',
          boxShadow: '0 8px 32px rgba(95, 39, 228, 0.4)',
          position: 'relative',
          overflow: 'hidden',
          border: '2px solid #A9DF00'
        }}>
          <div style={{ position: 'absolute', top: -20, right: -20, width: 100, height: 100, borderRadius: '50%', background: 'rgba(169,223,0,0.15)', pointerEvents: 'none' }} />
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#A9DF00', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 4 }}>{t('pred_prize_label')}</div>
            <div style={{ fontSize: '2.4rem', fontWeight: 900, color: '#ffffff', letterSpacing: '-0.02em' }}>$1,000</div>
            <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.7)', fontWeight: 600, marginTop: 2 }}>{t('pred_prize_tagline')}</div>
          </div>
        </div>

        {/* User Standing Card */}
        {userStanding && (
          <div style={{
            background: '#FFFFFF',
            borderRadius: 20,
            padding: '16px 20px',
            marginBottom: 24,
            border: '2px solid #F3F4F6',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 2px 12px rgba(0,0,0,0.04)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{
                width: 42, height: 42, borderRadius: '50%',
                background: userStanding.rank <= 3 ? 'linear-gradient(135deg, #FFD700, #F7B731)' : '#F3F4F6',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 900, fontSize: '1.1rem',
                color: userStanding.rank <= 3 ? '#111' : '#4B5563',
                boxShadow: userStanding.rank <= 3 ? '0 3px 10px rgba(212,168,67,0.3)' : 'none'
              }}>
                {userStanding.rank}
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: '1rem', color: '#111827' }}>{userStanding.full_name} <span style={{ color: '#9CA3AF', fontWeight: 500, fontSize: '0.85rem' }}>{t('pred_you')}</span></div>
                <div style={{ fontSize: '0.8rem', color: '#6B7280', fontWeight: 500 }}>
                  {t('pred_rank_label')} #{userStanding.rank}{topPlayer ? ` · ${t('pred_leader_label')}: ${topPlayer.total_points} ${t('scoring_pts')}` : ''}
                </div>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#D4A843' }}>{userStanding.total_points}</div>
              <div style={{ fontSize: '0.75rem', color: '#9CA3AF', fontWeight: 600 }}>{t('scoring_pts')}</div>
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
          if (!stageMatches || stageMatches.length === 0) return null;
          
          return (
            <div key={stage} style={{ marginBottom: 'var(--space-8)' }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
                <h2 style={{ margin: 0, fontSize: 'var(--fs-xl)' }}>{stageTranslations[stage]}</h2>
                <div style={{ flex: 1, height: 1, background: 'var(--color-border)', margin: '0 var(--space-4)' }} />
              </div>
              
              <div className="matches-list" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                {stageMatches.map(match => (
                  <MatchCard 
                    key={match.match_number}
                    match={match}
                    prediction={predictions[match.match_number]}
                    savedPrediction={savedPredictions[match.match_number]}
                    onPredict={handlePredict}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ 
        position: 'fixed', 
        bottom: 20, 
        left: '50%', 
        transform: 'translateX(-50%)', 
        zIndex: 100,
        background: '#FFFFFF',
        padding: 'var(--space-3) var(--space-4)',
        borderRadius: 30,
        boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-4)',
        direction: locale === 'ar' ? 'rtl' : 'ltr',
        border: hasUnsavedChanges ? '2px solid #A9DF00' : '2px solid #E5E7EB',
        transition: 'all 0.3s ease',
        boxShadow: hasUnsavedChanges ? '0 10px 30px rgba(169,223,0,0.25)' : '0 10px 25px rgba(0,0,0,0.15)'
      }}>
        {hasUnsavedChanges && <span style={{ fontWeight: 700, color: '#1a2e00', fontSize: '0.9rem' }}>{t('pred_unsaved') || 'Unsaved Changes'}</span>}
        <button 
          className="btn btn-gold" 
          onClick={handleSubmit} 
          disabled={submitting || Object.keys(predictions).length === 0}
          style={{ 
            borderRadius: 20, 
            padding: '10px 28px',
            opacity: (submitting || Object.keys(predictions).length === 0) ? 0.5 : 1,
            background: Object.keys(predictions).length > 0 ? '#A9DF00' : undefined,
            color: Object.keys(predictions).length > 0 ? '#1a2e00' : undefined,
            fontWeight: 800,
            boxShadow: Object.keys(predictions).length > 0 ? '0 4px 16px rgba(169,223,0,0.5)' : undefined
          }}
        >
          {submitting ? 'Submitting...' : (t('pred_submit') || 'Submit Predictions')}
        </button>
      </div>

      <Footer />
    </>
  );
}
