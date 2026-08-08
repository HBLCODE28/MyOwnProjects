import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'תאר אותי',
  description: 'משחק תיאור במילה אחת וניחושים בזמן אמת',
  applicationName: 'תאר אותי',
  appleWebApp: {
    capable: true,
    title: 'תאר אותי',
    statusBarStyle: 'black-translucent',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#14121F',
  viewportFit: 'cover',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="he" dir="rtl" style={{ fontFamily: 'Arial, sans-serif' }}>
      <body style={{ fontFamily: 'Arial, sans-serif' }}>{children}</body>
    </html>
  );
}
