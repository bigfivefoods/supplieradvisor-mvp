import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'ConstructionAdvisor®',
  description: 'Client and contractor project portal',
  robots: 'noindex',
  appleWebApp: {
    capable: true,
    title: 'ConstructionAdvisor',
    statusBarStyle: 'black-translucent',
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: '#1c1917',
  width: 'device-width',
  initialScale: 1,
};

export default function ConstructionPortalLayout({
  children,
}: {
  children: ReactNode;
}) {
  return children;
}
