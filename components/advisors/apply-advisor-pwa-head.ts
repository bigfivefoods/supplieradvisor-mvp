'use client';

import {
  advisorPwaIconPath,
  advisorPwaManifestPath,
  type AdvisorPwaBrand,
} from '@/lib/advisors/member-pwa';

/** Swap SA root PWA tags for the company install (name, icons, manifest). */
export function applyAdvisorPwaDocumentHead(brand: AdvisorPwaBrand): void {
  if (typeof document === 'undefined') return;
  const appleIcon = advisorPwaIconPath(brand.module, brand.publicToken, 180);
  const setMeta = (name: string, content: string) => {
    let el = document.querySelector(`meta[name="${name}"]`);
    if (!el) {
      el = document.createElement('meta');
      el.setAttribute('name', name);
      document.head.appendChild(el);
    }
    el.setAttribute('content', content);
  };
  setMeta('apple-mobile-web-app-title', brand.shortName);
  setMeta('application-name', brand.shortName);
  setMeta('theme-color', brand.themeColor);

  const appleLinks = document.querySelectorAll('link[rel="apple-touch-icon"]');
  if (appleLinks.length) {
    appleLinks.forEach((l) => l.setAttribute('href', appleIcon));
  } else {
    const l = document.createElement('link');
    l.setAttribute('rel', 'apple-touch-icon');
    l.setAttribute('href', appleIcon);
    document.head.appendChild(l);
  }

  const manifestHref = advisorPwaManifestPath(brand.module, brand.publicToken);
  const manifests = document.querySelectorAll('link[rel="manifest"]');
  if (manifests.length) {
    manifests.forEach((l) => l.setAttribute('href', manifestHref));
  } else {
    const l = document.createElement('link');
    l.setAttribute('rel', 'manifest');
    l.setAttribute('href', manifestHref);
    document.head.appendChild(l);
  }
}
