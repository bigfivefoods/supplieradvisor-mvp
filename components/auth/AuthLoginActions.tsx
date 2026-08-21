'use client';

import { useState } from 'react';
import { useLoginWithOAuth, usePrivy } from '@privy-io/react-auth';
import { Loader2, Mail } from 'lucide-react';
import {
  isInAppBrowserOauthError,
  isStandaloneDisplay,
  openInSystemBrowser,
  stripUrlForOauthRedirect,
} from '@/lib/auth/oauth-return';

type AuthLoginActionsProps = {
  prefillEmail?: string;
  /** Compact stack for marketing / member-app cards */
  variant?: 'default' | 'onBrand';
  emailLabel?: string;
};

/**
 * First-class Google / Apple / email buttons.
 * Privy modal social buttons often open a Google account picker whose
 * result never returns (popup + FedCM). initOAuth uses a full redirect.
 */
export function AuthLoginActions({
  prefillEmail,
  variant = 'default',
  emailLabel = 'Continue with email',
}: AuthLoginActionsProps) {
  const { login, ready } = usePrivy();
  const { initOAuth, loading: oauthLoading } = useLoginWithOAuth();
  const [busy, setBusy] = useState<'google' | 'apple' | 'email' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const startOAuth = async (provider: 'google' | 'apple') => {
    if (!ready || busy) return;
    setError(null);
    setBusy(provider);
    try {
      stripUrlForOauthRedirect();
      await initOAuth({ provider });
    } catch (e: unknown) {
      console.error('Privy OAuth error:', e);
      if (isInAppBrowserOauthError(e) && isStandaloneDisplay()) {
        const dest = `${window.location.pathname}${window.location.search || ''}`;
        openInSystemBrowser(dest || '/me');
        setError(
          'Google sign-in is blocked inside the installed gym app. Continue in Chrome or Safari — we opened it for you.'
        );
        setBusy(null);
        return;
      }
      setError(
        e instanceof Error
          ? e.message
          : `Could not start ${provider === 'google' ? 'Google' : 'Apple'} sign-in. Try email instead.`
      );
      setBusy(null);
    }
  };

  const startEmail = () => {
    if (!ready || busy) return;
    setError(null);
    setBusy('email');
    try {
      login({
        loginMethods: ['email'],
        ...(prefillEmail
          ? { prefill: { type: 'email' as const, value: prefillEmail } }
          : {}),
      });
    } catch (e: unknown) {
      console.error('Privy email login error:', e);
      setError(
        e instanceof Error ? e.message : 'Could not open email sign-in.'
      );
    } finally {
      setBusy(null);
    }
  };

  const disabled = !ready || oauthLoading || busy != null;
  const onBrand = variant === 'onBrand';

  const primaryBtn = onBrand
    ? 'flex w-full min-h-[52px] items-center justify-center gap-2 rounded-2xl bg-white py-3.5 text-base font-black text-[#0077b6] shadow-xl disabled:opacity-60'
    : 'flex w-full min-h-[52px] items-center justify-center gap-2 rounded-2xl bg-[#00b4d8] py-4 text-lg font-semibold text-white hover:bg-[#0099b8] disabled:bg-neutral-400';
  const secondaryBtn = onBrand
    ? 'flex w-full min-h-[48px] items-center justify-center gap-2 rounded-2xl border border-white/40 bg-white/12 py-3 text-sm font-bold text-white disabled:opacity-60'
    : 'flex w-full min-h-[48px] items-center justify-center gap-2 rounded-2xl border border-neutral-200 bg-white py-3 text-sm font-semibold text-slate-800 hover:bg-neutral-50 disabled:opacity-60';

  return (
    <div className="space-y-3">
      {error ? (
        <div
          className={`rounded-2xl border px-4 py-3 text-sm ${
            onBrand
              ? 'border-white/30 bg-white/15 text-white'
              : 'border-red-200 bg-red-50 text-red-700'
          }`}
        >
          <p>{error}</p>
          {/Chrome|Safari|browser|not allowed|in-app/i.test(error) ? (
            <button
              type="button"
              className="mt-2 text-xs font-black underline"
              onClick={() =>
                openInSystemBrowser(
                  `${window.location.pathname}${window.location.search || ''}` ||
                    '/me'
                )
              }
            >
              Open in Chrome or Safari
            </button>
          ) : null}
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => void startOAuth('google')}
        disabled={disabled}
        className={primaryBtn}
      >
        {busy === 'google' ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <GoogleMark />
        )}
        Continue with Google
      </button>

      <button
        type="button"
        onClick={() => void startOAuth('apple')}
        disabled={disabled}
        className={secondaryBtn}
      >
        {busy === 'apple' ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <AppleMark className={onBrand ? 'text-white' : 'text-slate-900'} />
        )}
        Continue with Apple
      </button>

      <button
        type="button"
        onClick={startEmail}
        disabled={disabled}
        className={secondaryBtn}
      >
        {busy === 'email' ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Mail className="h-4 w-4" />
        )}
        {emailLabel}
      </button>
    </div>
  );
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
      <path
        fill="#4285F4"
        d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5c-.3 1.5-1.1 2.8-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.7z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.9-3c-1.1.7-2.5 1.2-4 1.2-3.1 0-5.7-2.1-6.6-4.9H1.4v3.1C3.4 21.3 7.4 24 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.4 14.4c-.2-.7-.4-1.5-.4-2.4s.1-1.7.4-2.4V6.5H1.4C.5 8.3 0 10.1 0 12s.5 3.7 1.4 5.5l4-3.1z"
      />
      <path
        fill="#EA4335"
        d="M12 4.8c1.7 0 3.3.6 4.5 1.8l3.4-3.4C17.9 1.2 15.2 0 12 0 7.4 0 3.4 2.7 1.4 6.5l4 3.1C6.3 6.8 8.9 4.8 12 4.8z"
      />
    </svg>
  );
}

function AppleMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`h-5 w-5 ${className || ''}`} aria-hidden>
      <path
        fill="currentColor"
        d="M16.4 12.7c0-2.3 1.9-3.4 2-3.5-1.1-1.6-2.8-1.8-3.4-1.8-1.4-.2-2.8.9-3.5.9s-1.8-.8-3-.8c-1.5 0-3 .9-3.8 2.3-1.6 2.8-.4 7 1.2 9.3.8 1.1 1.7 2.3 2.9 2.3 1.2 0 1.6-.7 3-.7s1.8.7 3 .7 2-1.1 2.8-2.2c.9-1.3 1.2-2.5 1.3-2.6-.1 0-2.4-.9-2.5-3.9zM14.7 5.6c.6-.8 1.1-1.9.9-3-.9 0-2 .6-2.6 1.4-.6.7-1.1 1.8-.9 2.9 1 .1 2-.5 2.6-1.3z"
      />
    </svg>
  );
}
