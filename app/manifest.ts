import type { MetadataRoute } from 'next';

/**
 * Keep manifest simple — Chrome install criteria:
 * name, icons 192+512, start_url, display standalone, HTTPS, SW with fetch handler.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'SupplierAdvisor',
    short_name: 'SupplierAdvisor',
    description:
      'Verified B2B OS plus SA Member for hire, gym check-in and personal bookings.',
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
    shortcuts: [
      {
        name: 'SA Member',
        short_name: 'Member',
        description: 'Hire, gym, check-in — personal app',
        url: '/me',
        icons: [{ src: '/sa-icon-192.png', sizes: '192x192' }],
      },
      {
        name: 'Member check-in',
        short_name: 'Check-in',
        url: '/me?tab=checkin',
        icons: [{ src: '/sa-icon-192.png', sizes: '192x192' }],
      },
    ],
  };
}
