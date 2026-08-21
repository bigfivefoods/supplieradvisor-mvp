'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { usePrivy } from '@privy-io/react-auth';
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
import { applyAdvisorPwaDocumentHead } from '@/components/advisors/apply-advisor-pwa-head';
import { AuthLoginActions } from '@/components/auth/AuthLoginActions';
import {
  extractEmailFromPrivyUser,
  getCanonicalUserId,
} from '@/lib/auth/identity';
import { peekOauthReturnParams } from '@/lib/auth/oauth-return';

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
  const { authenticated, ready, user } = usePrivy();
  const [memberHref, setMemberHref] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);
  const [step, setStep] = useState<'home' | 'join' | 'signIn'>('home');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [samsung, setSamsung] = useState(false);
  const joining = useRef(false);
  const gym = brand.module === 'fitgraph';
  const rosterSignIn =
    brand.module !== 'hiregraph' && brand.module !== 'retailgraph';

  useEffect(() => {
    setSamsung(/SamsungBrowser/i.test(navigator.userAgent));
    applyAdvisorPwaDocumentHead(brand);
    if ('serviceWorker' in navigator) {
      void navigator.serviceWorker
        .register('/sw.js', { scope: '/', updateViaCache: 'none' })
        .catch(() => {});
    }
    const q = new URLSearchParams(window.location.search);
    const stashed = peekOauthReturnParams();
    if (q.get('join') === '1' || stashed.join === '1') {
      setStep('join');
    }
    const mapped = recallAdvisorPwaMember(
      brand.module,
      brand.publicToken,
      true
    );
    if (!mapped) return;
    const href = advisorPwaMemberOpenPath(brand.module, mapped);
    setMemberHref(href);
    if (q.get('join') === '1' || stashed.join === '1') return;
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

  const openMemberApp = (path: string, portal: string) => {
    rememberAdvisorPwaMember({
      module: brand.module,
      memberToken: portal,
      publicToken: brand.publicToken,
    });
    window.location.assign(path);
  };

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
          name: name.trim(),
          email: email.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Sign-in failed');
      const path = String(data.path || '');
      const portal = String(data.portal_token || '');
      if (!path || !portal) throw new Error('Sign-in failed');
      openMemberApp(path, portal);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Sign-in failed');
      setBusy(false);
    }
  };

  const completeJoin = async () => {
    if (joining.current) return;
    if (!brand.companyId || brand.companyId <= 0) {
      setError('This app is not published yet.');
      return;
    }
    joining.current = true;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/b2c/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company: brand.companyId,
          kind: brand.joinKind,
          email: extractEmailFromPrivyUser(user),
          full_name: name.trim() || undefined,
          privyUserId: getCanonicalUserId(user?.id),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not join');
      const portal = String(data.membership?.portal_token || '').trim();
      const path = String(
        data.membership?.portal_path ||
          (portal ? advisorPwaMemberOpenPath(brand.module, portal) : '')
      );
      if (!path || !portal) {
        throw new Error('Joined, but this app could not open. Try Sign in.');
      }
      openMemberApp(path, portal);
    } catch (e: unknown) {
      joining.current = false;
      setError(e instanceof Error ? e.message : 'Could not join');
      setBusy(false);
    }
  };

  useEffect(() => {
    if (step !== 'join' || !ready || !authenticated || !user?.id || busy) return;
    void completeJoin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, ready, authenticated, user?.id]);

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
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={advisorPwaIconPath(brand.module, brand.publicToken, 192)}
          alt={brand.brandName}
          width={112}
          height={112}
          className="h-28 w-28 object-contain"
          style={{ background: 'transparent' }}
        />
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

            {step === 'join' ? (
              <div
                className="space-y-3 rounded-2xl border p-3 text-left"
                style={ghostBtn(pageInk)}
              >
                <p className="text-xs font-black" style={{ color: pageInk }}>
                  Create your {brand.brandName} account
                </p>
                <p className="text-[11px] opacity-80" style={{ color: pageInk }}>
                  Sign in, then you join this app — profile, bookings and the rest
                  live here, not on a separate website.
                </p>
                {authenticated ? (
                  <p className="text-sm font-bold" style={{ color: pageInk }}>
                    {busy ? `Joining ${brand.shortName}…` : 'Signed in — joining this app'}
                  </p>
                ) : (
                  <AuthLoginActions
                    variant={pageInk === '#ffffff' ? 'onBrand' : 'default'}
                    appName={brand.brandName}
                  />
                )}
                {error ? (
                  <p className="text-xs font-bold text-rose-200">{error}</p>
                ) : null}
                <button
                  type="button"
                  onClick={() => {
                    setStep('home');
                    setError(null);
                  }}
                  className="w-full py-1 text-xs font-bold opacity-70"
                  style={{ color: pageInk }}
                >
                  Back
                </button>
              </div>
            ) : step === 'signIn' && rosterSignIn ? (
              <form
                className="space-y-2 rounded-2xl border p-3 text-left"
                style={ghostBtn(pageInk)}
                onSubmit={(e) => {
                  e.preventDefault();
                  void submitSignIn();
                }}
              >
                <p className="text-xs font-black" style={{ color: pageInk }}>
                  Sign in with the name and email on your {brand.audienceSingular}{' '}
                  file
                </p>
                <input
                  className="w-full rounded-xl border border-black/10 bg-white px-3 py-2.5 text-sm text-slate-900"
                  placeholder="Full name"
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
                <input
                  className="w-full rounded-xl border border-black/10 bg-white px-3 py-2.5 text-sm text-slate-900"
                  placeholder="Email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                {error ? (
                  <p className="text-xs font-bold text-rose-700">{error}</p>
                ) : (
                  <p className="text-[11px] opacity-70" style={{ color: pageInk }}>
                    Already on the {gym ? 'gym' : 'practice'} list? Use those
                    details. New here — create an account instead.
                  </p>
                )}
                <button
                  type="submit"
                  disabled={busy || !name.trim() || !email.trim()}
                  className="w-full rounded-xl py-3 text-sm font-black disabled:opacity-50"
                  style={fillBtn}
                >
                  {busy ? 'Signing in…' : 'Continue'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setStep('home');
                    setError(null);
                  }}
                  className="w-full py-1 text-xs font-bold opacity-70"
                  style={{ color: pageInk }}
                >
                  Back
                </button>
              </form>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setStep('join');
                  }}
                  className="rounded-2xl px-4 py-3.5 text-sm font-black"
                  style={fillBtn}
                >
                  Create account — join as a {brand.audienceSingular}
                </button>
                {rosterSignIn ? (
                  <button
                    type="button"
                    onClick={() => {
                      setError(null);
                      setStep('signIn');
                    }}
                    className="rounded-2xl border px-4 py-3.5 text-sm font-black"
                    style={ghostBtn(pageInk)}
                  >
                    Sign in — I am a {brand.audienceSingular}
                  </button>
                ) : null}
                {gym && brand.joinGymPath ? (
                  <>
                    <p
                      className="pt-2 text-left text-[10px] font-black uppercase tracking-wider opacity-60"
                      style={{ color: pageInk }}
                    >
                      Membership application
                    </p>
                    <a
                      href={brand.joinGymPath}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl border px-4 py-3.5 text-sm font-black"
                      style={ghostBtn(pageInk)}
                    >
                      <Dumbbell className="h-4 w-4" />
                      Apply for gym membership
                    </a>
                    {brand.joinPrivatePath ? (
                      <a
                        href={brand.joinPrivatePath}
                        className="inline-flex items-center justify-center gap-2 rounded-2xl border px-4 py-3.5 text-sm font-black"
                        style={ghostBtn(pageInk)}
                      >
                        <UserRound className="h-4 w-4" />
                        Apply for private coaching
                      </a>
                    ) : null}
                  </>
                ) : null}
              </>
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
            {samsung ? (
              <p className="pt-1 text-[11px] font-bold opacity-80" style={{ color: pageInk }}>
                Galaxy: install from Chrome, not Samsung Internet — otherwise Android
                may warn that the app is built for an older version.
              </p>
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
