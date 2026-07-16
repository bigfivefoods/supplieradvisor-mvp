'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Download, Smartphone, X } from 'lucide-react';

const DISMISS_KEY = 'sa_pwa_install_dismissed_at';
const DISMISS_DAYS = 3;

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

function isDismissed(): boolean {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    const at = Number(raw);
    return Number.isFinite(at) && Date.now() - at < DISMISS_DAYS * 864e5;
  } catch {
    return false;
  }
}

/**
 * Floating install entry — always opens the static guide that works on real phones.
 * Native Chrome prompt is used when available; otherwise send users to /add-to-home.html
 */
export default function InstallAppBanner() {
  const [chip, setChip] = useState(false);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || isStandalone()) return;

    if (!isDismissed()) setChip(true);

    const onBip = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setChip(true);
    };
    window.addEventListener('beforeinstallprompt', onBip);

    // Early SW register (duplicate of ServiceWorkerRegister is fine)
    if ('serviceWorker' in navigator) {
      void navigator.serviceWorker
        .register('/sw.js', { scope: '/', updateViaCache: 'none' })
        .catch(() => {});
    }

    const onOpen = () => {
      try {
        localStorage.removeItem(DISMISS_KEY);
      } catch {
        /* ignore */
      }
      setChip(true);
      window.location.href = '/add-to-home.html';
    };
    window.addEventListener('sa-open-install', onOpen);

    return () => {
      window.removeEventListener('beforeinstallprompt', onBip);
      window.removeEventListener('sa-open-install', onOpen);
    };
  }, []);

  const dismiss = useCallback(() => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      /* ignore */
    }
    setChip(false);
  }, []);

  const installNative = useCallback(async () => {
    if (!deferred) {
      window.location.href = '/add-to-home.html';
      return;
    }
    setBusy(true);
    try {
      await deferred.prompt();
      const { outcome } = await deferred.userChoice;
      setDeferred(null);
      if (outcome === 'accepted') setChip(false);
    } catch {
      window.location.href = '/add-to-home.html';
    } finally {
      setBusy(false);
    }
  }, [deferred]);

  if (!chip || (typeof window !== 'undefined' && isStandalone())) return null;

  return (
    <div
      className="fixed z-[500] right-3 flex flex-col items-end gap-2 pointer-events-none"
      style={{
        bottom: 'max(1rem, calc(5.5rem + env(safe-area-inset-bottom, 0px)))',
      }}
    >
      <div className="pointer-events-auto flex items-center gap-1 rounded-full bg-white shadow-2xl shadow-slate-900/20 border-2 border-[#00b4d8] p-1 pl-1.5">
        <button
          type="button"
          onClick={() => void installNative()}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-full bg-[#00b4d8] px-4 py-2.5 text-sm font-black text-white touch-manipulation active:scale-95 disabled:opacity-70"
        >
          {deferred ? (
            <Download className="w-4 h-4" />
          ) : (
            <Smartphone className="w-4 h-4" />
          )}
          {busy ? '…' : deferred ? 'Install app' : 'Add to Home Screen'}
        </button>
        <button
          type="button"
          onClick={dismiss}
          className="rounded-full p-2.5 text-slate-400 hover:bg-slate-100 touch-manipulation"
          aria-label="Hide"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      <Link
        href="/add-to-home.html"
        className="pointer-events-auto text-[11px] font-bold text-[#0077b6] bg-white/95 border border-slate-200 rounded-full px-3 py-1 shadow-sm"
      >
        Open install steps →
      </Link>
    </div>
  );
}

export function openInstallHelp() {
  if (typeof window === 'undefined') return;
  window.location.href = '/add-to-home.html';
}
