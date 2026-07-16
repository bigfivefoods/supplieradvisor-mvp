'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Download,
  Share,
  X,
  Smartphone,
  MoreVertical,
  ExternalLink,
  CheckCircle2,
} from 'lucide-react';

const DISMISS_KEY = 'sa_pwa_install_dismissed_at';
const DISMISS_DAYS = 7;

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

function isAndroid(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /android/i.test(navigator.userAgent);
}

/** Instagram / Facebook / LinkedIn / etc. — cannot install PWAs */
function isInAppBrowser(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return /\bFBAN\b|\bFBAV\b|Instagram|Line\/|LinkedInApp|Twitter|Snapchat|MicroMessenger|TikTok|BytedanceWebview|Pinterest/i.test(
    ua
  );
}

function isIosSafari(): boolean {
  if (!isIos()) return false;
  const ua = navigator.userAgent || '';
  // Chrome/Firefox/Edge on iOS still use WebKit but A2HS only works in Safari
  if (/CriOS|FxiOS|EdgiOS|OPiOS/i.test(ua)) return false;
  return /Safari/i.test(ua) || !/CriOS|FxiOS/i.test(ua);
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
 * Install / Add to Home Screen helper.
 * - Android Chrome: native beforeinstallprompt when available
 * - iOS: Safari Share → Add to Home Screen (only Safari works)
 * - In-app browsers: open in system browser instructions
 */
export default function InstallAppBanner() {
  const [panelOpen, setPanelOpen] = useState(false);
  const [chipVisible, setChipVisible] = useState(false);
  const [ios, setIos] = useState(false);
  const [android, setAndroid] = useState(false);
  const [iosSafari, setIosSafari] = useState(false);
  const [inApp, setInApp] = useState(false);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installing, setInstalling] = useState(false);
  const [swReady, setSwReady] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (isStandalone()) return;

    setIos(isIos());
    setAndroid(isAndroid());
    setIosSafari(isIosSafari());
    setInApp(isInAppBrowser());

    // Show compact chip unless recently dismissed (panel can still open from /install)
    if (!isDismissed()) {
      setChipVisible(true);
    }

    const onBip = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setChipVisible(true);
      // Auto-open once when Chrome is ready to install (helps users who miss the chip)
      try {
        if (!sessionStorage.getItem('sa_pwa_auto_panel')) {
          sessionStorage.setItem('sa_pwa_auto_panel', '1');
          setPanelOpen(true);
        }
      } catch {
        setPanelOpen(true);
      }
    };
    window.addEventListener('beforeinstallprompt', onBip);

    // Ensure SW is registered (install criteria)
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready
        .then(() => setSwReady(true))
        .catch(() => setSwReady(false));
      // Nudge registration if Providers SW not ready yet
      navigator.serviceWorker
        .register('/sw.js', { scope: '/', updateViaCache: 'none' })
        .then(() => setSwReady(true))
        .catch(() => {});
    }

    // Listen for “open install help” from other UI
    const onOpen = () => {
      try {
        localStorage.removeItem(DISMISS_KEY);
      } catch {
        /* ignore */
      }
      setChipVisible(true);
      setPanelOpen(true);
    };
    window.addEventListener('sa-open-install', onOpen);

    return () => {
      window.removeEventListener('beforeinstallprompt', onBip);
      window.removeEventListener('sa-open-install', onOpen);
    };
  }, []);

  const dismissChip = useCallback(() => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      /* ignore */
    }
    setChipVisible(false);
    setPanelOpen(false);
  }, []);

  const install = useCallback(async () => {
    if (!deferred) return;
    setInstalling(true);
    try {
      await deferred.prompt();
      const choice = await deferred.userChoice;
      setDeferred(null);
      if (choice.outcome === 'accepted') {
        setPanelOpen(false);
        setChipVisible(false);
      }
    } catch {
      /* cancelled */
    } finally {
      setInstalling(false);
    }
  }, [deferred]);

  if (typeof window !== 'undefined' && isStandalone()) return null;

  return (
    <>
      {/* Compact always-available chip */}
      {chipVisible && !panelOpen && (
        <div className="fixed z-[96] right-3 bottom-[calc(5rem+env(safe-area-inset-bottom,0px))] md:bottom-6 md:right-6 pointer-events-none">
          <button
            type="button"
            onClick={() => setPanelOpen(true)}
            className="pointer-events-auto inline-flex items-center gap-2 rounded-full bg-[#00b4d8] pl-3.5 pr-4 py-3 text-sm font-bold text-white shadow-xl shadow-sky-500/30 hover:bg-[#0099b8] touch-manipulation"
          >
            <Smartphone className="w-4 h-4" />
            Install app
          </button>
        </div>
      )}

      {panelOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Install SupplierAdvisor"
        >
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/50"
            aria-label="Close"
            onClick={() => setPanelOpen(false)}
          />
          <div className="relative w-full sm:max-w-md max-h-[min(92dvh,100%)] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-white shadow-2xl border border-slate-200 pb-[env(safe-area-inset-bottom)]">
            <div className="sticky top-0 flex items-center justify-between gap-2 border-b border-slate-100 bg-white px-4 py-3 rounded-t-3xl">
              <div className="font-black text-slate-900 text-base">
                Install on home screen
              </div>
              <button
                type="button"
                onClick={() => setPanelOpen(false)}
                className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 touch-manipulation"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 sm:p-5 space-y-4">
              <p className="text-sm text-slate-600 leading-relaxed">
                Add SupplierAdvisor like an app — full screen, faster launch, works better
                on the go.
              </p>

              {inApp && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
                  <strong className="font-bold">Open in your browser first</strong>
                  <p className="mt-1 text-amber-900/90 text-xs leading-relaxed">
                    Install does not work inside Instagram, Facebook, LinkedIn, or similar
                    in-app browsers.
                    {ios
                      ? ' Tap ··· or Share → “Open in Safari”, then follow the steps below.'
                      : ' Tap ⋮ menu → “Open in Chrome” (or your browser), then install.'}
                  </p>
                </div>
              )}

              {/* Native Android / desktop Chrome install */}
              {deferred && !inApp && (
                <button
                  type="button"
                  disabled={installing}
                  onClick={() => void install()}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-[#00b4d8] px-4 py-3.5 text-sm font-bold text-white shadow-sm hover:bg-[#0099b8] disabled:opacity-60 touch-manipulation"
                >
                  <Download className="w-4 h-4" />
                  {installing ? 'Installing…' : 'Install SupplierAdvisor'}
                </button>
              )}

              {/* iOS Safari steps */}
              {ios && !inApp && (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 space-y-2.5">
                  <div className="text-xs font-black uppercase tracking-wider text-slate-500">
                    {iosSafari ? 'iPhone / iPad (Safari)' : 'iPhone — use Safari'}
                  </div>
                  {!iosSafari && (
                    <p className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
                      Chrome and other browsers on iPhone <strong>cannot</strong> add to
                      Home Screen. Open{' '}
                      <strong>safari://</strong> and go to{' '}
                      <strong>www.supplieradvisor.com</strong>, then:
                    </p>
                  )}
                  <ol className="space-y-2 text-sm text-slate-700">
                    <li className="flex gap-2">
                      <span className="font-black text-[#00b4d8]">1.</span>
                      <span>
                        Tap the <Share className="inline w-4 h-4 text-[#00b4d8]" />{' '}
                        <strong>Share</strong> button (square with arrow) at the bottom
                        of Safari.
                      </span>
                    </li>
                    <li className="flex gap-2">
                      <span className="font-black text-[#00b4d8]">2.</span>
                      <span>
                        Scroll and tap <strong>Add to Home Screen</strong>.
                      </span>
                    </li>
                    <li className="flex gap-2">
                      <span className="font-black text-[#00b4d8]">3.</span>
                      <span>
                        Tap <strong>Add</strong> — the SupplierAdvisor icon appears on
                        your home screen.
                      </span>
                    </li>
                  </ol>
                </div>
              )}

              {/* Android without bip yet */}
              {android && !deferred && !inApp && (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 space-y-2.5">
                  <div className="text-xs font-black uppercase tracking-wider text-slate-500">
                    Android (Chrome)
                  </div>
                  <ol className="space-y-2 text-sm text-slate-700">
                    <li className="flex gap-2">
                      <span className="font-black text-[#00b4d8]">1.</span>
                      <span>
                        Tap <MoreVertical className="inline w-4 h-4" />{' '}
                        <strong>menu</strong> (top right in Chrome).
                      </span>
                    </li>
                    <li className="flex gap-2">
                      <span className="font-black text-[#00b4d8]">2.</span>
                      <span>
                        Tap <strong>Install app</strong> or{' '}
                        <strong>Add to Home screen</strong>.
                      </span>
                    </li>
                    <li className="flex gap-2">
                      <span className="font-black text-[#00b4d8]">3.</span>
                      <span>
                        Confirm <strong>Install</strong>.
                      </span>
                    </li>
                  </ol>
                  {!swReady && (
                    <p className="text-[11px] text-slate-500">
                      Preparing install… keep this page open a few seconds, then open
                      the Chrome menu again.
                    </p>
                  )}
                </div>
              )}

              {/* Desktop fallback */}
              {!ios && !android && !deferred && (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                  In Chrome or Edge: open the address bar menu →{' '}
                  <strong>Install SupplierAdvisor</strong> (or Install app).
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <Link
                  href="/install"
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-[#0077b6] hover:underline"
                  onClick={() => setPanelOpen(false)}
                >
                  Full install guide <ExternalLink className="w-3 h-3" />
                </Link>
                <button
                  type="button"
                  onClick={dismissChip}
                  className="text-xs font-semibold text-slate-400 hover:text-slate-600 ml-auto"
                >
                  Hide for a week
                </button>
              </div>

              {swReady && (
                <p className="text-[10px] text-emerald-700 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> App engine ready on this device
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/** Call from any client UI: window.dispatchEvent(new Event('sa-open-install')) */
export function openInstallHelp() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event('sa-open-install'));
}
