import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'ApparelAdvisor®',
  description: 'Wholesale line-sheet portal',
  robots: 'noindex',
  appleWebApp: {
    capable: true,
    title: 'ApparelAdvisor',
    statusBarStyle: 'black-translucent',
  },
};

export const viewport: Viewport = {
  themeColor: '#083344',
  width: 'device-width',
  initialScale: 1,
};

export default function ApparelPortalLayout({ children }: { children: ReactNode }) {
  return children;
}
