import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'SRM walkthrough',
  robots: { index: false, follow: false, nocache: true },
};

export default function SrmPreviewLayout({ children }: { children: React.ReactNode }) {
  return children;
}
