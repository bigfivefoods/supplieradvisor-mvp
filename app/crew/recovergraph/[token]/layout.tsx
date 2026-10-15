import type { Metadata, Viewport } from 'next';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';

type LayoutProps = { children: ReactNode; params: Promise<{ token: string }> };

export async function generateMetadata({ params }: LayoutProps): Promise<Metadata> {
  const { token } = await params;
  const safe = encodeURIComponent(token);
  return {
    title: 'RecoverAdvisor®',
    description: 'RecoverAdvisor® workers app',
    robots: { index: false, follow: false },
    manifest: `/crew/recovergraph/${safe}/manifest.webmanifest`,
    appleWebApp: { capable: true, title: 'RecoverAdvisor®', statusBarStyle: 'default' },
    icons: {
      icon: [{ url: '/recover/workers-192.png', sizes: '192x192', type: 'image/png' }],
      apple: '/recover/workers-apple-180.png',
    },
  };
}

export const viewport: Viewport = {
  themeColor: '#00b4d8',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default async function CrewRecoverLayout({ children, params }: LayoutProps) {
  const { token } = await params;
  if (!token || token.length < 8 || token.includes('/') || token.includes('..')) notFound();
  return children;
}
