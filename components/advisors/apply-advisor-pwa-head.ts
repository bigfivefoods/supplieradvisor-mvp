'use client';

import {
  advisorPwaBrandStamp,
  advisorPwaIconPath,
  advisorPwaManifestPath,
  advisorPwaSplashPath,
  type AdvisorPwaBrand,
} from '@/lib/advisors/member-pwa';

function removeAll(selector: string) {
  document.querySelectorAll(selector).forEach((el) => el.remove());
}

function addLink(rel: string, href: string, extra?: Record<string, string>) {
  const l = document.createElement('link');
  l.setAttribute('rel', rel);
  l.setAttribute('href', href);
  if (extra) {
    for (const [k, v] of Object.entries(extra)) l.setAttribute(k, v);
  }
  document.head.appendChild(l);
}

function addMeta(name: string, content: string) {
  const el = document.createElement('meta');
  el.setAttribute('name', name);
  el.setAttribute('content', content);
  document.head.appendChild(el);
}

/** Replace root SA PWA tags so Add to Home Screen uses the gym brand. */
export function applyAdvisorPwaDocumentHead(brand: AdvisorPwaBrand): void {
  if (typeof document === 'undefined') return;
  const stamp = advisorPwaBrandStamp(brand);
  const appleIcon = advisorPwaIconPath(brand.module, brand.publicToken, 180, stamp);
  const splash = advisorPwaSplashPath(brand.module, brand.publicToken, stamp);
  const manifestHref = advisorPwaManifestPath(
    brand.module,
    brand.publicToken,
    stamp
  );

  removeAll('link[rel="manifest"]');
  removeAll('link[rel="apple-touch-icon"]');
  removeAll('link[rel="apple-touch-startup-image"]');
  removeAll('meta[name="apple-mobile-web-app-title"]');
  removeAll('meta[name="application-name"]');

  document.title = brand.brandName;
  addMeta('apple-mobile-web-app-title', brand.shortName);
  addMeta('application-name', brand.shortName);
  addMeta('theme-color', brand.themeColor);
  addMeta('msapplication-TileColor', brand.backgroundColor);
  addLink('apple-touch-startup-image', splash);
  addLink('apple-touch-icon', appleIcon, { sizes: '180x180' });
  addLink('manifest', manifestHref);
}
