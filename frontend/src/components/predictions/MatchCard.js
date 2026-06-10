'use client';
import { useLanguage } from '@/context/LanguageContext';
import { useState, useEffect } from 'react';

export default function MatchCard({ match, prediction, savedPrediction, onPredict }) {
  const { t, locale } = useLanguage();
  const [isLockedLocal, setIsLockedLocal] = useState(false);

  useEffect(() => {
    if (match.kickoff_time) {
      const check = () => {
        const diffMinutes = (new Date(match.kickoff_time) - Date.now()) / 1000 / 60;
        if (diffMinutes <= 5 || match.status !== 'scheduled') {
          setIsLockedLocal(true);
        }
      };
      check();
      // Re-check every minute so the card locks automatically in the browser
      const interval = setInterval(check, 60_000);
      return () => clearInterval(interval);
    }
  }, [match.kickoff_time, match.status]);

  const isLocked = savedPrediction?.isLocked || isLockedLocal || match.status !== 'scheduled';

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
        homeScore: prediction?.homeScore ?? 0,
        awayScore: prediction?.awayScore ?? 0,
      });
    } else {
      // Clicking same button again deselects
      onPredict(match.match_number, null);
    }
  };

  const updateScore = (side, delta) => {
    if (isLocked) return;
    const current = parseInt(prediction?.[`${side}Score`] ?? 0, 10);
    onPredict(match.match_number, {
      ...prediction,
      [`${side}Score`]: Math.max(0, current + delta),
    });
  };

  const isSelected = (side) => prediction?.winner === side;
  const isFinished  = match.status === 'finished';
  const showLiveScore = ['live','halftime','extra_time','penalties','finished'].includes(match.status);

  // Points display: show whenever we have a saved + locked prediction with a result
  const showPoints = isLocked && savedPrediction?.pointsEarned != null && isFinished;

  const stageLabels = {
    group_stage:  locale === 'ar' ? 'مرحلة المجموعات' : 'GROUP STAGE',
    round_of_32:  locale === 'ar' ? 'دور الـ 32'       : 'ROUND OF 32',
    round_of_16:  locale === 'ar' ? 'دور الـ 16'       : 'ROUND OF 16',
    quarterfinal: locale === 'ar' ? 'ربع النهائي'      : 'QUARTER-FINALS',
    semifinal:    locale === 'ar' ? 'نصف النهائي'      : 'SEMI-FINALS',
    third_place:  locale === 'ar' ? 'المركز الثالث'    : 'THIRD PLACE',
    final:        locale === 'ar' ? 'النهائي'          : 'FINAL',
  };

  const statusLabels = {
    scheduled:   locale === 'ar' ? 'مجدول'         : 'Scheduled',
    live:        locale === 'ar' ? 'مباشر'         : 'Live',
    halftime:    locale === 'ar' ? 'بين الشوطين'   : 'Half Time',
    extra_time:  locale === 'ar' ? 'وقت إضافي'     : 'Extra Time',
    penalties:   locale === 'ar' ? 'ركلات ترجيح'   : 'Penalties',
    finished:    locale === 'ar' ? 'انتهت'         : 'Finished',
  };

  return (
    <div
      className={`card match-card ${isLocked ? 'locked' : ''}`}
      style={{
        marginBottom: 'var(--space-4)',
        transition: 'all 0.3s ease',
        borderRadius: 24,
        padding: 24,
        border: showLiveScore ? '1px solid var(--color-gold)' : '1px solid #EBEBEC',
        boxShadow: '0 4px 20px rgba(0,0,0,0.03)',
        backgroundColor: '#FFFFFF',
        opacity: isLocked ? 0.85 : 1,
      }}
    >
      {/* Header row: stage label + date */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <span style={{ fontWeight: 600, color: '#8899B4', fontSize: '0.85rem', letterSpacing: '0.05em' }}>
          {stageLabels[match.round]}
          {isLocked && <span style={{ color: 'var(--color-primary-red)', marginLeft: 8 }}>🔒</span>}
        </span>
        <span style={{ background: '#F3F4F6', padding: '4px 12px', borderRadius: 12, fontSize: '0.85rem', fontWeight: 700, color: '#111827' }} dir="ltr">
          {match.kickoff_time
            ? new Date(match.kickoff_time).toLocaleString(locale === 'ar' ? 'ar-EG' : 'en-US', {
                timeZone: 'Asia/Kuwait', weekday: 'short', month: 'short',
                day: 'numeric', hour: '2-digit', minute: '2-digit',
              })
            : 'TBD'}
        </span>
      </div>

      {/* Live / finished score banner */}
      {showLiveScore && (
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <span style={{
            background: match.status === 'live' ? 'var(--color-primary-red)' : '#F3F4F6',
            color: match.status === 'live' ? '#fff' : 'var(--color-text-secondary)',
            padding: '2px 10px', borderRadius: 12,
            fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase',
          }}>
            {statusLabels[match.status] || match.status}
          </span>
          <div style={{ fontSize: '1.8rem', fontWeight: 900, marginTop: 6, letterSpacing: 4, color: '#111827' }}>
            {match.home_score ?? 0} – {match.away_score ?? 0}
          </div>
          {(match.home_penalty_score != null) && (
            <div style={{ fontSize: '0.8rem', color: '#8899B4', marginTop: 2 }}>
              (Pens: {match.home_penalty_score} – {match.away_penalty_score})
            </div>
          )}
        </div>
      )}

      {/* Points earned banner — shown after match finishes */}
      {showPoints && (
        <div style={{
          textAlign: 'center',
          padding: '8px 16px',
          borderRadius: 12,
          marginBottom: 16,
          background: savedPrediction.pointsEarned > 0 ? 'rgba(169,223,0,0.12)' : 'rgba(147,149,152,0.1)',
          border: `1px solid ${savedPrediction.pointsEarned > 0 ? 'rgba(169,223,0,0.4)' : 'rgba(147,149,152,0.2)'}`,
        }}>
          <span style={{
            fontWeight: 800,
            fontSize: '1rem',
            color: savedPrediction.pointsEarned > 0 ? '#5a8500' : '#939598',
          }}>
            {savedPrediction.pointsEarned > 0
              ? `+${savedPrediction.pointsEarned} pts earned!`
              : 'No points this match'}
          </span>
        </div>
      )}

      {/* Teams */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32, padding: '0 10px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
          <div style={{ width: 80, height: 54, borderRadius: 10, overflow: 'hidden', border: '1px solid #F3F4F6', boxShadow: '0 4px 10px rgba(0,0,0,0.05)', marginBottom: 12, background: '#F9FAFB', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {homeTBC
              ? <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#8899B4', letterSpacing: '0.05em' }}>TBC</span>
              : <img src={homeFlag} alt={homeTeamName} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            }
          </div>
          <span style={{ fontSize: '0.95rem', fontWeight: 700, color: '#111827', textAlign: 'center' }}>{homeTeamName}</span>
        </div>

        <div style={{ background: '#F9FAFB', width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.8rem', color: '#111827' }}>
          VS
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
          <div style={{ width: 80, height: 54, borderRadius: 10, overflow: 'hidden', border: '1px solid #F3F4F6', boxShadow: '0 4px 10px rgba(0,0,0,0.05)', marginBottom: 12, background: '#F9FAFB', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {awayTBC
              ? <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#8899B4', letterSpacing: '0.05em' }}>TBC</span>
              : <img src={awayFlag} alt={awayTeamName} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            }
          </div>
          <span style={{ fontSize: '0.95rem', fontWeight: 700, color: '#111827', textAlign: 'center' }}>{awayTeamName}</span>
        </div>
      </div>

      {/* Winner selector — hidden when locked or TBC */}
      {!isLocked && match.home_team && match.away_team && (
        <div style={{ display: 'grid', gridTemplateColumns: isKnockout ? '1fr 1fr' : '1fr 1fr 1fr', gap: 12, marginBottom: prediction?.winner ? 24 : 0 }}>
         {[
            { key: 'home', label: homeTeamName },
            ...(!isKnockout ? [{ key: 'draw', label: t('pred_draw') || 'Draw' }] : []),
            { key: 'away', label: awayTeamName },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => handleWinnerClick(key)}
              style={{
                padding: '12px 8px',
                borderRadius: 20,
                border: isSelected(key) ? (key === 'draw' ? '2px solid #5F27E4' : '2px solid #A9DF00') : '1px solid #E5E7EB',
                background: isSelected(key) ? (key === 'draw' ? '#5F27E4' : '#A9DF00') : '#FFFFFF',
                color: isSelected(key) ? (key === 'draw' ? '#fff' : '#1a2e00') : '#4B5563',
                fontWeight: 700, fontSize: '0.9rem',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                boxShadow: isSelected(key) ? (key === 'draw' ? '0 4px 16px rgba(95,39,228,0.4)' : '0 4px 16px rgba(169,223,0,0.45)') : 'none',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                transform: isSelected(key) ? 'scale(1.03)' : 'scale(1)',
              }}
            >
              <span style={{ fontSize: '0.7rem', opacity: 0.8, marginBottom: 2, fontWeight: 600 }}>+ WIN</span>
              <span style={{ textAlign: 'center', lineHeight: 1.1 }}>{label}</span>
            </button>
          ))}
        </div>
      )}

      {/* Show saved selection when locked */}
      {isLocked && savedPrediction?.winner && (
        <div style={{ textAlign: 'center', padding: '8px 0', color: '#8899B4', fontSize: '0.85rem', fontWeight: 600 }}>
          {locale === 'ar' ? 'توقعك:' : 'Your pick:'}{' '}
          <span style={{ color: '#111827', fontWeight: 800 }}>
            {savedPrediction.winner === 'home' ? homeTeamName
              : savedPrediction.winner === 'away' ? awayTeamName
              : (t('pred_draw') || 'Draw')}
          </span>
          {savedPrediction.homeScore != null && (
            <span style={{ color: '#8899B4', marginLeft: 8 }}>
              ({savedPrediction.homeScore} – {savedPrediction.awayScore})
            </span>
          )}
        </div>
      )}

      {/* Score stepper — only shown when winner picked and not locked */}
      {prediction?.winner && !isLocked && (
        <div style={{ animation: 'fadeIn 0.3s ease' }}>
          <div style={{ textAlign: 'center', color: 'var(--color-gold)', fontWeight: 700, fontSize: '0.9rem', marginBottom: 16 }}>
            {locale === 'ar' ? 'النتيجة الدقيقة (+10)' : 'Exact Score (+10 pts)'}
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 16, marginBottom: 8 }}>
            {['home', 'away'].map((side, i) => (
              <div key={side} style={{ display: 'flex', alignItems: 'center' }}>
                {i === 1 && <div style={{ fontWeight: 800, color: '#9CA3AF', fontSize: '1.2rem', margin: '0 16px' }}>–</div>}
                <div style={{ display: 'flex', alignItems: 'center', background: '#F9FAFB', border: '1px solid #F3F4F6', borderRadius: 30, padding: 4 }}>
                  <button onClick={() => updateScore(side, -1)} style={{ width: 36, height: 36, borderRadius: '50%', border: 'none', background: 'transparent', fontSize: '1.2rem', fontWeight: 600, color: '#4B5563', cursor: 'pointer' }}>−</button>
                  <div style={{ width: 36, textAlign: 'center', fontSize: '1.4rem', fontWeight: 800, color: '#111827' }}>
                    {prediction[`${side}Score`] ?? 0}
                  </div>
                  <button onClick={() => updateScore(side, 1)} style={{ width: 36, height: 36, borderRadius: '50%', border: 'none', background: 'transparent', fontSize: '1.2rem', fontWeight: 600, color: '#4B5563', cursor: 'pointer' }}>+</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
