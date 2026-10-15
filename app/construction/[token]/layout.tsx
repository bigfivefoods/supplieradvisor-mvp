import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';

type LayoutProps = { children: ReactNode; params: Promise<{ token: string }> };

export async function generateMetadata({ params }: LayoutProps): Promise<Metadata> {
  const { token } = await params;
  return {
    title: 'ConstructionAdvisor®',
    description: 'ConstructionAdvisor® project portal',
    robots: { index: false, follow: false },
    manifest: `/construction/${encodeURIComponent(token)}/manifest.webmanifest`,
    appleWebApp: {
      capable: true,
      title: 'Construction',
      statusBarStyle: 'default',
    },
    icons: {
      icon: [
        { url: '/construction/icon-192.png', sizes: '192x192', type: 'image/png' },
        { url: '/construction/icon-512.png', sizes: '512x512', type: 'image/png' },
      ],
      apple: '/construction/apple-touch-180.png',
    },
    formatDetection: { telephone: false },
  };
}

export const viewport: Viewport = {
  themeColor: '#00b4d8',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function ConstructionPortalLayout({ children }: LayoutProps) {
  return children;
}
