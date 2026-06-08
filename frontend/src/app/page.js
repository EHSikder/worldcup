'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { SCORING_TABLE, GROUPS } from '@/lib/constants';
import api from '@/lib/api';
import { useLanguage } from '@/context/LanguageContext';

function TrophyHeroIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width="48" height="48" style={{ color: 'var(--color-gold)' }}>
      <path d="M19 5h-2V3H7v2H5c-1.1 0-2 .9-2 2v1c0 2.55 1.92 4.63 4.39 4.94.63 1.5 1.98 2.63 3.61 2.96V19H7v2h10v-2h-4v-3.1c1.63-.33 2.98-1.46 3.61-2.96C19.08 12.63 21 10.55 21 8V7c0-1.1-.9-2-2-2zM5 8V7h2v3.82C5.84 10.4 5 9.3 5 8zm14 0c0 1.3-.84 2.4-2 2.82V7h2v1z"/>
    </svg>
  );
}

function ArrowIcon({ locale }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20" style={{ transform: locale === 'ar' ? 'rotate(180deg)' : 'none' }}>
      <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

export default function HomePage() {
  const [teams, setTeams] = useState([]);
  const { t, locale } = useLanguage();

  useEffect(() => {
    api.get('/api/teams').then(res => {
      if (res.data) setTeams(res.data);
    }).catch(() => {});
  }, []);

  const groupedTeams = GROUPS.map(g => ({
    letter: g,
    teams: teams.filter(t => t.group_letter === g),
  }));

  const translations = {
    prize_title: locale === 'ar' ? 'هل تريد التوقع والفوز بـ 1000 دولار؟' : 'Want to Predict and Win $1000?',
    prize_desc: locale === 'ar' ? 'كن صاحب المركز الأول على مستوى العالم في نهاية البطولة واربح الجائزة الكبرى!' : 'Be the #1 worldwide ranker at the end of the tournament and take home the grand prize!',
    predict_now_btn: locale === 'ar' ? 'توقع الآن' : 'Predict Now',
    hero_prize: locale === 'ar' ? 'المركز الأول يربح 1000 دولار 💰' : '1st Place Wins $1000 💰',
  };

  return (
    <>
      {/* Hero */}
      <section className="hero-new" style={{ direction: 'ltr' }}>
        {/* Background image — flips in RTL via CSS class */}
        <div className="hero-new-bg" style={{ backgroundImage: "url('/images/fans-bg.jpg')" }}></div>

        {/* Right Side — Always visible */}
        <div className="hero-new-right" style={{ direction: locale === 'ar' ? 'rtl' : 'ltr' }}>
          <div className="hero-right-content">
            <h2 className="hero-subtitle">{locale === 'ar' ? t('hero_right_subtitle') : 'R-BUILD WORLD CUP CHALLENGE'}</h2>
            <h1 className="hero-title">{locale === 'ar' ? t('hero_right_title') : 'WIN $1000'}</h1>
            <p className="hero-desc">
              {locale === 'ar' ? t('hero_desc_1') : 'Predict match results and scores, earn points, climb the leaderboard, and become the R-Build Champion.'}
            </p>
            <div className="hero-actions">
              <Link href="/login" className="btn-predict">{locale === 'ar' ? t('hero_cta_primary') : 'PREDICT'}</Link>
              <Link href="/leaderboard" className="link-leaderboard">{locale === 'ar' ? t('hero_cta_secondary') : 'LEADERBOARD'}</Link>
            </div>
          </div>
        </div>
      </section>

        {/* Left Side — Desktop only */}
        <div className="hero-new-left">
          <div className="hero-left-content" style={{ direction: locale === 'ar' ? 'rtl' : 'ltr' }}>
            <div className="hero-left-text">
              {locale === 'ar' ? (
                <>{t('hero_left_line1')}<br/>{t('hero_left_line2')}<br/>{t('hero_left_line3')}</>
              ) : (
                <>PREDICT.<br/>COMPETE.<br/>WIN.</>
              )}
            </div>
            <div className="hero-logo-container">           
            </div>
          </div>
        </div>

      {/* How It Works */}
      <section className="section" style={{ background: 'var(--color-surface-dark)' }}>
        <div className="container">
          <div className="section-header">
            <h2>{t('steps_title')}</h2>
            <p>{t('steps_subtitle')}</p>
          </div>
          <div className="steps-grid">
            <div className="card step-card">
              <div className="step-number">1</div>
              <h3>{t('step_1_title')}</h3>
              <p>{t('step_1_desc')}</p>
            </div>
            <div className="card step-card">
              <div className="step-number">2</div>
              <h3>{t('step_2_title')}</h3>
              <p>{t('step_2_desc')}</p>
            </div>
            <div className="card step-card" style={{ border: '2px solid var(--color-gold)' }}>
              <div className="step-number">3</div>
              <h3>{t('step_3_title')}</h3>
              <p>{t('step_3_desc')}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Scoring */}
      <section className="section">
        <div className="container">
          <div className="section-header">
            <h2>{t('scoring_title')}</h2>
            <p>{t('scoring_subtitle')}</p>
          </div>
          <div style={{
            background: 'linear-gradient(135deg, #5F27E4 0%, #3d1a9e 100%)',
            border: '2px solid #A9DF00',
            borderRadius: '20px',
            padding: '28px 32px',
            marginBottom: '40px',
            maxWidth: '600px',
            margin: '0 auto 40px auto',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            boxShadow: '0 8px 32px rgba(95, 39, 228, 0.4)',
            position: 'relative',
            overflow: 'hidden'
          }}>
            {/* Glow effect */}
            <div style={{ position: 'absolute', top: -30, right: -30, width: 120, height: 120, borderRadius: '50%', background: 'rgba(169,223,0,0.15)', pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', bottom: -20, left: -20, width: 80, height: 80, borderRadius: '50%', background: 'rgba(169,223,0,0.1)', pointerEvents: 'none' }} />
            <h3 style={{ color: '#A9DF00', marginBottom: '8px', fontSize: '1.4rem', fontWeight: 900, letterSpacing: '0.03em', position: 'relative' }}>{t('scoring_exact_bonus_title')}</h3>
            <div style={{ fontSize: '3rem', fontWeight: 900, color: '#ffffff', lineHeight: 1, position: 'relative' }}>+10</div>
            <div style={{ fontSize: '1rem', fontWeight: 700, color: '#A9DF00', marginBottom: 6, position: 'relative' }}>{t('scoring_pts')}</div>
            <p style={{ color: 'rgba(255,255,255,0.75)', marginTop: '4px', fontSize: '0.9rem', position: 'relative' }}>{t('scoring_exact_bonus_desc')}</p>
          </div>

          <div className="scoring-grid">
            {SCORING_TABLE.map((item) => (
              <div className="scoring-card" key={item.round} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', minHeight: '140px' }}>
                <div className="scoring-round" style={{ marginBottom: '16px', fontSize: '1.1rem' }}>{t(item.roundKey)}</div>
                <div className="scoring-points" style={{ fontSize: '1.8rem', fontWeight: 'bold' }}>{item.points}</div>
                <div className="scoring-label" style={{ marginTop: '8px', color: 'var(--color-text-muted)' }}>{t('scoring_pts')}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Groups */}
      <section className="section" style={{ background: 'var(--color-surface-dark)' }}>
        <div className="container">
          <div className="section-header">
            <h2>{t('teams_title')}</h2>
            <p>{t('teams_subtitle')}</p>
          </div>
          <div className="groups-grid">
            {groupedTeams.map(group => (
              <div className="group-card" key={group.letter}>
                <div className="group-card-header">{t('group')} {group.letter}</div>
                <div className="group-card-body">
                  {group.teams.length > 0 ? group.teams.map(team => (
                    <div className="group-team-row" key={team.id}>
                      <img src={team.flag_url} alt={team.name} className="team-flag" loading="lazy" />
                      <span className="team-name">{team.name}</span>
                    </div>
                  )) : (
                    Array.from({ length: 4 }).map((_, i) => (
                      <div className="group-team-row" key={i}>
                        <div className="skeleton" style={{ width: 28, height: 20 }} />
                        <div className="skeleton" style={{ width: '60%', height: 16 }} />
                      </div>
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA -> Prizes Section */}
      <section className="section" style={{ textAlign: 'center', background: 'linear-gradient(to top, rgba(212,168,67,0.1), transparent)' }}>
        <div className="container">        
          <p style={{ color: 'var(--color-text-muted)', marginBottom: 'var(--space-8)', fontSize: 'var(--fs-lg)', maxWidth: 600, margin: '0 auto var(--space-8)' }}>
            {translations.prize_desc}
          </p>
          <Link href="/login" className="btn-predict" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            {translations.predict_now_btn} <ArrowIcon locale={locale} />
          </Link>
        </div>
      </section>
    </>
  );
}
