import type { Metadata, Viewport } from 'next';
import { B2cInstallPrompt } from '@/components/b2c/B2cInstallPrompt';

export const metadata: Metadata = {
  title: {
    default: 'SA Member',
    template: '%s · SA Member',
  },
  description:
    'SA Member — create your free profile, verify your ID, book Advisor appointments, see shared medical records, get push alerts, shop sale and hire, and check in.',
  applicationName: 'SA Member',
  appleWebApp: {
    capable: true,
    title: 'SA Member',
    statusBarStyle: 'black-translucent',
    startupImage: ['/sa-icon-512.png'],
  },
  other: {
    'mobile-web-app-capable': 'yes',
  },
  icons: {
    apple: [{ url: '/apple-icon.png', sizes: '180x180', type: 'image/png' }],
    icon: [
      { url: '/sa-icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/sa-icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  },
  manifest: '/member-app.webmanifest',
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#0077b6' },
    { media: '(prefers-color-scheme: dark)', color: '#0c4a6e' },
  ],
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: 'cover',
};

export default function MeAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {children}
      <B2cInstallPrompt />
    </>
  );
}
