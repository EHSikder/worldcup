'use client';
import Link from 'next/link';
import { useLanguage } from '@/context/LanguageContext';

export default function Footer() {
  const { t } = useLanguage();

  const partners = [
    { name: 'EXPAMET', src: '/images/partner-expamet.png' },
    { name: 'K5', src: '/images/partner-k5.png' },
    { name: 'MASTER BUILDERS', src: '/images/partner-masterbuilders.png' },
    { name: 'SOS Chemicals', src: '/images/partner-sos.png' },
    { name: 'Flowcrete', src: '/images/partner-flowcrete.png' },
    { name: 'X-CALIBUR', src: '/images/partner-xcalibur.png' },
    { name: 'TREMCO', src: '/images/partner-tremco.png' },
  ];

  return (
    <footer className="footer">
      <div className="container" style={{ padding: '3rem 0' }}>
        <div className="footer-grid">
          <div className="footer-brand">
            <h3>{t('footer_brand_name')}</h3>
            <p>{t('footer_brand_desc')}</p>
          </div>
          <div className="footer-links">
            <h4>{t('footer_nav_title')}</h4>
            <Link href="/">{t('footer_nav_home')}</Link>
            <Link href="/predictions">{t('footer_nav_predictions')}</Link>
            <Link href="/leaderboard">{t('footer_nav_leaderboard')}</Link>
            <Link href="/login">{t('footer_nav_login')}</Link>
          </div>
          <div className="footer-links">
            <h4>{t('footer_legal_title')}</h4>
            <Link href="/terms">{t('footer_terms')}</Link>
            <Link href="/privacy">{t('footer_privacy')}</Link>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} R BUILD. {t('footer_copy')}</span>
          <span>{t('footer_powered')}</span>
        </div>
      </div>
    </footer>
  );
}
