import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Providers } from '@/components/Providers';
import JsonLd from '@/components/seo/JsonLd';

const SITE_URL = 'https://www.supplieradvisor.com';
const SITE_NAME = 'SupplierAdvisor®';
const DEFAULT_TITLE = 'SupplierAdvisor® — The world’s most trusted supply-chain OS';
const DEFAULT_DESCRIPTION =
  'B2B, B2G & B2C on one verified network. SupplierAdvisor® is the supply-chain operating system for trusted trade — SRM, CRM, inventory, manufacturing, distribution, SHEQ, quality, finance, containers, and on-chain pedigree. From R299/mo.';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: DEFAULT_TITLE,
    template: `%s · ${SITE_NAME}`,
  },
  description: DEFAULT_DESCRIPTION,
  applicationName: 'SupplierAdvisor',
  generator: 'Next.js',
  keywords: [
    'SupplierAdvisor',
    'supply chain software',
    'supply chain operating system',
    'B2B marketplace',
    'B2G procurement',
    'supplier relationship management',
    'SRM',
    'CRM',
    'inventory management',
    'warehouse management',
    'manufacturing ERP',
    'MPS MRP BOM',
    'distribution software',
    'operations control tower',
    'trade network',
    'verified suppliers',
    'multi-currency accounting',
    'bank reconciliation',
    'South Africa supply chain',
    'on-chain escrow',
    'Super-Cube leadership',
  ],
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
    alternateLocale: ['en_US', 'en_GB'],
    url: SITE_URL,
    siteName: SITE_NAME,
    title: DEFAULT_TITLE,
    description:
      'Verified trade, inventory, manufacturing, distribution, banking, and intelligence in one company workspace.',
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
      'Verified B2B · B2G · B2C supply-chain OS — network, inventory, manufacturing, distribution & AI.',
    images: ['/og-image.png'],
    creator: '@supplieradvisa',
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
  other: {
    'msapplication-TileColor': '#00b4d8',
    'apple-mobile-web-app-title': 'SupplierAdvisor',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f8fafc' },
    { media: '(prefers-color-scheme: dark)', color: '#0f172a' },
  ],
  colorScheme: 'light',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="scroll-smooth">
      <head>
        <JsonLd />
        {/* Paystack Inline Script */}
        <script src="https://js.paystack.co/v1/inline.js" async />
      </head>
      <body className="min-h-dvh antialiased text-slate-900">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
