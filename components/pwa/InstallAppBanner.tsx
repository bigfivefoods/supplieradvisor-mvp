'use client';

import { useCallback, useEffect, useState } from 'react';
import { Download, Share, X, Smartphone } from 'lucide-react';

const DISMISS_KEY = 'sa_pwa_install_dismissed_at';
const DISMISS_DAYS = 21;

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const mq = window.matchMedia('(display-mode: standalone)').matches;
  const iosStandalone =
    'standalone' in window.navigator &&
    Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone);
  return mq || iosStandalone;
}

function isIos(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isDismissed(): boolean {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    const at = Number(raw);
    if (!Number.isFinite(at)) return false;
    return Date.now() - at < DISMISS_DAYS * 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

/**
 * Lightweight “install to home screen” prompt.
 * Android Chrome: uses beforeinstallprompt.
 * iOS Safari: shows Share → Add to Home Screen steps.
 * Hidden when already running as installed PWA.
 */
export default function InstallAppBanner() {
  const [visible, setVisible] = useState(false);
  const [iosHint, setIosHint] = useState(false);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(
    null
  );
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (isStandalone() || isDismissed()) return;

    setIosHint(isIos());

    const onBip = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setVisible(true);
    };

    window.addEventListener('beforeinstallprompt', onBip);

    // iOS / browsers without bip: show after short delay on small screens
    const t = window.setTimeout(() => {
      if (isStandalone() || isDismissed()) return;
      if (isIos() || window.matchMedia('(max-width: 768px)').matches) {
        setVisible(true);
      }
    }, 4500);

    return () => {
      window.removeEventListener('beforeinstallprompt', onBip);
      window.clearTimeout(t);
    };
  }, []);

  const dismiss = useCallback(() => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      /* ignore */
    }
    setVisible(false);
  }, []);

  const install = useCallback(async () => {
    if (!deferred) return;
    setInstalling(true);
    try {
      await deferred.prompt();
      await deferred.userChoice;
      setDeferred(null);
      setVisible(false);
    } catch {
      /* user cancelled */
    } finally {
      setInstalling(false);
    }
  }, [deferred]);

  if (!visible || isStandalone()) return null;

  return (
    <div
      className="fixed inset-x-0 z-[95] px-3 pointer-events-none sm:px-4 bottom-[calc(4.75rem+env(safe-area-inset-bottom,0px))] md:bottom-0 md:pb-[max(0.75rem,env(safe-area-inset-bottom))]"
      role="dialog"
      aria-label="Install SupplierAdvisor"
    >
      <div className="pointer-events-auto mx-auto max-w-lg rounded-2xl border border-sky-200 bg-white/98 shadow-2xl shadow-sky-900/10 backdrop-blur-md">
        <div className="flex items-start gap-3 p-3.5 sm:p-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#00b4d8] to-[#0077b6] text-white shadow-sm">
            <Smartphone className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-black text-slate-900">
              Install SupplierAdvisor
            </div>
            <p className="mt-0.5 text-xs leading-relaxed text-slate-600">
              {deferred
                ? 'Add to your home screen for faster access — works offline-friendly like an app.'
                : iosHint
                  ? 'On iPhone: tap Share, then “Add to Home Screen” for a full-screen app icon.'
                  : 'Add this site to your home screen for quick launch and a cleaner full-screen experience.'}
            </p>
            <div className="mt-2.5 flex flex-wrap gap-2">
              {deferred ? (
                <button
                  type="button"
                  disabled={installing}
                  onClick={() => void install()}
                  className="inline-flex items-center gap-1.5 rounded-full bg-[#00b4d8] px-3.5 py-2 text-xs font-bold text-white shadow-sm hover:bg-[#0099b8] disabled:opacity-60 touch-manipulation"
                >
                  <Download className="h-3.5 w-3.5" />
                  {installing ? 'Installing…' : 'Install app'}
                </button>
              ) : iosHint ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] font-semibold text-slate-700">
                  <Share className="h-3.5 w-3.5 text-[#00b4d8]" />
                  Share → Add to Home Screen
                </span>
              ) : (
                <span className="text-[11px] font-semibold text-slate-500">
                  Use your browser menu → Install / Add to Home Screen
                </span>
              )}
              <button
                type="button"
                onClick={dismiss}
                className="rounded-full px-3 py-2 text-xs font-semibold text-slate-500 hover:bg-slate-50 touch-manipulation"
              >
                Not now
              </button>
            </div>
          </div>
          <button
            type="button"
            onClick={dismiss}
            className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 touch-manipulation"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
