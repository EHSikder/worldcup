'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import Footer from '@/components/layout/Footer';
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
      <section className="hero">
        <div className="hero-content">
          <div className="hero-badge" style={{ display: 'inline-flex', gap: '8px', background: 'var(--color-primary-red)', padding: '6px 16px', borderRadius: 20, fontWeight: 'bold' }}>
            <span>{translations.hero_prize}</span>
          </div>
          <h1>{t('hero_title')}</h1>
          <p>
            {t('hero_desc_1')}
            <br /><br />
            <span style={{ color: 'var(--color-gold)', fontSize: '1.2em', fontWeight: 'bold' }}>{t('hero_desc_2')}</span>
          </p>
          <div className="hero-cta">
            <Link href="/login" className="btn btn-primary btn-xl">
              {t('hero_cta_primary')} <ArrowIcon locale={locale} />
            </Link>
            <Link href="/leaderboard" className="btn btn-secondary btn-xl">
              {t('hero_cta_secondary')}
            </Link>
          </div>
        </div>
      </section>

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
              <div className="step-number" style={{ background: 'var(--color-gold)' }}>3</div>
              <h3 style={{ color: 'var(--color-gold)' }}>Win $1000!</h3>
              <p>Top the leaderboard at the end of the tournament and you walk away with the grand prize of $1000 USD!</p>
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
          <div className="scoring-grid">
            {SCORING_TABLE.map((item) => (
              <div className="scoring-card" key={item.round}>
                <div className="scoring-round">{item.round}</div>
                <div className="scoring-points">{item.points} {t('scoring_pts')}</div>
                <div className="scoring-label">per correct prediction</div>
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
          <TrophyHeroIcon />
          <h2 style={{ marginBottom: 'var(--space-4)', color: 'var(--color-gold)', marginTop: 'var(--space-4)' }}>
            {translations.prize_title}
          </h2>
          <p style={{ color: 'var(--color-text-muted)', marginBottom: 'var(--space-8)', fontSize: 'var(--fs-lg)', maxWidth: 600, margin: '0 auto var(--space-8)' }}>
            {translations.prize_desc}
          </p>
          <Link href="/login" className="btn btn-gold btn-xl">
            {translations.predict_now_btn} <ArrowIcon locale={locale} />
          </Link>
        </div>
      </section>

      <Footer />
    </>
  );
}
