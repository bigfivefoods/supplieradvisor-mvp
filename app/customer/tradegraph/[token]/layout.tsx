import type { Metadata } from 'next';
import { isPublicTradeToken } from '@/lib/trades/tradegraph';

type Props = { params: Promise<{ token: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  const safe = isPublicTradeToken(token) ? encodeURIComponent(token) : 'demo';
  return {
    title: 'Your jobs',
    description: 'Job progress, your statement, and new requests from your tradesperson.',
    manifest: `/customer/tradegraph/${safe}/manifest.webmanifest`,
    themeColor: '#00b4d8',
    appleWebApp: {
      capable: true,
      title: 'TradeAdvisor',
      statusBarStyle: 'default',
    },
    icons: { apple: '/sa-icon-192.png' },
    robots: { index: false, follow: false },
  };
}

export default function CustomerTradeLayout({ children }: { children: React.ReactNode }) {
  return children;
}
