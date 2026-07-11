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
    shortcuts: [
      {
        name: 'Dashboard',
        short_name: 'Home',
        url: '/dashboard',
        description: 'Command centre',
      },
      {
        name: 'Purchase orders',
        short_name: 'POs',
        url: '/dashboard/suppliers/po',
        description: 'Raise and manage POs',
      },
      {
        name: 'Quality inspections',
        short_name: 'QA',
        url: '/dashboard/quality/inspections',
        description: 'Lot release gates',
      },
      {
        name: 'Bank allocation',
        short_name: 'Bank',
        url: '/dashboard/accounting/bank-reconciliation',
        description: 'Match bank transactions',
      },
    ],
  };
}
