import Link from 'next/link';

export default function Footer() {
  const partners = [
    { name: 'EXPAMET', src: '/images/partner-expamet.png' },
    { name: 'K5', src: '/images/partner-k5.png' },
    { name: 'MASTER BUILDERS', src: '/images/partner-masterbuilders.png' },
    { name: 'SOS Chemicals', src: '/images/partner-sos.png' },
    { name: 'Flowcrete', src: '/images/partner-flowcrete.png' },
    { name: 'X-CALIBUR', src: '/images/partner-xcalibur.png' },
    { name: 'TREMCO', src: '/images/partner-tremco.png' }
  ];

  return (
    <footer className="footer">
      <div className="partners-banner">
        <div className="container">
          <div className="partners-grid">
            {partners.map(partner => (
              <img 
                key={partner.name}
                src={partner.src} 
                alt={partner.name} 
                title={partner.name}
                className="partner-logo"
                onError={(e) => { e.target.style.display = 'none'; }}
              />
            ))}
          </div>
        </div>
      </div>
      <div className="container" style={{ padding: '3rem 0' }}>
        <div className="footer-grid">
          <div className="footer-brand">
            <h3>R BUILD Predictor</h3>
            <p>
              Predict the tournament outcomes, compete against friends and colleagues,
              and climb the leaderboard in the R BUILD Prediction Challenge.
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
          <span>&copy; {new Date().getFullYear()} R BUILD. All rights reserved.</span>
          <span>Powered by R BUILD and Partners</span>
        </div>
      </div>
    </footer>
  );
}
