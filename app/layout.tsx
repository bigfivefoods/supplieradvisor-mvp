import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Providers } from '@/components/Providers';
import JsonLd from '@/components/seo/JsonLd';
import {
  DEFAULT_DESCRIPTION,
  DEFAULT_TITLE,
  SITE_KEYWORDS,
  SITE_NAME,
  SITE_URL,
} from '@/lib/seo/site';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: DEFAULT_TITLE,
    template: `%s · ${SITE_NAME}`,
  },
  description: DEFAULT_DESCRIPTION,
  applicationName: 'SupplierAdvisor',
  generator: 'Next.js',
  keywords: SITE_KEYWORDS,
  authors: [{ name: 'SupplierAdvisor', url: SITE_URL }],
  creator: 'SupplierAdvisor',
  publisher: 'SupplierAdvisor',
  category: 'business',
  classification: 'Supply Chain Management Software',
  referrer: 'origin-when-cross-origin',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/sa-icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/sa-icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/apple-icon.png', sizes: '180x180', type: 'image/png' }],
    shortcut: ['/favicon.ico'],
  },
  manifest: '/manifest.webmanifest',
  openGraph: {
    type: 'website',
    locale: 'en_ZA',
    alternateLocale: ['en_US', 'en_GB', 'en_AU'],
    url: SITE_URL,
    siteName: SITE_NAME,
    title: DEFAULT_TITLE,
    description:
      'The world’s most trusted supplier advice — and OS. Public directory of verified B2B suppliers. 30-day free trial.',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'SupplierAdvisor® — Supply Chain Operating System',
        type: 'image/png',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: DEFAULT_TITLE,
    description:
      'SupplierAdvisor® unites B2B, B2G & B2C on one verified network. Browse the public supplier directory · 30-day free trial.',
    images: ['/og-image.png'],
    creator: '@supplieradvisa',
    site: '@supplieradvisa',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },
  alternates: {
    canonical: SITE_URL,
  },
  verification: {
    // Set NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION in env when GSC is connected
    ...(process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION
      ? {
          google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION,
        }
      : {}),
  },
  other: {
    'msapplication-TileColor': '#00b4d8',
    'apple-mobile-web-app-title': 'SupplierAdvisor',
    'apple-mobile-web-app-capable': 'yes',
    'mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-status-bar-style': 'default',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#00b4d8' },
    { media: '(prefers-color-scheme: dark)', color: '#0f172a' },
  ],
  colorScheme: 'light',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="scroll-smooth">
      <head>
        <JsonLd />
        {/* Explicit PWA / iOS home-screen tags */}
        <link rel="manifest" href="/manifest.webmanifest" />
        <link rel="apple-touch-icon" href="/apple-icon.png" sizes="180x180" />
        <link rel="apple-touch-icon" href="/sa-icon-192.png" sizes="192x192" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="SupplierAdvisor" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="application-name" content="SupplierAdvisor" />
        {/* Register SW as early as possible (Android install criteria) */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
(function(){
  if(!('serviceWorker' in navigator)) return;
  window.addEventListener('load',function(){
    navigator.serviceWorker.register('/sw.js',{scope:'/',updateViaCache:'none'}).catch(function(){});
  });
})();`,
          }}
        />
        {/* Paystack InlineJS v2 — required for Apple Pay + modern checkout */}
        <script src="https://js.paystack.co/v2/inline.js" async />
      </head>
      <body className="min-h-dvh antialiased text-slate-900">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
