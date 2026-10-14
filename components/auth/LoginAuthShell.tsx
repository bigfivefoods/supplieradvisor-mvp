'use client';

import { Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { clientShouldLoadPrivyImmediately } from '@/lib/auth/login-privy-resume';
import { stashOauthReturnParams } from '@/lib/auth/oauth-return';

type LoginIntent = 'google' | 'apple' | 'email';

type PrivyModules = {
  Providers: (typeof import('@/components/Providers'))['Providers'];
  LoginPrivyPanel: (typeof import('@/components/auth/LoginPrivyPanel'))['LoginPrivyPanel'];
};

export function LoginAuthShell({ prefillEmail, nextFromQuery }: { prefillEmail?: string; nextFromQuery: string }) {
  const [queuedIntent, setQueuedIntent] = useState<LoginIntent | null>(null);
  const [privyReady, setPrivyReady] = useState(false);
  // Stay false until a sign-in click, or until an existing session / OAuth
  // return needs the same redirect. The import() stays inside this effect
  // so the login payload does not preload the Privy chunk.
  const [loadPrivy, setLoadPrivy] = useState(false);
  const [privyModules, setPrivyModules] = useState<PrivyModules | null>(null);

  useEffect(() => {
    if (clientShouldLoadPrivyImmediately()) {
      setLoadPrivy(true);
    }
  }, []);

  useEffect(() => {
    if (!loadPrivy || privyModules) return;
    let cancelled = false;
    void (async () => {
      const [{ Providers }, { LoginPrivyPanel }] = await Promise.all([
        import('@/components/Providers'),
        import('@/components/auth/LoginPrivyPanel'),
      ]);
      if (cancelled) return;
      setPrivyModules({ Providers, LoginPrivyPanel });
    })();
    return () => {
      cancelled = true;
    };
  }, [loadPrivy, privyModules]);

  const queueIntent = (intent: LoginIntent) => {
    // Save next, email, and company before the Privy chunk loads so the
    // email-code return and the Google/Apple return resolve to the same path.
    stashOauthReturnParams();
    setQueuedIntent(intent);
    setLoadPrivy(true);
  };

  const fallbackButton =
    'flex w-full min-h-[48px] items-center justify-center gap-2 rounded-2xl border border-neutral-200 bg-white py-3 text-sm font-semibold text-slate-800 hover:bg-neutral-50';

  const Providers = privyModules?.Providers;
  const LoginPrivyPanel = privyModules?.LoginPrivyPanel;

  return (
    <>
      {!privyReady ? (
        <div className="space-y-3" aria-live="polite">
          <button
            type="button"
            className="sa-btn-brand flex w-full min-h-[52px] items-center justify-center gap-2 rounded-2xl py-4 text-lg font-semibold hover:bg-[#22d3ee]"
            onClick={() => queueIntent('google')}
          >
            {queuedIntent === 'google' ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
            Continue with Google
          </button>

          <button
            type="button"
            className={fallbackButton}
            onClick={() => queueIntent('apple')}
          >
            {queuedIntent === 'apple' ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Continue with Apple
          </button>

          <button
            type="button"
            className={fallbackButton}
            onClick={() => queueIntent('email')}
          >
            {queuedIntent === 'email' ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Continue with email
          </button>
        </div>
      ) : null}

      {Providers && LoginPrivyPanel ? (
        <div className={privyReady ? 'block' : 'hidden'}>
          <Providers>
            <LoginPrivyPanel
              prefillEmail={prefillEmail}
              nextFromQuery={nextFromQuery}
              queuedIntent={queuedIntent}
              onQueuedIntentConsumed={() => setQueuedIntent(null)}
              onPrivyReadyChange={setPrivyReady}
            />
          </Providers>
        </div>
      ) : null}
    </>
  );
}
