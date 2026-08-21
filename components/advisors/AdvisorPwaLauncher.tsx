'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import { Dumbbell, Smartphone, UserRound } from 'lucide-react';
import {
  advisorPwaIconPath,
  advisorPwaMemberOpenPath,
  recallAdvisorPwaMember,
  rememberAdvisorPwaMember,
  type AdvisorPwaBrand,
} from '@/lib/advisors/member-pwa';
import { advisorBrandInk } from '@/lib/advisors/brand-ink';
import { AdvisorPwaInstallPrompt } from '@/components/advisors/AdvisorPwaInstallPrompt';

function applyAppleHead(brand: AdvisorPwaBrand) {
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

function ghostBtn(pageInk: string): CSSProperties {
  const light = pageInk === '#ffffff';
  return {
    color: pageInk,
    borderColor: light ? 'rgba(255,255,255,0.25)' : 'rgba(15,23,42,0.2)',
    background: light ? 'rgba(255,255,255,0.1)' : 'rgba(15,23,42,0.06)',
  };
}

export function AdvisorPwaLauncher({ brand }: { brand: AdvisorPwaBrand }) {
  const pageInk = advisorBrandInk(brand.backgroundColor);
  const btnInk = advisorBrandInk(brand.themeColor);
  const [memberHref, setMemberHref] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);
  const [signIn, setSignIn] = useState(false);
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const gym = brand.module === 'fitgraph';

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

  const submitSignIn = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/public/advisor-pwa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'sign_in',
          module: brand.module,
          token: brand.publicToken,
          phone: phone.trim() || undefined,
          email: email.trim() || undefined,
          code: code.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Sign-in failed');
      const path = String(data.path || '');
      const portal = String(data.portal_token || '');
      if (!path || !portal) throw new Error('Sign-in failed');
      rememberAdvisorPwaMember({
        module: brand.module,
        memberToken: portal,
        publicToken: brand.publicToken,
      });
      window.location.assign(path);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Sign-in failed');
      setBusy(false);
    }
  };

  const fillBtn: CSSProperties = {
    background: brand.themeColor,
    color: btnInk,
  };

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
                style={fillBtn}
              >
                Open my {brand.shortName} app
              </a>
            ) : null}

            {gym ? (
              <>
                {!signIn ? (
                  <button
                    type="button"
                    onClick={() => setSignIn(true)}
                    className="rounded-2xl px-4 py-3.5 text-sm font-black"
                    style={fillBtn}
                  >
                    Sign in — I am a member
                  </button>
                ) : (
                  <form
                    className="space-y-2 rounded-2xl border p-3 text-left"
                    style={ghostBtn(pageInk)}
                    onSubmit={(e) => {
                      e.preventDefault();
                      void submitSignIn();
                    }}
                  >
                    <p className="text-xs font-black" style={{ color: pageInk }}>
                      Sign in with details on your gym profile
                    </p>
                    <input
                      className="w-full rounded-xl border border-black/10 bg-white px-3 py-2.5 text-sm text-slate-900"
                      placeholder="Phone"
                      inputMode="tel"
                      autoComplete="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                    />
                    <input
                      className="w-full rounded-xl border border-black/10 bg-white px-3 py-2.5 text-sm text-slate-900"
                      placeholder="Email"
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                    <input
                      className="w-full rounded-xl border border-black/10 bg-white px-3 py-2.5 text-sm text-slate-900"
                      placeholder="Member code"
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                    />
                    {error ? (
                      <p className="text-xs font-bold text-rose-700">{error}</p>
                    ) : (
                      <p className="text-[11px] opacity-70" style={{ color: pageInk }}>
                        Any one of these is enough.
                      </p>
                    )}
                    <button
                      type="submit"
                      disabled={busy || (!phone.trim() && !email.trim() && !code.trim())}
                      className="w-full rounded-xl py-3 text-sm font-black disabled:opacity-50"
                      style={fillBtn}
                    >
                      {busy ? 'Signing in…' : 'Continue'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSignIn(false);
                        setError(null);
                      }}
                      className="w-full py-1 text-xs font-bold opacity-70"
                      style={{ color: pageInk }}
                    >
                      Back
                    </button>
                  </form>
                )}

                <p
                  className="pt-2 text-left text-[10px] font-black uppercase tracking-wider opacity-60"
                  style={{ color: pageInk }}
                >
                  New here
                </p>
                <a
                  href={brand.joinGymPath || brand.joinPath}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border px-4 py-3.5 text-sm font-black"
                  style={ghostBtn(pageInk)}
                >
                  <Dumbbell className="h-4 w-4" />
                  Join gym membership
                </a>
                {brand.joinPrivatePath ? (
                  <a
                    href={brand.joinPrivatePath}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl border px-4 py-3.5 text-sm font-black"
                    style={ghostBtn(pageInk)}
                  >
                    <UserRound className="h-4 w-4" />
                    Join private coaching
                  </a>
                ) : null}
              </>
            ) : (
              <a
                href={brand.joinPath}
                className="rounded-2xl border px-4 py-3.5 text-sm font-black"
                style={ghostBtn(pageInk)}
              >
                Join as a {brand.audienceSingular}
              </a>
            )}

            {brand.enabled ? (
              <button
                type="button"
                onClick={() =>
                  window.dispatchEvent(new Event('sa-open-install'))
                }
                className="inline-flex items-center justify-center gap-2 rounded-2xl border px-4 py-3.5 text-sm font-black"
                style={ghostBtn(pageInk)}
              >
                <Smartphone className="h-4 w-4" />
                Add {brand.shortName} to Home Screen
              </button>
            ) : null}
          </div>
        )}
      </div>
      {brand.enabled ? (
        <AdvisorPwaInstallPrompt brand={brand} mode="sheet" autoOpen={false} />
      ) : null}
    </div>
  );
}
