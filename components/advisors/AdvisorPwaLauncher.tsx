'use client';

import { useEffect, useState } from 'react';
import { Smartphone } from 'lucide-react';
import {
  advisorPwaMemberOpenPath,
  pwaManifestIconUrl,
  recallAdvisorPwaMember,
  type AdvisorPwaBrand,
} from '@/lib/advisors/member-pwa';
import { advisorBrandInk } from '@/lib/advisors/brand-ink';
import { AdvisorPwaInstallPrompt } from '@/components/advisors/AdvisorPwaInstallPrompt';

function applyAppleHead(brand: AdvisorPwaBrand) {
  if (typeof document === 'undefined') return;
  const appleIcon = pwaManifestIconUrl(brand.iconUrl);
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
    links.forEach((l) => l.setAttribute('href', appleIcon));
  } else {
    const l = document.createElement('link');
    l.setAttribute('rel', 'apple-touch-icon');
    l.setAttribute('href', appleIcon);
    document.head.appendChild(l);
  }
}

export function AdvisorPwaLauncher({ brand }: { brand: AdvisorPwaBrand }) {
  const pageInk = advisorBrandInk(brand.backgroundColor);
  const btnInk = advisorBrandInk(brand.themeColor);
  const [memberHref, setMemberHref] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);

  useEffect(() => {
    applyAppleHead(brand);
    if ('serviceWorker' in navigator) {
      void navigator.serviceWorker
        .register('/sw.js', { scope: '/', updateViaCache: 'none' })
        .catch(() => {});
    }
    const mapped = recallAdvisorPwaMember(
      brand.module,
      brand.publicToken,
      true
    );
    if (!mapped) return;
    const href = advisorPwaMemberOpenPath(brand.module, mapped);
    setMemberHref(href);
    setOpening(true);
    const go = window.setTimeout(() => {
      window.location.replace(href);
    }, 400);
    const unlock = window.setTimeout(() => setOpening(false), 2500);
    return () => {
      window.clearTimeout(go);
      window.clearTimeout(unlock);
    };
  }, [brand.module, brand.publicToken, brand.shortName, brand.themeColor, brand.iconUrl]);

  return (
    <div
      className="flex min-h-dvh flex-col items-center justify-center px-5 py-10"
      style={{ background: brand.backgroundColor, color: pageInk }}
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
        <p
          className="mt-5 text-[11px] font-black uppercase tracking-[0.18em] opacity-70"
          style={{ color: pageInk }}
        >
          {brand.advisorLabel}
        </p>
        <h1
          className="mt-1 text-3xl font-black tracking-tight"
          style={{ color: pageInk }}
        >
          {brand.brandName}
        </h1>
        <p className="mt-2 text-sm opacity-80" style={{ color: pageInk }}>
          {brand.description}
        </p>

        {opening && memberHref ? (
          <p className="mt-8 text-sm font-bold opacity-80" style={{ color: pageInk }}>
            Opening your {brand.audienceSingular} app…
          </p>
        ) : (
          <div className="mt-8 flex w-full flex-col gap-2">
            {memberHref ? (
              <a
                href={memberHref}
                className="rounded-2xl px-4 py-3.5 text-sm font-black"
                style={{ background: brand.themeColor, color: btnInk }}
              >
                Open my {brand.shortName} app
              </a>
            ) : null}
            {brand.enabled ? (
              <button
                type="button"
                onClick={() =>
                  window.dispatchEvent(new Event('sa-open-install'))
                }
                className="inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3.5 text-sm font-black"
                style={{ background: brand.themeColor, color: btnInk }}
              >
                <Smartphone className="h-4 w-4" />
                Add {brand.shortName} to Home Screen
              </button>
            ) : null}
            <a
              href={brand.joinPath}
              className="rounded-2xl border px-4 py-3.5 text-sm font-black"
              style={{
                color: pageInk,
                borderColor: pageInk === '#ffffff' ? 'rgba(255,255,255,0.25)' : 'rgba(15,23,42,0.2)',
                background:
                  pageInk === '#ffffff' ? 'rgba(255,255,255,0.1)' : 'rgba(15,23,42,0.06)',
              }}
            >
              Join as a {brand.audienceSingular}
            </a>
            <p className="pt-1 text-[11px] opacity-60" style={{ color: pageInk }}>
              Already a {brand.audienceSingular}? Open the invite or portal
              link once — this app remembers you next time.
            </p>
          </div>
        )}
      </div>
      {brand.enabled ? (
        <AdvisorPwaInstallPrompt brand={brand} mode="sheet" autoOpen={false} />
      ) : null}
    </div>
  );
}
