'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';
import { ROUND_NAMES } from '@/lib/constants';

export default function ThankYouPage() {
  const { user, isAuthenticated } = useAuth();
  const [predictions, setPredictions] = useState([]);
  const [champion, setChampion] = useState(null);

  useEffect(() => {
    if (isAuthenticated) {
      api.get('/api/predictions').then(res => {
        setPredictions(res.data?.predictions || []);
        setChampion(res.data?.champion_prediction?.predicted_champion || null);
      }).catch(() => {});
    }
  }, [isAuthenticated]);

  const groupedByRound = predictions.reduce((acc, p) => {
    const round = p.match_number >= 73 && p.match_number <= 88 ? 'round_of_32'
      : p.match_number >= 89 && p.match_number <= 96 ? 'round_of_16'
      : p.match_number >= 97 && p.match_number <= 100 ? 'quarterfinal'
      : p.match_number >= 101 && p.match_number <= 102 ? 'semifinal'
      : 'final';
    (acc[round] = acc[round] || []).push(p);
    return acc;
  }, {});

  return (
    <div style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-8) var(--space-4)' }}>
      <div className="card card-elevated" style={{ width: '100%', maxWidth: 600, padding: 'var(--space-8)', textAlign: 'center' }}>
        <div className="thank-you-icon">
          <svg viewBox="0 0 24 24" fill="currentColor" width="80" height="80">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
          </svg>
        </div>
        <h2 style={{ marginBottom: 'var(--space-2)' }}>Predictions Submitted</h2>
        <p style={{ color: 'var(--color-text-muted)', marginBottom: 'var(--space-6)' }}>
          Your bracket is locked in. Check back as real matches unfold to see your points grow.
        </p>

        {champion && (
          <div className="card card-highlighted" style={{ marginBottom: 'var(--space-6)', padding: 'var(--space-4)' }}>
            <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-gold)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 'var(--space-2)' }}>Your Predicted Champion</div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-3)' }}>
              <img src={champion.flag_url} alt={champion.name} className="team-flag-lg" />
              <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 'var(--fs-xl)' }}>{champion.name}</span>
            </div>
          </div>
        )}

        <div className="prediction-summary" style={{ textAlign: 'left' }}>
          {Object.entries(groupedByRound).map(([round, preds]) => (
            <div key={round} style={{ marginBottom: 'var(--space-4)' }}>
              <h4 style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-2)' }}>{ROUND_NAMES[round] || round}</h4>
              {preds.map(p => (
                <div key={p.id} className="prediction-summary-item">
                  <span style={{ fontSize: 'var(--fs-sm)' }}>Match {p.match_number}</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                    {p.predicted_winner && (
                      <>
                        <img src={p.predicted_winner.flag_url} alt={p.predicted_winner.name} className="team-flag-sm" />
                        <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 600 }}>{p.predicted_winner.name}</span>
                      </>
                    )}
                    {p.predicted_home_score != null && p.predicted_away_score != null && (
                      <span className="badge badge-muted">{p.predicted_home_score}-{p.predicted_away_score}</span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'center', marginTop: 'var(--space-6)', flexWrap: 'wrap' }}>
          <Link href="/bracket" className="btn btn-secondary">Edit Predictions</Link>
          <Link href="/leaderboard" className="btn btn-primary">View Leaderboard</Link>
        </div>
      </div>
    </div>
  );
}
