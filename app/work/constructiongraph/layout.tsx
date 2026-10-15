import type { Metadata, Viewport } from 'next';
import { Providers } from '@/components/Providers';

export const metadata: Metadata = {
  title: 'ConstructionAdvisor®',
  description: 'ConstructionAdvisor® for the whole business: projects, programme, money, variations, diary, and the team.',
  manifest: '/work/constructiongraph/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'Construction', statusBarStyle: 'default' },
  icons: { apple: '/construction/owner-apple-180.png' },
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
