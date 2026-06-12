'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { SCORING_TABLE, GROUPS } from '@/lib/constants';
import api from '@/lib/api';
import { useLanguage } from '@/context/LanguageContext';

function ArrowIcon({ locale }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20"
      style={{ transform: locale === 'ar' ? 'rotate(180deg)' : 'none' }}>
      <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

export default function HomePage() {
  const [teams, setTeams] = useState([]);
  const { t, locale } = useLanguage();
  const isArabic = locale === 'ar';

  useEffect(() => {
    api.get('/api/teams').then(res => {
      if (res.data) setTeams(res.data);
    }).catch(() => {});
  }, []);

  const groupedTeams = GROUPS.map(g => ({
    letter: g,
    teams: teams.filter(tm => tm.group_letter === g),
  }));

  return (
    <>
      {/* ── HERO BANNER ─────────────────────────────────────────── */}
      <section className="hero-new" style={{ direction: 'ltr' }}>
        {/* Background images — user uploads their own */}
        <div
          className="hero-new-bg hero-bg-desktop"
          style={{
            backgroundImage: isArabic
              ? "url('/images/banner-desktop-ar.jpg')"
              : "url('/images/banner-desktop-en.jpg')"
          }}
        />
        <div
          className="hero-new-bg hero-bg-mobile"
          style={{
            backgroundImage: isArabic
              ? "url('/images/banner-mobile-ar.jpg')"
              : "url('/images/banner-mobile-en.jpg')"
          }}
        />

        {/* Left side — empty image area */}
        <div className="hero-new-left" />

        {/* Right side — all text */}
        <div className="hero-new-right" style={{ direction: isArabic ? 'rtl' : 'ltr' }}>
          <div className="hero-right-content">

            {/* Eyebrow label */}
            <p className="hero-subtitle">
              {isArabic ? t('hero_right_subtitle') : 'R-BUILD WORLD CUP CHALLENGE'}
            </p>

            {/* Main headline — single line, centered */}
            <h1 className="hero-title">
              {isArabic ? 'توقّع. تنافس. ارتقِ.' : 'PREDICT. COMPETE. RISE.'}
            </h1>

            {/* CTA buttons */}
            <div className="hero-actions">
              <Link href="/login" className="btn-predict">
                {isArabic ? t('hero_cta_primary') : 'Predict Now'}
              </Link>
              <Link href="/leaderboard" className="link-leaderboard">
                {isArabic ? t('hero_cta_secondary') : 'LEADERBOARD'}
              </Link>
            </div>

          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ────────────────────────────────────────── */}
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
            <div className="card step-card">
              <div className="step-number">3</div>
              <h3>{t('step_3_title')}</h3>
              <p>{t('step_3_desc')}</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── SCORING ─────────────────────────────────────────────── */}
      <section className="section">
        <div className="container">
          <div className="section-header">
            <h2>{t('scoring_title')}</h2>
            <p>{t('scoring_subtitle')}</p>
          </div>

          {/* Exact score bonus card */}
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

      {/* ── GROUPS ──────────────────────────────────────────────── */}
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

      {/* ── BOTTOM CTA ──────────────────────────────────────────── */}
      <section className="section" style={{ textAlign: 'center', background: 'linear-gradient(to top, rgba(212,168,67,0.08), transparent)' }}>
        <div className="container">
          <h2 style={{ marginBottom: 'var(--space-4)', fontSize: 'clamp(1.8rem, 4vw, 2.8rem)' }}>
            {t('cta_title')}
          </h2>
          <p style={{ color: 'var(--color-text-muted)', marginBottom: 'var(--space-8)', fontSize: 'var(--fs-lg)', maxWidth: 600, margin: '0 auto var(--space-8)' }}>
            {t('cta_subtitle')}
          </p>
          <Link href="/login" className="btn-predict" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            {t('cta_btn')} <ArrowIcon locale={locale} />
          </Link>
        </div>
      </section>
    </>
  );
}
