import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: { absolute: 'RecoverAdvisor®' },
  description: null,
  keywords: null,
  manifest: null,
  applicationName: 'RecoverAdvisor®',
  authors: null,
  creator: null,
  publisher: null,
  category: null,
  classification: null,
  openGraph: null,
  twitter: null,
  alternates: null,
  robots: 'noindex, nofollow',
};

export default function RecoverPortalLayout({ children }: { children: React.ReactNode }) {
  return children;
}
