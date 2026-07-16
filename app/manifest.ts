import type { MetadataRoute } from 'next';

/**
 * Web App Manifest — criteria for installable PWA (Chrome / Edge / Safari).
 * Keep icons as real PNG 192 + 512, display standalone, SW registered at /sw.js.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'SupplierAdvisor',
    short_name: 'SupplierAdvisor',
    description:
      'Verified supply-chain OS for B2B, B2G & B2C — network trade, inventory, manufacturing, distribution, accounting, quality, and intelligence.',
    // Root start keeps install working from marketing + auth pages
    start_url: '/?source=pwa',
    scope: '/',
    id: '/?source=pwa',
    display: 'standalone',
    orientation: 'any',
    background_color: '#f8fafc',
    theme_color: '#00b4d8',
    lang: 'en',
    dir: 'ltr',
    categories: ['business', 'productivity', 'finance'],
    prefer_related_applications: false,
    icons: [
      {
        src: '/sa-icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/sa-icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/sa-icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/apple-icon.png',
        sizes: '180x180',
        type: 'image/png',
        purpose: 'any',
      },
    ],
    shortcuts: [
      {
        name: 'Dashboard',
        short_name: 'Home',
        url: '/dashboard',
        description: 'Command centre',
      },
      {
        name: 'Sales pipeline',
        short_name: 'Pipeline',
        url: '/sales/pipeline',
        description: 'Deals and team forecast',
      },
      {
        name: 'Purchase orders',
        short_name: 'POs',
        url: '/dashboard/suppliers/po',
        description: 'Raise and manage POs',
      },
    ],
  };
}
