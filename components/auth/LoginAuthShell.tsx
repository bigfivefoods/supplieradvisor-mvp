'use client';

import dynamic from 'next/dynamic';
import { Loader2 } from 'lucide-react';
import { useState } from 'react';

type LoginIntent = 'google' | 'apple' | 'email';

type LoginAuthShellProps = {
  prefillEmail?: string;
  nextFromQuery: string;
};

type LoginPrivyPanelProps = {
  prefillEmail?: string;
  nextFromQuery: string;
  queuedIntent: LoginIntent | null;
  onQueuedIntentConsumed: () => void;
  onPrivyReadyChange: (ready: boolean) => void;
};

const DynamicProviders = dynamic(
  () => import('@/components/Providers').then((mod) => mod.Providers),
  { ssr: false }
);

const DynamicLoginPrivyPanel = dynamic<LoginPrivyPanelProps>(
  () => import('@/components/auth/LoginPrivyPanel').then((mod) => mod.LoginPrivyPanel),
  { ssr: false }
);

export function LoginAuthShell({ prefillEmail, nextFromQuery }: LoginAuthShellProps) {
  const [queuedIntent, setQueuedIntent] = useState<LoginIntent | null>(null);
  const [privyReady, setPrivyReady] = useState(false);

  const queueIntent = (intent: LoginIntent) => {
    setQueuedIntent(intent);
  };

  const fallbackButton =
    'flex w-full min-h-[48px] items-center justify-center gap-2 rounded-2xl border border-neutral-200 bg-white py-3 text-sm font-semibold text-slate-800 hover:bg-neutral-50';

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

      <div className={privyReady ? 'block' : 'hidden'}>
        <DynamicProviders>
          <DynamicLoginPrivyPanel
            prefillEmail={prefillEmail}
            nextFromQuery={nextFromQuery}
            queuedIntent={queuedIntent}
            onQueuedIntentConsumed={() => setQueuedIntent(null)}
            onPrivyReadyChange={setPrivyReady}
          />
        </DynamicProviders>
      </div>
    </>
  );
}
