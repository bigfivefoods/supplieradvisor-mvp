'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Download, Smartphone, X } from 'lucide-react';

const DISMISS_KEY = 'sa_pwa_install_dismissed_at';
const DISMISS_DAYS = 14;
const REVEAL_DELAY_MS = 15000;

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

export function heroPassedViewport(scrollY: number, viewportHeight: number): boolean {
  return scrollY > Math.max(viewportHeight * 0.8, 220);
}

export function shouldRevealInstallPrompt({
  dismissed,
  standalone,
  heroVisible = true,
  elapsedMs = 0,
}: {
  dismissed: boolean;
  standalone: boolean;
  heroVisible?: boolean;
  elapsedMs?: number;
}): boolean {
  if (dismissed || standalone) return false;
  return !heroVisible || elapsedMs >= REVEAL_DELAY_MS;
}

export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    Boolean(
      (window.navigator as Navigator & { standalone?: boolean }).standalone
    )
  );
}

export function isDismissed(): boolean {
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
  const pathname = usePathname() || '';
  const [ready, setReady] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const standalone = isStandalone();
    if (standalone) return;

    const dismissedState = isDismissed();
    setDismissed(dismissedState);
    if (dismissedState) return;

    let timer: number | undefined;
    let observer: IntersectionObserver | null = null;
    const passiveListenerOptions: AddEventListenerOptions = { passive: true };
    let heroVisible = true;

    const reveal = (nextHeroVisible: boolean) => {
      heroVisible = nextHeroVisible;
      setReady(true);
      if (timer) {
        window.clearTimeout(timer);
        timer = undefined;
      }
    };

    const hide = () => {
      setReady(false);
    };

    const onScroll = () => {
      const nextHeroVisible = !heroPassedViewport(window.scrollY, window.innerHeight);
      heroVisible = nextHeroVisible;
      if (nextHeroVisible) {
        hide();
        return;
      }
      if (
        shouldRevealInstallPrompt({
          dismissed: dismissedState,
          standalone: false,
          heroVisible: nextHeroVisible,
          elapsedMs: 0,
        })
      ) {
        reveal(nextHeroVisible);
      }
    };

    const hero = document.getElementById('platform');
    if (hero) {
      observer = new IntersectionObserver(
        (entries) => {
          const entry = entries[0];
          if (!entry) return;
          if (entry.isIntersecting) {
            hide();
            return;
          }
          const nextHeroVisible = false;
          heroVisible = nextHeroVisible;
          if (
            shouldRevealInstallPrompt({
              dismissed: dismissedState,
              standalone: false,
              heroVisible: nextHeroVisible,
              elapsedMs: 0,
            })
          ) {
            reveal(nextHeroVisible);
          }
        },
        { threshold: 0.2 }
      );
      observer.observe(hero);
    }

    window.addEventListener('scroll', onScroll, passiveListenerOptions);
    onScroll();
    timer = window.setTimeout(() => {
      const nextHeroVisible = heroVisible;
      if (
        shouldRevealInstallPrompt({
          dismissed: dismissedState,
          standalone: false,
          heroVisible: nextHeroVisible,
          elapsedMs: REVEAL_DELAY_MS,
        })
      ) {
        reveal(nextHeroVisible);
      }
    }, REVEAL_DELAY_MS);

    return () => {
      window.removeEventListener('scroll', onScroll, passiveListenerOptions);
      if (observer) observer.disconnect();
      if (timer) window.clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || isStandalone()) return;

    const onBip = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      if (typeof window !== 'undefined' && !isStandalone() && !isDismissed()) {
        setReady(true);
      }
    };
    window.addEventListener('beforeinstallprompt', onBip);

    // Early SW register (duplicate of ServiceWorkerRegister is fine)
    if ('serviceWorker' in navigator) {
      void navigator.serviceWorker
        .register('/sw.js', { scope: '/', updateViaCache: 'none' })
        .catch(() => {});
    }

    const onOpen = () => {
      const path = window.location.pathname || '';
      // Company-branded / SA Member install chrome owns these routes
      if (path.startsWith('/me')) return;
      if (path.startsWith('/pwa')) return;
      if (path.startsWith('/member')) return;
      if (path.startsWith('/hire/')) return;
      if (path.startsWith('/join/')) return;
      if (path.startsWith('/coach')) return;
      try {
        localStorage.removeItem(DISMISS_KEY);
      } catch {
        /* ignore */
      }
      setReady(true);
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
    setDismissed(true);
    setReady(false);
  }, []);

  const installNative = useCallback(async () => {
    // iPhone never gets beforeinstallprompt — always open the Safari guide
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
    const isIos =
      /iPhone|iPad|iPod/i.test(ua) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    if (isIos || !deferred) {
      window.location.href = '/add-to-home.html';
      return;
    }
    setBusy(true);
    try {
      await deferred.prompt();
      const { outcome } = await deferred.userChoice;
      setDeferred(null);
      if (outcome === 'accepted') setReady(false);
    } catch {
      window.location.href = '/add-to-home.html';
    } finally {
      setBusy(false);
    }
  }, [deferred]);

  // SA Member has its own install chrome — avoid a second floating bar
  if (pathname.startsWith('/me')) return null;
  // Company-branded member/patient/hire apps have their own install chrome
  if (pathname.startsWith('/pwa')) return null;
  if (pathname.startsWith('/member')) return null;
  if (pathname.startsWith('/hire/')) return null;
  if (pathname.startsWith('/join/')) return null;
  if (pathname.startsWith('/coach')) return null;
  // Public business websites should not look like an SA app install
  if (pathname.startsWith('/embed')) return null;
  if (typeof window !== 'undefined' && isStandalone()) return null;
  if (!ready) return null;
  if (dismissed) return null;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 z-[500] flex justify-center px-3 lg:hidden"
      style={{
        bottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.75rem)',
      }}
    >
      <div className="pointer-events-auto w-full max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-2xl border border-slate-200 bg-white/95 shadow-[0_18px_40px_-12px_rgba(15,23,42,0.35)] backdrop-blur-sm">
        <div className="flex items-center gap-1.5 px-2 py-2">
          <button
            type="button"
            onClick={() => void installNative()}
            disabled={busy}
            className="sa-btn-brand inline-flex flex-1 items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-black touch-manipulation active:scale-95 disabled:opacity-70"
          >
            {deferred ? (
              <Download className="h-4 w-4" />
            ) : (
              <Smartphone className="h-4 w-4" />
            )}
            {busy
              ? '…'
              : deferred
                ? 'Install app'
                : 'Add to Home Screen'}
          </button>
          <button
            type="button"
            onClick={dismiss}
            className="rounded-full p-2.5 text-slate-400 transition-colors hover:bg-slate-100 touch-manipulation"
            aria-label="Dismiss install banner"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <Link
          href="/add-to-home.html"
          className="block border-t border-slate-200 bg-slate-50/80 px-3 py-2 text-center text-[11px] font-bold text-[#0077b6]"
        >
          Safari/iOS &amp; Android install steps →
        </Link>
      </div>
    </div>
  );
}

export function openInstallHelp() {
  if (typeof window === 'undefined') return;
  window.location.href = '/add-to-home.html';
}
