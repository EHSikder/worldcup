'use client';
import { useLanguage } from '@/context/LanguageContext';
import { useState, useEffect } from 'react';

export default function MatchCard({ match, prediction, savedPrediction, onPredict }) {
  const { t, locale } = useLanguage();
  const [isLockedLocal, setIsLockedLocal] = useState(false);

  useEffect(() => {
    // Check if match starts in less than 5 minutes
    if (match.kickoff_time) {
      const matchTime = new Date(match.kickoff_time).getTime();
      const now = new Date().getTime();
      const diffMinutes = (matchTime - now) / 1000 / 60;
      
      if (diffMinutes <= 5 || match.status !== 'scheduled') {
        setIsLockedLocal(true);
      }
    }
  }, [match.kickoff_time, match.status]);

  const isLocked = savedPrediction?.isLocked || match.round_locked || isLockedLocal;
  
  const homeTeamName = match.home_team?.name || match.home_placeholder || 'TBD';
  const awayTeamName = match.away_team?.name || match.away_placeholder || 'TBD';
  const homeFlag = match.home_team?.flag_url || 'https://flagcdn.com/w80/xx.png'; // placeholder flag
  const awayFlag = match.away_team?.flag_url || 'https://flagcdn.com/w80/xx.png';

  const handleWinnerClick = (winner) => {
    if (isLocked) return;
    
    // You can't predict if the teams aren't known yet
    if (!match.home_team || !match.away_team) {
      alert('Teams for this match are not decided yet!');
      return;
    }

    if (prediction?.winner !== winner) {
      onPredict(match.match_number, { 
        ...prediction, 
        winner, 
        homeScore: prediction?.homeScore || '', 
        awayScore: prediction?.awayScore || '' 
      });
    } else {
      onPredict(match.match_number, null);
    }
  };

  const handleScoreChange = (side, value) => {
    if (isLocked) return;
    onPredict(match.match_number, {
      ...prediction,
      [`${side}Score`]: value.replace(/[^0-9]/g, '')
    });
  };

  const isSelected = (side) => prediction?.winner === side;
  const showLiveScore = match.status === 'live' || match.status === 'finished' || match.status === 'halftime' || match.status === 'extra_time' || match.status === 'penalties';

  const stageTranslations = {
    'group_stage': locale === 'ar' ? 'مرحلة المجموعات' : 'Group Stage',
    'round_of_32': locale === 'ar' ? 'دور الـ 32' : 'Round of 32',
    'round_of_16': locale === 'ar' ? 'دور الـ 16' : 'Round of 16',
    'quarterfinal': locale === 'ar' ? 'ربع النهائي' : 'Quarter-Finals',
    'semifinal': locale === 'ar' ? 'نصف النهائي' : 'Semi-Finals',
    'third_place': locale === 'ar' ? 'المركز الثالث' : 'Third Place',
    'final': locale === 'ar' ? 'النهائي' : 'Final',
  };

  const statusTranslations = {
    'scheduled': locale === 'ar' ? 'مجدول' : 'Scheduled',
    'live': locale === 'ar' ? 'مباشر' : 'Live',
    'halftime': locale === 'ar' ? 'بين الشوطين' : 'Half Time',
    'extra_time': locale === 'ar' ? 'وقت إضافي' : 'Extra Time',
    'penalties': locale === 'ar' ? 'ركلات ترجيح' : 'Penalties',
    'finished': locale === 'ar' ? 'انتهت' : 'Finished',
  };

  return (
    <div className={`card match-card ${isLocked ? 'locked' : ''}`} style={{ 
      marginBottom: 'var(--space-4)', 
      transition: 'all 0.3s ease',
      border: showLiveScore ? '1px solid var(--color-gold)' : undefined
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--color-text-muted)', fontSize: 'var(--fs-xs)', marginBottom: 'var(--space-3)' }}>
        <span style={{ fontWeight: 600, color: 'var(--color-gold)' }}>
          {t('pred_match') || 'Match'} {match.match_number} &bull; {stageTranslations[match.round]} 
          {isLocked && <span style={{ marginLeft: 8, color: 'var(--color-primary-red)' }}>&#128274; Locked</span>}
        </span>
        <span dir="ltr">
          {match.kickoff_time 
            ? new Date(match.kickoff_time).toLocaleString(locale === 'ar' ? 'ar-EG' : 'en-US', { timeZone: 'Asia/Kuwait', weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
            : 'TBD'
          }
        </span>
      </div>
      
      {showLiveScore && (
        <div style={{ textAlign: 'center', marginBottom: 12 }}>
          <span style={{ 
            background: match.status === 'live' ? 'var(--color-primary-red)' : 'var(--color-surface-light)',
            color: 'white',
            padding: '2px 8px',
            borderRadius: 12,
            fontSize: '10px',
            fontWeight: 'bold',
            textTransform: 'uppercase'
          }}>
            {statusTranslations[match.status] || match.status}
          </span>
          <div style={{ fontSize: '1.5rem', fontWeight: 'bold', marginTop: 4, letterSpacing: 2 }}>
            {match.home_score ?? 0} - {match.away_score ?? 0}
          </div>
          {(match.home_penalty_score !== null || match.home_extra_time_score !== null) && (
            <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
              {match.home_penalty_score !== null ? `(PEN: ${match.home_penalty_score}-${match.away_penalty_score})` : `(ET: ${match.home_extra_time_score}-${match.away_extra_time_score})`}
            </div>
          )}
        </div>
      )}
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 'var(--space-2)', alignItems: 'stretch' }}>
        <button 
          onClick={() => handleWinnerClick('home')}
          className={`btn ${isSelected('home') ? 'btn-primary' : 'btn-ghost'}`}
          disabled={isLocked || !match.home_team}
          style={{ padding: 'var(--space-3)', height: 'auto', display: 'flex', flexDirection: 'column', gap: 5, alignItems: 'center', flex: 1, opacity: (!match.home_team || isLocked) ? 0.6 : 1, cursor: isLocked ? 'not-allowed' : 'pointer' }}
        >
          <img src={homeFlag} alt={homeTeamName} width="40" height="26" style={{ borderRadius: 2, objectFit: 'cover', opacity: match.home_team ? 1 : 0.3 }} />
          <span style={{ fontSize: 'var(--fs-sm)', textAlign: 'center', lineHeight: 1.2 }}>{homeTeamName}</span>
        </button>

        <button 
          onClick={() => handleWinnerClick('draw')}
          className={`btn ${isSelected('draw') ? 'btn-primary' : 'btn-ghost'}`}
          disabled={isLocked || !match.home_team}
          style={{ padding: 'var(--space-3)', minWidth: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: isLocked ? 0.6 : 1, cursor: isLocked ? 'not-allowed' : 'pointer' }}
        >
          {t('pred_draw') || 'Draw'}
        </button>

        <button 
          onClick={() => handleWinnerClick('away')}
          className={`btn ${isSelected('away') ? 'btn-primary' : 'btn-ghost'}`}
          disabled={isLocked || !match.away_team}
          style={{ padding: 'var(--space-3)', height: 'auto', display: 'flex', flexDirection: 'column', gap: 5, alignItems: 'center', flex: 1, opacity: (!match.away_team || isLocked) ? 0.6 : 1, cursor: isLocked ? 'not-allowed' : 'pointer' }}
        >
          <img src={awayFlag} alt={awayTeamName} width="40" height="26" style={{ borderRadius: 2, objectFit: 'cover', opacity: match.away_team ? 1 : 0.3 }} />
          <span style={{ fontSize: 'var(--fs-sm)', textAlign: 'center', lineHeight: 1.2 }}>{awayTeamName}</span>
        </button>
      </div>

      {prediction?.winner && (
        <div style={{ marginTop: 'var(--space-4)', padding: 'var(--space-4)', background: 'var(--color-surface-light)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', animation: 'fadeIn 0.3s ease' }}>
          <p style={{ textAlign: 'center', marginBottom: 'var(--space-3)', fontSize: 'var(--fs-sm)', fontWeight: 600 }}>{t('pred_exact_score') || 'Exact Score Prediction'}</p>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 'var(--space-4)' }} dir="ltr">
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <input 
                type="text"
                inputMode="numeric"
                maxLength={2}
                className="form-input"
                style={{ width: 64, height: 64, textAlign: 'center', fontSize: '2rem', padding: 0, fontWeight: 'bold' }}
                value={prediction.homeScore || ''}
                onChange={(e) => handleScoreChange('home', e.target.value)}
                placeholder="-"
                disabled={isLocked}
              />
              <span style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>{homeTeamName}</span>
            </div>
            
            <span style={{ fontWeight: 'bold', fontSize: 'var(--fs-xl)', color: 'var(--color-text-muted)' }}>:</span>
            
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <input 
                type="text"
                inputMode="numeric"
                maxLength={2}
                className="form-input"
                style={{ width: 64, height: 64, textAlign: 'center', fontSize: '2rem', padding: 0, fontWeight: 'bold' }}
                value={prediction.awayScore || ''}
                onChange={(e) => handleScoreChange('away', e.target.value)}
                placeholder="-"
                disabled={isLocked}
              />
              <span style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>{awayTeamName}</span>
            </div>
          </div>
          
          {savedPrediction && savedPrediction.pointsEarned !== null && savedPrediction.pointsEarned !== undefined && (
            <div style={{ textAlign: 'center', marginTop: 12, color: 'var(--color-gold)', fontWeight: 'bold' }}>
              Points Earned: {savedPrediction.pointsEarned}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
