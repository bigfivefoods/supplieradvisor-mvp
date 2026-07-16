import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'SupplierAdvisor® — Supply Chain Operating System',
    short_name: 'SupplierAdvisor',
    description:
      'Verified supply-chain OS for B2B, B2G & B2C — network trade, inventory, manufacturing, distribution, accounting, quality, and intelligence.',
    start_url: '/dashboard',
    scope: '/',
    display: 'standalone',
    orientation: 'any',
    background_color: '#f8fafc',
    theme_color: '#00b4d8',
    lang: 'en',
    categories: ['business', 'productivity', 'finance'],
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
    id: '/',
    display_override: ['standalone', 'browser'],
    prefer_related_applications: false,
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
      {
        name: 'Company directory',
        short_name: 'Directory',
        url: '/#directory',
        description: 'Search companies on the network',
      },
    ],
  };
}
