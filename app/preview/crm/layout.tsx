import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'CRM walkthrough',
  robots: { index: false, follow: false, nocache: true },
};

export default function CrmPreviewLayout({ children }: { children: React.ReactNode }) {
  return children;
}
