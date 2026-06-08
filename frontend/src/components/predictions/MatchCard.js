'use client';
import { useLanguage } from '@/context/LanguageContext';
import { useState, useEffect } from 'react';

export default function MatchCard({ match, prediction, savedPrediction, onPredict }) {
  const { t, locale } = useLanguage();
  const [isLockedLocal, setIsLockedLocal] = useState(false);

  useEffect(() => {
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
  const homeFlag = match.home_team?.flag_url || null;
  const awayFlag = match.away_team?.flag_url || null;
  const isKnockout = ['round_of_32','round_of_16','quarterfinal','semifinal','third_place','final'].includes(match.round);
  const homeTBC = isKnockout && !match.home_team;
  const awayTBC = isKnockout && !match.away_team;

  const handleWinnerClick = (winner) => {
    if (isLocked || !match.home_team || !match.away_team) return;
    
    if (prediction?.winner !== winner) {
      onPredict(match.match_number, { 
        ...prediction, 
        winner, 
        homeScore: prediction?.homeScore || '0', 
        awayScore: prediction?.awayScore || '0' 
      });
    } else {
      onPredict(match.match_number, null);
    }
  };

  const updateScore = (side, delta) => {
    if (isLocked) return;
    const currentScore = parseInt(prediction?.[`${side}Score`] || '0', 10);
    const newScore = Math.max(0, currentScore + delta);
    onPredict(match.match_number, {
      ...prediction,
      [`${side}Score`]: newScore.toString()
    });
  };

  const isSelected = (side) => prediction?.winner === side;
  const showLiveScore = match.status === 'live' || match.status === 'finished' || match.status === 'halftime' || match.status === 'extra_time' || match.status === 'penalties';

  const stageTranslations = {
    'group_stage': locale === 'ar' ? 'مرحلة المجموعات' : 'GROUP STAGE',
    'round_of_32': locale === 'ar' ? 'دور الـ 32' : 'ROUND OF 32',
    'round_of_16': locale === 'ar' ? 'دور الـ 16' : 'ROUND OF 16',
    'quarterfinal': locale === 'ar' ? 'ربع النهائي' : 'QUARTER-FINALS',
    'semifinal': locale === 'ar' ? 'نصف النهائي' : 'SEMI-FINALS',
    'third_place': locale === 'ar' ? 'المركز الثالث' : 'THIRD PLACE',
    'final': locale === 'ar' ? 'النهائي' : 'FINAL',
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
      borderRadius: '24px',
      padding: '24px',
      border: showLiveScore ? '1px solid var(--color-gold)' : '1px solid #EBEBEC',
      boxShadow: '0 4px 20px rgba(0,0,0,0.03)',
      backgroundColor: '#FFFFFF',
      opacity: isLocked ? 0.8 : 1
    }}>
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <span style={{ fontWeight: 600, color: '#8899B4', fontSize: '0.85rem', letterSpacing: '0.05em' }}>
          {stageTranslations[match.round]} {isLocked && <span style={{ color: 'var(--color-primary-red)', marginLeft: 8 }}>&#128274;</span>}
        </span>
        <span style={{ background: '#F3F4F6', padding: '4px 12px', borderRadius: '12px', fontSize: '0.85rem', fontWeight: 700, color: '#111827' }} dir="ltr">
          {match.kickoff_time 
            ? new Date(match.kickoff_time).toLocaleString(locale === 'ar' ? 'ar-EG' : 'en-US', { timeZone: 'Asia/Kuwait', weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
            : 'TBD'
          }
        </span>
      </div>
      
      {/* Live Score Header (If active) */}
      {showLiveScore && (
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <span style={{ 
            background: match.status === 'live' ? 'var(--color-primary-red)' : 'var(--color-surface-light)',
            color: match.status === 'live' ? 'white' : 'var(--color-text-secondary)',
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
        </div>
      )}
      
      {/* Teams Area */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px', padding: '0 10px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
          <div style={{ width: 80, height: 54, borderRadius: '10px', overflow: 'hidden', border: '1px solid #F3F4F6', boxShadow: '0 4px 10px rgba(0,0,0,0.05)', marginBottom: 12, background: '#F9FAFB', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {homeTBC ? (
              <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#8899B4', letterSpacing: '0.05em' }}>TBC</span>
            ) : (
              <img src={homeFlag} alt={homeTeamName} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            )}
          </div>
          <span style={{ fontSize: '0.95rem', fontWeight: 700, color: '#111827', textAlign: 'center' }}>{homeTeamName}</span>
        </div>

        <div style={{ background: '#F9FAFB', width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.8rem', color: '#111827' }}>
          VS
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
          <div style={{ width: 80, height: 54, borderRadius: '10px', overflow: 'hidden', border: '1px solid #F3F4F6', boxShadow: '0 4px 10px rgba(0,0,0,0.05)', marginBottom: 12, background: '#F9FAFB', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {awayTBC ? (
              <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#8899B4', letterSpacing: '0.05em' }}>TBC</span>
            ) : (
              <img src={awayFlag} alt={awayTeamName} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            )}
          </div>
          <span style={{ fontSize: '0.95rem', fontWeight: 700, color: '#111827', textAlign: 'center' }}>{awayTeamName}</span>
        </div>
      </div>
              
      {/* Winner Selector Buttons */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: prediction?.winner ? '24px' : '0' }}>
        <button 
          onClick={() => handleWinnerClick('home')}
          disabled={isLocked || !match.home_team}
          style={{
            padding: '12px 8px',
            borderRadius: '20px',
            border: isSelected('home') ? '2px solid #A9DF00' : '1px solid #E5E7EB',
            background: isSelected('home') ? '#A9DF00' : '#FFFFFF',
            color: isSelected('home') ? '#1a2e00' : '#4B5563',
            fontWeight: 700,
            fontSize: '0.9rem',
            cursor: (isLocked || !match.home_team) ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s ease',
            boxShadow: isSelected('home') ? '0 4px 16px rgba(169, 223, 0, 0.45)' : 'none',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            transform: isSelected('home') ? 'scale(1.03)' : 'scale(1)'
          }}
        >
          <span style={{ fontSize: '0.7rem', opacity: 0.8, marginBottom: '2px', fontWeight: 600 }}>+ WIN</span>
          <span style={{ textAlign: 'center', lineHeight: 1.1 }}>{homeTeamName}</span>
        </button>

        <button 
          onClick={() => handleWinnerClick('draw')}
          disabled={isLocked || !match.home_team}
          style={{
            padding: '12px 8px',
            borderRadius: '20px',
            border: isSelected('draw') ? '2px solid #5F27E4' : '1px solid #E5E7EB',
            background: isSelected('draw') ? '#5F27E4' : '#FFFFFF',
            color: isSelected('draw') ? '#ffffff' : '#4B5563',
            fontWeight: 700,
            fontSize: '0.9rem',
            cursor: (isLocked || !match.home_team) ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s ease',
            boxShadow: isSelected('draw') ? '0 4px 16px rgba(95, 39, 228, 0.4)' : 'none',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            transform: isSelected('draw') ? 'scale(1.03)' : 'scale(1)'
          }}
        >
          <span style={{ fontSize: '0.7rem', opacity: 0.8, marginBottom: '2px', fontWeight: 600 }}>+ WIN</span>
          <span>{t('pred_draw') || 'Draw'}</span>
        </button>

        <button 
          onClick={() => handleWinnerClick('away')}
          disabled={isLocked || !match.away_team}
          style={{
            padding: '12px 8px',
            borderRadius: '20px',
            border: isSelected('away') ? '2px solid #A9DF00' : '1px solid #E5E7EB',
            background: isSelected('away') ? '#A9DF00' : '#FFFFFF',
            color: isSelected('away') ? '#1a2e00' : '#4B5563',
            fontWeight: 700,
            fontSize: '0.9rem',
            cursor: (isLocked || !match.away_team) ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s ease',
            boxShadow: isSelected('away') ? '0 4px 16px rgba(169, 223, 0, 0.45)' : 'none',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            transform: isSelected('away') ? 'scale(1.03)' : 'scale(1)'
          }}
        >
          <span style={{ fontSize: '0.7rem', opacity: 0.8, marginBottom: '2px', fontWeight: 600 }}>+ WIN</span>
          <span style={{ textAlign: 'center', lineHeight: 1.1 }}>{awayTeamName}</span>
        </button>
      </div>

      {/* Exact Score Section */}
      {prediction?.winner && (
        <div style={{ animation: 'fadeIn 0.3s ease' }}>
          <div style={{ textAlign: 'center', color: 'var(--color-gold)', fontWeight: 700, fontSize: '0.9rem', marginBottom: '16px' }}>
            Final Score (+10)
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
            {/* Home Stepper */}
            <div style={{ display: 'flex', alignItems: 'center', background: '#F9FAFB', border: '1px solid #F3F4F6', borderRadius: '30px', padding: '4px' }}>
              <button onClick={() => updateScore('home', -1)} disabled={isLocked} style={{ width: 36, height: 36, borderRadius: '50%', border: 'none', background: 'transparent', fontSize: '1.2rem', fontWeight: 600, color: '#4B5563', cursor: isLocked ? 'not-allowed' : 'pointer' }}>-</button>
              <div style={{ width: 36, textAlign: 'center', fontSize: '1.4rem', fontWeight: 800, color: '#111827' }}>{prediction.homeScore || '0'}</div>
              <button onClick={() => updateScore('home', 1)} disabled={isLocked} style={{ width: 36, height: 36, borderRadius: '50%', border: 'none', background: 'transparent', fontSize: '1.2rem', fontWeight: 600, color: '#4B5563', cursor: isLocked ? 'not-allowed' : 'pointer' }}>+</button>
            </div>
            
            <div style={{ fontWeight: 800, color: '#9CA3AF', fontSize: '1.2rem' }}>-</div>
            
            {/* Away Stepper */}
            <div style={{ display: 'flex', alignItems: 'center', background: '#F9FAFB', border: '1px solid #F3F4F6', borderRadius: '30px', padding: '4px' }}>
              <button onClick={() => updateScore('away', -1)} disabled={isLocked} style={{ width: 36, height: 36, borderRadius: '50%', border: 'none', background: 'transparent', fontSize: '1.2rem', fontWeight: 600, color: '#4B5563', cursor: isLocked ? 'not-allowed' : 'pointer' }}>-</button>
              <div style={{ width: 36, textAlign: 'center', fontSize: '1.4rem', fontWeight: 800, color: '#111827' }}>{prediction.awayScore || '0'}</div>
              <button onClick={() => updateScore('away', 1)} disabled={isLocked} style={{ width: 36, height: 36, borderRadius: '50%', border: 'none', background: 'transparent', fontSize: '1.2rem', fontWeight: 600, color: '#4B5563', cursor: isLocked ? 'not-allowed' : 'pointer' }}>+</button>
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
