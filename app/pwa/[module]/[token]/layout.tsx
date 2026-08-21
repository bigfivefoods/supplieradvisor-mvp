import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { loadAdvisorPwaBrand } from '@/lib/advisors/load-advisor-pwa';
import {
  advisorPwaIconPath,
  advisorPwaManifestPath,
} from '@/lib/advisors/member-pwa';

async function readParams(
  params:
    | { module: string; token: string }
    | Promise<{ module: string; token: string }>
) {
  return await params;
}

export async function generateMetadata({
  params,
}: {
  params:
    | { module: string; token: string }
    | Promise<{ module: string; token: string }>;
}): Promise<Metadata> {
  const { module, token } = await readParams(params);
  const brand = await loadAdvisorPwaBrand(module, token);
  if (!brand) {
    return { title: 'Member app', robots: 'noindex' };
  }
  const appleIcon = advisorPwaIconPath(brand.module, brand.publicToken, 180);
  const appIcon = advisorPwaIconPath(brand.module, brand.publicToken, 192);
  return {
    title: brand.brandName,
    description: brand.description,
    applicationName: brand.shortName,
    robots: 'noindex',
    appleWebApp: {
      capable: true,
      title: brand.shortName,
      statusBarStyle: 'black-translucent',
      startupImage: [appleIcon],
    },
    icons: {
      apple: [{ url: appleIcon, sizes: '180x180', type: 'image/png' }],
      icon: [{ url: appIcon, sizes: '192x192', type: 'image/png' }],
    },
    manifest: advisorPwaManifestPath(brand.module, brand.publicToken),
    other: {
      'mobile-web-app-capable': 'yes',
      'apple-mobile-web-app-title': brand.shortName,
    },
  };
}

export async function generateViewport({
  params,
}: {
  params:
    | { module: string; token: string }
    | Promise<{ module: string; token: string }>;
}): Promise<Viewport> {
  const { module, token } = await readParams(params);
  const brand = await loadAdvisorPwaBrand(module, token);
  return {
    themeColor: brand?.themeColor || '#0c4a6e',
    width: 'device-width',
    initialScale: 1,
    viewportFit: 'cover',
  };
}

export default function AdvisorPwaLayout({ children }: { children: ReactNode }) {
  return children;
}
