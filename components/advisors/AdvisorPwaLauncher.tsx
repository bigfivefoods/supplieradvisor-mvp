'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { Dumbbell, Smartphone, Stethoscope, UserRound } from 'lucide-react';
import {
  advisorPwaIconPath,
  advisorPwaOpenPath,
  isAdvisorStaffPortalPath,
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
import { clinicPwaCopy, isClinicPwaModule } from '@/lib/clinic/clinic-pwa-copy';

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
  const [signedOut, setSignedOut] = useState(false);
  const [step, setStep] = useState<'home' | 'join' | 'signIn'>('home');
  const [signInAs, setSignInAs] = useState<'member' | 'staff'>('member');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [samsung, setSamsung] = useState(false);
  const [wallet, setWallet] = useState<{
    name: string;
    email: string;
    phone: string;
    membershipPath: string | null;
  } | null>(null);
  const joining = useRef(false);
  const gym = brand.module === 'fitgraph';
  const hire = brand.module === 'hiregraph';
  const clinic = isClinicPwaModule(brand.module);
  const clinicCopy = clinic ? clinicPwaCopy(brand.module) : null;
  const rosterSignIn = brand.module !== 'retailgraph';
  const staffDesk = gym || clinic;
  const staffLabel = gym
    ? 'Coach'
    : clinicCopy
      ? clinicCopy.staffSingular.replace(/^./, (c) => c.toUpperCase())
      : 'Staff';
  const staffListLabel = gym
    ? 'Coaches'
    : clinicCopy
      ? clinicCopy.staffPlural
      : 'Staff';
  const memberAppLabel = clinicCopy?.memberAppLabel || 'member / client app';
  const openingLabel = clinicCopy?.openingApp || `Opening your ${memberAppLabel}…`;

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
    const wantJoin = q.get('join') === '1' || stashed.join === '1';
    const stayHome =
      q.get('switch') === '1' || q.get('signed_out') === '1';
    if (stayHome) setSignedOut(true);
    const mapped = recallAdvisorPwaMember(
      brand.module,
      brand.publicToken,
      true
    );
    if (!mapped) {
      if (wantJoin && brand.module !== 'hiregraph') setStep('join');
      return;
    }
    const href = advisorPwaOpenPath(brand.module, mapped);
    setMemberHref(href);
    if (stayHome) return;
    if (wantJoin && brand.module !== 'hiregraph') return;
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

  useEffect(() => {
    if (!ready || !authenticated) return;
    let cancelled = false;
    void fetch('/api/b2c/me?include=lite', { cache: 'no-store' })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled || !data?.profile) return;
        const p = data.profile as {
          full_name?: string | null;
          email?: string | null;
          phone?: string | null;
          memberships?: Array<{
            kind?: string;
            company_id?: number;
            portal_path?: string | null;
            portal_token?: string | null;
            active?: boolean;
          }>;
        };
        const walletName = String(p.full_name || '').trim();
        const walletEmail =
          String(p.email || extractEmailFromPrivyUser(user) || '').trim();
        const walletPhone = String(p.phone || '').trim();
        if (walletName && !name) setName(walletName);
        if (walletEmail && !email) setEmail(walletEmail);
        const linked = (p.memberships || []).find(
          (m) =>
            m.active !== false &&
            Number(m.company_id) === brand.companyId &&
            String(m.kind || '') === brand.joinKind &&
            (m.portal_path || m.portal_token)
        );
        const membershipPath = linked
          ? String(
              linked.portal_path ||
                advisorPwaOpenPath(
                  brand.module,
                  String(linked.portal_token || '')
                )
            )
          : null;
        setWallet({
          name: walletName,
          email: walletEmail,
          phone: walletPhone,
          membershipPath,
        });
        if (membershipPath) setMemberHref(membershipPath);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, authenticated, brand.companyId, brand.joinKind, brand.module]);

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
          expect_role: signInAs === 'staff' ? 'staff' : 'member',
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
      const joinEmail =
        wallet?.email || extractEmailFromPrivyUser(user) || email.trim();
      const joinName = wallet?.name || name.trim();
      if (staffDesk && joinEmail && joinName) {
        const roster = await fetch('/api/public/advisor-pwa', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'sign_in',
            module: brand.module,
            token: brand.publicToken,
            name: joinName,
            email: joinEmail,
            expect_role: signInAs === 'staff' ? 'staff' : undefined,
          }),
        });
        const rosterData = await roster.json().catch(() => ({}));
        const path = String(rosterData.path || '');
        const portal = String(rosterData.portal_token || '');
        if (roster.ok && path && portal) {
          openMemberApp(path, portal);
          return;
        }
        if (signInAs === 'staff') {
          throw new Error(
            rosterData.error ||
              `We could not find that ${staffLabel.toLowerCase()}. Use the name and email on ${staffListLabel}.`
          );
        }
      }
      const res = await fetch('/api/b2c/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company: brand.companyId,
          kind: brand.joinKind,
          email:
            wallet?.email || extractEmailFromPrivyUser(user) || email.trim(),
          full_name: wallet?.name || name.trim() || undefined,
          phone: wallet?.phone || undefined,
          privyUserId: getCanonicalUserId(user?.id),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not join');
      const portal = String(data.membership?.portal_token || '').trim();
      const path = String(
        data.membership?.portal_path ||
          (portal ? advisorPwaOpenPath(brand.module, portal) : '')
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
            {isAdvisorStaffPortalPath(memberHref)
              ? 'Opening your work app…'
              : openingLabel}
          </p>
        ) : (
          <>
        {signedOut ? (
          <p
            className="mt-6 w-full rounded-2xl border px-3 py-2 text-left text-xs font-semibold opacity-90"
            style={ghostBtn(pageInk)}
          >
            {clinicCopy
              ? clinicCopy.signedOutHint
              : `Signed out. Sign in as a member, or as a ${staffLabel.toLowerCase()}.`}
          </p>
        ) : null}
          <div className="mt-8 flex w-full flex-col gap-2">
            {memberHref && !signedOut ? (
              <a
                href={memberHref}
                className="rounded-2xl px-4 py-3.5 text-sm font-black"
                style={fillBtn}
              >
                Open my{' '}
                {isAdvisorStaffPortalPath(memberHref)
                  ? 'work app'
                  : memberAppLabel}
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
                  {hire
                    ? 'New here? Create an account to search, hire kit and track when it is coming. Already a customer? Sign in with the name and email on your file.'
                    : clinicCopy
                      ? clinicCopy.joinHint
                    : 'Sign in, then you join this app — profile, bookings and the rest live here, not on a separate website.'}
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
                {rosterSignIn ? (
                  <button
                    type="button"
                    onClick={() => {
                      setStep('signIn');
                      setError(null);
                    }}
                    className="w-full py-1 text-xs font-bold opacity-80"
                    style={{ color: pageInk }}
                  >
                    Already an SA Member? Sign in
                  </button>
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
                  {signInAs === 'staff'
                    ? `I work here — name and email on ${staffListLabel} (employed or contractor)`
                    : clinicCopy?.signInMember ||
                      'Member / client — name and email on your file'}
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
                    {signInAs === 'staff'
                      ? 'This opens the work app — diary, roster, attendance. Same view if you are employed or a contractor.'
                      : `This opens the ${memberAppLabel}.`}
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
                    setStep('join');
                    setError(null);
                  }}
                  className="w-full py-1 text-xs font-bold opacity-80"
                  style={{ color: pageInk }}
                >
                  New here? Create an account
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
                {staffDesk ? (
                  <p
                    className="text-left text-[10px] font-black uppercase tracking-wider opacity-60"
                    style={{ color: pageInk }}
                  >
                    SA Member
                  </p>
                ) : null}
                {authenticated && wallet ? (
                  <button
                    type="button"
                    onClick={() => {
                      setError(null);
                      setSignInAs('member');
                      if (
                        wallet.membershipPath &&
                        !isAdvisorStaffPortalPath(wallet.membershipPath)
                      ) {
                        window.location.assign(wallet.membershipPath);
                        return;
                      }
                      setStep('join');
                    }}
                    className="rounded-2xl px-4 py-3.5 text-sm font-black"
                    style={fillBtn}
                  >
                    Continue as {wallet.name || 'SA Member'}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setError(null);
                      setSignInAs('member');
                      setStep('join');
                    }}
                    className="rounded-2xl px-4 py-3.5 text-sm font-black"
                    style={fillBtn}
                  >
                    SA Member — join as a {brand.audienceSingular}
                  </button>
                )}
                {rosterSignIn ? (
                  <button
                    type="button"
                    onClick={() => {
                      setError(null);
                      setSignInAs('member');
                      setStep('signIn');
                    }}
                    className="rounded-2xl border px-4 py-3.5 text-sm font-black"
                    style={ghostBtn(pageInk)}
                  >
                    I am an SA Member — sign in
                  </button>
                ) : null}
                {authenticated && wallet ? (
                  <p
                    className="text-[11px] font-medium opacity-75"
                    style={{ color: pageInk }}
                  >
                    Using your SA Member profile
                    {wallet.email ? ` · ${wallet.email}` : ''}.
                  </p>
                ) : null}
                {staffDesk ? (
                  <>
                    <p
                      className="pt-3 text-left text-[10px] font-black uppercase tracking-wider opacity-60"
                      style={{ color: pageInk }}
                    >
                      I work here
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setError(null);
                        setSignInAs('staff');
                        setStep('signIn');
                      }}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl border px-4 py-3.5 text-sm font-black"
                      style={ghostBtn(pageInk)}
                    >
                      {gym ? (
                        <Dumbbell className="h-4 w-4" />
                      ) : (
                        <Stethoscope className="h-4 w-4" />
                      )}
                      I work or contract here
                    </button>
                    <p
                      className="text-left text-[11px] opacity-70"
                      style={{ color: pageInk }}
                    >
                      Employed or contractor — same work app. Use the name and
                      email on {staffListLabel} in {brand.advisorLabel}.
                    </p>
                  </>
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
          </>
        )}
      </div>
      {brand.enabled ? (
        <AdvisorPwaInstallPrompt brand={brand} mode="sheet" autoOpen={false} />
      ) : null}
    </div>
  );
}
