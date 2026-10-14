import type { Metadata, Viewport } from 'next';
import { Providers } from '@/components/Providers';

export const metadata: Metadata = {
  title: 'TradeAdvisor® work',
  description: 'Owner and technician app for jobs, the diary, and money.',
  manifest: '/work/tradegraph/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'TradeAdvisor', statusBarStyle: 'default' },
  icons: { apple: '/sa-icon-192.png' },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: '#00b4d8',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function WorkLayout({ children }: { children: React.ReactNode }) {
  return <Providers>{children}</Providers>;
}
