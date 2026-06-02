import { AuthProvider } from '@/context/AuthContext';
import ConditionalHeader from '@/components/layout/ConditionalHeader';
import './globals.css';

export const metadata = {
  title: 'R BUILD Predictor — Win With Our Program',
  description: 'Predict match scores and compete for glory in the R BUILD knockout prediction challenge.',
  keywords: 'R BUILD, bracket prediction, competition, prediction game',
  openGraph: {
    title: 'R BUILD Predictor — Win With Our Program',
    description: 'Predict the champion and compete in the ultimate R BUILD prediction challenge.',
    type: 'website',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#26445F" />
      </head>
      <body>
        <AuthProvider>
          <ConditionalHeader />
          <main>{children}</main>
        </AuthProvider>
      </body>
    </html>
  );
}
