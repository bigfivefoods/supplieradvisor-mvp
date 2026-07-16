import type { MetadataRoute } from 'next';

/**
 * Keep manifest simple — Chrome install criteria:
 * name, icons 192+512, start_url, display standalone, HTTPS, SW with fetch handler.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'SupplierAdvisor',
    short_name: 'SupplierAdvisor',
    description: 'Supply-chain operating system for verified B2B trade.',
    start_url: '/',
    scope: '/',
    id: '/',
    display: 'standalone',
    background_color: '#f8fafc',
    theme_color: '#00b4d8',
    lang: 'en',
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
    ],
  };
}
