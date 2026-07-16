import type { MetadataRoute } from 'next';

const ORIGIN = 'https://www.supplieradvisor.com';

/**
 * Installable PWA manifest.
 * Absolute icon URLs + simple start_url improve Chrome / Samsung Internet reliability.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'SupplierAdvisor',
    short_name: 'SupplierAdvisor',
    description:
      'Supply-chain operating system — network, POs, inventory, sales, and trust scores.',
    start_url: '/',
    scope: '/',
    id: '/',
    display: 'standalone',
    orientation: 'portrait-primary',
    background_color: '#f8fafc',
    theme_color: '#00b4d8',
    lang: 'en',
    dir: 'ltr',
    categories: ['business', 'productivity'],
    prefer_related_applications: false,
    icons: [
      {
        src: `${ORIGIN}/sa-icon-192.png`,
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: `${ORIGIN}/sa-icon-512.png`,
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: `${ORIGIN}/sa-icon-512.png`,
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
