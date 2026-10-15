import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  title: 'RecoverAdvisor®',
  description: 'RecoverAdvisor® for the owner: the collections desk, queue, creditors, mandates, and team.',
  manifest: '/work/recovergraph/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'RecoverAdvisor®', statusBarStyle: 'default' },
  icons: { apple: '/recover/owner-apple-180.png' },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: '#00b4d8',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function WorkRecoverLayout({ children }: { children: React.ReactNode }) {
  return children;
}
