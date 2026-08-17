'use client';

import { useCallback, useEffect, useState } from 'react';
import { Download, Share, Smartphone, SquarePlus, X } from 'lucide-react';
import { SaOfficialLogo } from '@/components/brand/SaOfficialLogo';

const STORAGE_KEY = 'sa_member_pwa_install';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    Boolean(
      (window.navigator as Navigator & { standalone?: boolean }).standalone
    )
  );
}

function isIos(): boolean {
  if (typeof navigator === 'undefined') return false;
  return (
    /iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

function wasDismissed(): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as { dismissedAt?: number };
    return Boolean(parsed.dismissedAt);
  } catch {
    return false;
  }
}

function markDismissed() {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ dismissedAt: Date.now() })
    );
  } catch {
    /* private mode */
  }
}

/**
 * First-open install sheet for SA Member.
 * Auto-shows once if the app is not already on the home screen.
 * iOS: in-app Share → Add to Home Screen steps.
 * Android Chrome: native install prompt when the browser offers it.
 */
export function B2cInstallPrompt() {
  const [open, setOpen] = useState(false);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(
    null
  );
  const [busy, setBusy] = useState(false);
  const [ios] = useState(isIos);

  useEffect(() => {
    if (typeof window === 'undefined' || isStandalone()) return;

    const onBip = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', onBip);

    const onOpen = () => setOpen(true);
    window.addEventListener('sa-open-install', onOpen);

    const t = window.setTimeout(() => {
      if (!isStandalone() && !wasDismissed()) setOpen(true);
    }, 450);

    return () => {
      window.clearTimeout(t);
      window.removeEventListener('beforeinstallprompt', onBip);
      window.removeEventListener('sa-open-install', onOpen);
    };
  }, []);

  const close = useCallback(() => {
    markDismissed();
    setOpen(false);
  }, []);

  const install = useCallback(async () => {
    if (ios || !deferred) return;
    setBusy(true);
    try {
      await deferred.prompt();
      const { outcome } = await deferred.userChoice;
      setDeferred(null);
      if (outcome === 'accepted') {
        markDismissed();
        setOpen(false);
      }
    } catch {
      /* user closed the browser sheet */
    } finally {
      setBusy(false);
    }
  }, [deferred, ios]);

  if (!open || (typeof window !== 'undefined' && isStandalone())) return null;

  return (
    <div
      className="fixed inset-0 z-[600] flex items-end justify-center bg-slate-950/55 p-3 sm:items-center"
      style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="sa-member-install-title"
    >
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Close install"
        onClick={close}
      />
      <div className="relative z-[1] w-full max-w-md overflow-hidden rounded-[1.75rem] bg-white shadow-2xl dark:bg-neutral-900">
        <div className="bg-gradient-to-br from-[#0077b6] via-[#0284c7] to-[#0c4a6e] px-5 pb-5 pt-4 text-white">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="flex h-14 items-center rounded-2xl bg-white px-2 shadow-lg">
                <SaOfficialLogo title="SA Member" className="h-10 w-auto" />
              </span>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-sky-100">
                  First open
                </p>
                <h2
                  id="sa-member-install-title"
                  className="text-xl font-black tracking-tight"
                >
                  Add SA Member to your phone
                </h2>
              </div>
            </div>
            <button
              type="button"
              onClick={close}
              className="rounded-full bg-white/15 p-2"
              aria-label="Not now"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <p className="mt-3 text-sm text-sky-50/95">
            Install once — hire path, gym check-in, shop and your profile open
            like a real app. Free. Takes about 10 seconds.
          </p>
        </div>

        <div className="space-y-3 px-5 py-4">
          {ios ? (
            <ol className="space-y-2.5 text-sm text-slate-700 dark:text-neutral-300">
              <li className="flex gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-[#0077b6]">
                  <Share className="h-4 w-4" />
                </span>
                <span>
                  <span className="font-black text-slate-900 dark:text-white">1 · Share</span>
                  <span className="mt-0.5 block text-[12px] text-slate-500 dark:text-neutral-400">
                    Tap the Share button in Safari (square with an arrow).
                  </span>
                </span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-[#0077b6]">
                  <SquarePlus className="h-4 w-4" />
                </span>
                <span>
                  <span className="font-black text-slate-900 dark:text-white">
                    2 · Add to Home Screen
                  </span>
                  <span className="mt-0.5 block text-[12px] text-slate-500 dark:text-neutral-400">
                    Scroll the sheet and tap Add to Home Screen, then Add.
                  </span>
                </span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-[#0077b6]">
                  <Smartphone className="h-4 w-4" />
                </span>
                <span>
                  <span className="font-black text-slate-900 dark:text-white">3 · Open Member</span>
                  <span className="mt-0.5 block text-[12px] text-slate-500 dark:text-neutral-400">
                    Use the new icon on your home screen next time.
                  </span>
                </span>
              </li>
            </ol>
          ) : (
            <p className="text-sm text-slate-600 dark:text-neutral-300">
              {deferred
                ? 'Your browser can install SA Member now. You will get a home-screen icon.'
                : 'In Chrome, open the menu (⋮) and tap Install app or Add to Home screen.'}
            </p>
          )}

          <div className="flex flex-col gap-2 pt-1">
            {!ios && deferred ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => void install()}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#0077b6] py-3.5 text-sm font-black text-white disabled:opacity-60"
              >
                <Download className="h-4 w-4" />
                {busy ? 'Installing…' : 'Install app'}
              </button>
            ) : null}
            <button
              type="button"
              onClick={close}
              className="rounded-2xl border border-slate-200 py-3 text-sm font-bold text-slate-600 dark:border-neutral-700 dark:text-neutral-300"
            >
              Not now — continue in the browser
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
