import type { ReactNode } from 'react';
import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  title: 'Coach work app',
  applicationName: 'Advisor Work',
  appleWebApp: {
    capable: true,
    title: 'Coach',
    statusBarStyle: 'black-translucent',
  },
  manifest: '/member-app.webmanifest',
};

export const viewport: Viewport = {
  themeColor: '#0f172a',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function CoachWorkLayout({ children }: { children: ReactNode }) {
  return children;
}
