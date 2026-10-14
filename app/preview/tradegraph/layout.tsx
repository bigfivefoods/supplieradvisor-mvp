import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'TradeAdvisor sample',
  robots: { index: false, follow: false },
};

export default function PreviewTradeLayout({ children }: { children: React.ReactNode }) {
  return children;
}
