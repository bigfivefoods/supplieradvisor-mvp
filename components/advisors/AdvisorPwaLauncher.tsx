'use client';

import { useEffect, useState } from 'react';
import { Smartphone } from 'lucide-react';
import {
  advisorPwaMemberOpenPath,
  recallAdvisorPwaMember,
  type AdvisorPwaBrand,
} from '@/lib/advisors/member-pwa';
import { advisorBrandInk } from '@/lib/advisors/brand-ink';
import { AdvisorPwaInstallPrompt } from '@/components/advisors/AdvisorPwaInstallPrompt';

function applyAppleHead(brand: AdvisorPwaBrand) {
  if (typeof document === 'undefined') return;
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
  const links = document.querySelectorAll('link[rel="apple-touch-icon"]');
  if (links.length) {
    links.forEach((l) => l.setAttribute('href', brand.iconUrl));
  } else {
    const l = document.createElement('link');
    l.setAttribute('rel', 'apple-touch-icon');
    l.setAttribute('href', brand.iconUrl);
    document.head.appendChild(l);
  }
}

export function AdvisorPwaLauncher({ brand }: { brand: AdvisorPwaBrand }) {
  const ink = advisorBrandInk(brand.themeColor);
  const [opening, setOpening] = useState(true);

  useEffect(() => {
    applyAppleHead(brand);
    if ('serviceWorker' in navigator) {
      void navigator.serviceWorker
        .register('/sw.js', { scope: '/', updateViaCache: 'none' })
        .catch(() => {});
    }
    const member = recallAdvisorPwaMember(brand.module, brand.publicToken);
    if (member) {
      const href = advisorPwaMemberOpenPath(brand.module, member);
      const t = window.setTimeout(() => {
        window.location.replace(href);
      }, 220);
      return () => window.clearTimeout(t);
    }
    setOpening(false);
  }, [brand]);

  return (
    <div
      className="flex min-h-dvh flex-col items-center justify-center px-5 py-10"
      style={{ background: brand.backgroundColor, color: ink }}
    >
      <div className="flex w-full max-w-sm flex-col items-center text-center">
        <span
          className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-[1.75rem] shadow-2xl"
          style={{ background: brand.themeColor }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={brand.iconUrl}
            alt=""
            className="h-full w-full object-contain p-2"
          />
        </span>
        <p className="mt-5 text-[11px] font-black uppercase tracking-[0.18em] opacity-70">
          {brand.advisorLabel}
        </p>
        <h1 className="mt-1 text-3xl font-black tracking-tight text-white">
          {brand.brandName}
        </h1>
        <p className="mt-2 text-sm text-white/80">{brand.description}</p>

        {opening ? (
          <p className="mt-8 text-sm font-bold text-white/80">
            Opening your {brand.audienceSingular} app…
          </p>
        ) : (
          <div className="mt-8 flex w-full flex-col gap-2">
            {brand.enabled ? (
              <button
                type="button"
                onClick={() =>
                  window.dispatchEvent(new Event('sa-open-install'))
                }
                className="inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3.5 text-sm font-black"
                style={{ background: brand.themeColor, color: ink }}
              >
                <Smartphone className="h-4 w-4" />
                Add {brand.shortName} to Home Screen
              </button>
            ) : null}
            <a
              href={brand.joinPath}
              className="rounded-2xl border border-white/25 bg-white/10 px-4 py-3.5 text-sm font-black text-white"
            >
              Join as a {brand.audienceSingular}
            </a>
            <p className="pt-1 text-[11px] text-white/60">
              Already a {brand.audienceSingular}? Open the invite or portal
              link once — this app remembers you next time.
            </p>
          </div>
        )}
      </div>
      {brand.enabled ? <AdvisorPwaInstallPrompt brand={brand} mode="sheet" /> : null}
    </div>
  );
}
