import { Inter, Outfit } from 'next/font/google';
import { AuthProvider } from '@/context/AuthContext';
import ConditionalHeader from '@/components/layout/ConditionalHeader';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const outfit = Outfit({
  subsets: ['latin'],
  variable: '--font-outfit',
  display: 'swap',
  weight: ['400', '500', '600', '700', '800'],
});

export const metadata = {
  title: 'WC2026 Predictor — Predict the FIFA World Cup 2026 Champion',
  description: 'Fill your bracket, predict match scores, and compete for glory in the ultimate FIFA World Cup 2026 knockout prediction challenge. From the Round of 32 to the Final in New York.',
  keywords: 'World Cup 2026, FIFA, bracket prediction, football, soccer, knockout stage, prediction game',
  openGraph: {
    title: 'WC2026 Predictor — Predict the World Cup Champion',
    description: 'Fill your bracket and compete in the ultimate FIFA World Cup 2026 prediction challenge.',
    type: 'website',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${inter.variable} ${outfit.variable}`} suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#0A1628" />
      </head>
      <body style={{ fontFamily: 'var(--font-body)' }}>
        <AuthProvider>
          <ConditionalHeader />
          <main>{children}</main>
        </AuthProvider>
      </body>
    </html>
  );
}
