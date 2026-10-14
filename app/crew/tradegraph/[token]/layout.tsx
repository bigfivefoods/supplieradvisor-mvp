import type { Metadata, Viewport } from 'next';

type Props = { params: Promise<{ token: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  const safe = encodeURIComponent(token);
  return {
    title: 'Work app',
    description: 'Today’s jobs, the diary, and the site clock.',
    manifest: `/crew/tradegraph/${safe}/manifest.webmanifest`,
    appleWebApp: { capable: true, title: 'TradeAdvisor', statusBarStyle: 'default' },
    icons: { apple: '/sa-icon-192.png' },
    robots: { index: false, follow: false },
  };
}

export const viewport: Viewport = {
  themeColor: '#0077b6',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function CrewLayout({ children }: { children: React.ReactNode }) {
  return children;
}
