import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'RecoverAdvisor®',
  robots: 'noindex, nofollow',
};

export default function RecoverPortalLayout({ children }: { children: React.ReactNode }) {
  return children;
}
