import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  title: {
    default: 'SA Member',
    template: '%s · SA Member',
  },
  description:
    'Your personal member app — hire gear, book gym classes, check in, and review brands.',
  applicationName: 'SA Member',
  appleWebApp: {
    capable: true,
    title: 'SA Member',
    statusBarStyle: 'black-translucent',
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
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export default function MeAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
