import type { Metadata, Viewport } from 'next';

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
  icons: {
    icon: [],
    shortcut: [],
    apple: [],
    other: [],
  },
  // `false` clears web-app metas. An object with capable: false still emits a status-bar style.
  appleWebApp: false,
};

export const viewport: Viewport = {
  themeColor: '#f8fafc',
  colorScheme: 'light',
};

export default function RecoverPortalLayout({ children }: { children: React.ReactNode }) {
  return children;
}
