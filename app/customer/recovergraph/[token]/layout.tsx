import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';

type LayoutProps = { children: ReactNode; params: Promise<{ token: string }> };

export async function generateMetadata({ params }: LayoutProps): Promise<Metadata> {
  const { token } = await params;
  const safe = encodeURIComponent(token);
  return {
    title: 'RecoverAdvisor®',
    description: 'RecoverAdvisor® client app',
    robots: { index: false, follow: false },
    manifest: `/customer/recovergraph/${safe}/manifest.webmanifest`,
    appleWebApp: { capable: true, title: 'RecoverAdvisor®', statusBarStyle: 'default' },
    icons: {
      icon: [{ url: '/recover/client-192.png', sizes: '192x192', type: 'image/png' }],
      apple: '/recover/client-apple-180.png',
    },
  };
}

export const viewport: Viewport = {
  themeColor: '#00b4d8',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function CustomerRecoverLayout({ children }: LayoutProps) {
  return children;
}
