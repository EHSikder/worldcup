import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-grid">
          <div className="footer-brand">
            <h3>WC2026 Predictor</h3>
            <p>
              Predict the FIFA World Cup 2026 knockout bracket, compete against friends and fans
              worldwide, and climb the leaderboard as real results come in. From the Round of 32
              to the Final in New York — every pick counts.
            </p>
          </div>
          <div className="footer-links">
            <h4>Navigation</h4>
            <Link href="/">Home</Link>
            <Link href="/bracket">Bracket</Link>
            <Link href="/leaderboard">Leaderboard</Link>
            <Link href="/register">Register</Link>
          </div>
          <div className="footer-links">
            <h4>Legal</h4>
            <Link href="/terms">Terms of Service</Link>
            <Link href="/privacy">Privacy Policy</Link>
          </div>
        </div>
        <div className="footer-bottom">
          <span>&copy; {new Date().getFullYear()} WC2026 Predictor. All rights reserved.</span>
          <span>FIFA World Cup 2026 — USA, Mexico, Canada</span>
        </div>
      </div>
    </footer>
  );
}
