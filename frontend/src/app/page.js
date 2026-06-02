'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import Footer from '@/components/layout/Footer';
import { SCORING_TABLE, GROUPS } from '@/lib/constants';
import api from '@/lib/api';

function TrophyHeroIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width="48" height="48" style={{ color: 'var(--color-gold)' }}>
      <path d="M19 5h-2V3H7v2H5c-1.1 0-2 .9-2 2v1c0 2.55 1.92 4.63 4.39 4.94.63 1.5 1.98 2.63 3.61 2.96V19H7v2h10v-2h-4v-3.1c1.63-.33 2.98-1.46 3.61-2.96C19.08 12.63 21 10.55 21 8V7c0-1.1-.9-2-2-2zM5 8V7h2v3.82C5.84 10.4 5 9.3 5 8zm14 0c0 1.3-.84 2.4-2 2.82V7h2v1z"/>
    </svg>
  );
}

function ArrowRightIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
      <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

export default function HomePage() {
  const [teams, setTeams] = useState([]);

  useEffect(() => {
    api.get('/api/teams').then(res => {
      if (res.data) setTeams(res.data);
    }).catch(() => {});
  }, []);

  const groupedTeams = GROUPS.map(g => ({
    letter: g,
    teams: teams.filter(t => t.group_letter === g),
  }));

  return (
    <>
      {/* Hero */}
      <section className="hero">
        <div className="hero-content">
          <div className="hero-badge">
            R BUILD Prediction Challenge
          </div>
          <h1>Predict the Tournament Champion</h1>
          <p>
            Fill your knockout bracket from the Round of 32 to the Final.
            Predict match winners, guess exact scores, and compete against colleagues and friends
            as real results roll in.
          </p>
          <div className="hero-cta">
            <Link href="/register" className="btn btn-primary btn-xl">
              Start Predicting <ArrowRightIcon />
            </Link>
            <Link href="/leaderboard" className="btn btn-secondary btn-xl">
              View Leaderboard
            </Link>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="section" style={{ background: 'var(--color-surface-dark)' }}>
        <div className="container">
          <div className="section-header">
            <h2>How It Works</h2>
            <p>Three simple steps to join the prediction challenge</p>
          </div>
          <div className="steps-grid">
            <div className="card step-card">
              <div className="step-number">1</div>
              <h3>Create Your Account</h3>
              <p>Register with your name, mobile number, and email. Verify your number with a one-time code to secure your account.</p>
            </div>
            <div className="card step-card">
              <div className="step-number">2</div>
              <h3>Fill Your Bracket</h3>
              <p>Predict winners for every knockout match from the Round of 32 through the Final. Add score predictions for bonus points.</p>
            </div>
            <div className="card step-card">
              <div className="step-number">3</div>
              <h3>Earn Points</h3>
              <p>Watch your predictions come alive as real matches unfold. Earn points for correct picks and climb the global leaderboard.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Scoring */}
      <section className="section">
        <div className="container">
          <div className="section-header">
            <h2>Scoring System</h2>
            <p>Higher stakes in later rounds mean bigger rewards for bold predictions</p>
          </div>
          <div className="scoring-grid">
            {SCORING_TABLE.map((item) => (
              <div className="scoring-card" key={item.round}>
                <div className="scoring-round">{item.round}</div>
                <div className="scoring-points">{item.winner} pts</div>
                <div className="scoring-label">Correct Winner</div>
                {item.score && (
                  <>
                    <div className="scoring-points" style={{ fontSize: 'var(--fs-xl)', marginTop: 'var(--space-2)', color: 'var(--color-green)' }}>
                      {item.score} pts
                    </div>
                    <div className="scoring-label">Exact Score</div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Groups */}
      <section className="section" style={{ background: 'var(--color-surface-dark)' }}>
        <div className="container">
          <div className="section-header">
            <h2>The 48 Teams</h2>
            <p>12 groups of 4 teams compete in the biggest World Cup ever held</p>
          </div>
          <div className="groups-grid">
            {groupedTeams.map(group => (
              <div className="group-card" key={group.letter}>
                <div className="group-card-header">Group {group.letter}</div>
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

      {/* CTA */}
      <section className="section" style={{ textAlign: 'center' }}>
        <div className="container">
          <h2 style={{ marginBottom: 'var(--space-4)' }}>Ready to Make Your Predictions?</h2>
          <p style={{ color: 'var(--color-text-muted)', marginBottom: 'var(--space-8)', fontSize: 'var(--fs-lg)' }}>
            Join thousands of football fans competing for bragging rights and leaderboard glory.
          </p>
          <Link href="/register" className="btn btn-gold btn-xl">
            Create Your Bracket Now <ArrowRightIcon />
          </Link>
        </div>
      </section>

      <Footer />
    </>
  );
}
