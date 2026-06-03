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
          predicted_winner_team_id: winnerTeamId,
          predicted_home_team_id: match.home_team?.id,
          predicted_away_team_id: match.away_team?.id,
          predicted_home_score: pred.homeScore ? parseInt(pred.homeScore) : null,
          predicted_away_score: pred.awayScore ? parseInt(pred.awayScore) : null
        };
      });

      // Use PUT if they already submitted before, else POST
      if (user.has_submitted_prediction || Object.keys(savedPredictions).length > 0) {
        await api.put('/api/predictions', { predictions: payload });
      } else {
        await api.post('/api/predictions', { predictions: payload });
      }

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
        <div className="section-header" style={{ marginBottom: 'var(--space-6)', textAlign: 'center' }}>
          <h1 style={{ fontSize: 'var(--fs-3xl)' }}>{t('pred_title') || 'Make Your Predictions'}</h1>
          <p>{t('pred_subtitle') || 'Predict the outcomes of the knockout stages'}</p>
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
        background: 'var(--color-surface-white)',
        padding: 'var(--space-3) var(--space-4)',
        borderRadius: 30,
        boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-4)',
        direction: locale === 'ar' ? 'rtl' : 'ltr',
        border: hasUnsavedChanges ? '2px solid var(--color-gold)' : '2px solid transparent',
        transition: 'all 0.3s ease'
      }}>
        {hasUnsavedChanges && <span style={{ fontWeight: 600, color: 'var(--color-primary-dark)' }}>{t('pred_unsaved') || 'Unsaved Changes'}</span>}
        <button 
          className="btn btn-gold" 
          onClick={handleSubmit} 
          disabled={submitting || Object.keys(predictions).length === 0}
          style={{ borderRadius: 20, padding: '8px 24px', opacity: (submitting || Object.keys(predictions).length === 0) ? 0.6 : 1 }}
        >
          {submitting ? 'Submitting...' : (t('pred_submit') || 'Submit Predictions')}
        </button>
      </div>

      <Footer />
    </>
  );
}
