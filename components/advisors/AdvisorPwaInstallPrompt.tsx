'use client';

import { useCallback, useEffect, useState } from 'react';
import { Download, Share, Smartphone, SquarePlus, X } from 'lucide-react';
import type { AdvisorPwaBrand } from '@/lib/advisors/member-pwa';
import { advisorBrandInk } from '@/lib/advisors/brand-ink';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone)
  );
}

function isIos(): boolean {
  if (typeof navigator === 'undefined') return false;
  return (
    /iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

function isSamsungInternet(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /SamsungBrowser/i.test(navigator.userAgent);
}

function dismissKey(id: string) {
  return `sa_advisor_pwa_install:${id}`;
}

function wasDismissed(id: string): boolean {
  try {
    const raw = localStorage.getItem(dismissKey(id));
    if (!raw) return false;
    const at = Number(raw);
    return Number.isFinite(at) && Date.now() - at < 14 * 864e5;
  } catch {
    return false;
  }
}

function markDismissed(id: string) {
  try {
    localStorage.setItem(dismissKey(id), String(Date.now()));
  } catch {
    /* private mode */
  }
}

function BrandMark({
  brand,
  size = 56,
}: {
  brand: Pick<AdvisorPwaBrand, 'brandName' | 'iconUrl' | 'themeColor'>;
  size?: number;
}) {
  const ink = advisorBrandInk(brand.themeColor);
  return (
    <span
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-2xl shadow-sm"
      style={{
        width: size,
        height: size,
        background: brand.themeColor,
        color: ink,
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={brand.iconUrl}
        alt=""
        className="h-full w-full object-contain p-1"
      />
    </span>
  );
}

/**
 * Install chrome for a company-branded member PWA.
 * `sheet` — first-open on the /pwa launcher.
 * `chip` — compact add-to-home on the live member portal.
 */
export function AdvisorPwaInstallPrompt({
  brand,
  mode = 'sheet',
  autoOpen = true,
}: {
  brand: AdvisorPwaBrand;
  mode?: 'sheet' | 'chip';
  autoOpen?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [chip, setChip] = useState(false);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [busy, setBusy] = useState(false);
  const [ios] = useState(isIos);
  const ink = advisorBrandInk(brand.themeColor);

  useEffect(() => {
    if (typeof window === 'undefined' || isStandalone() || !brand.enabled) return;

    const onBip = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setChip(true);
    };
    window.addEventListener('beforeinstallprompt', onBip);

    const onOpen = () => {
      setOpen(true);
      setChip(true);
    };
    window.addEventListener('sa-open-install', onOpen);

    if ('serviceWorker' in navigator) {
      void navigator.serviceWorker
        .register('/sw.js', { scope: '/', updateViaCache: 'none' })
        .catch(() => {});
    }

    const t = window.setTimeout(() => {
      if (!autoOpen || isStandalone() || wasDismissed(brand.startPath)) return;
      if (mode === 'sheet') setOpen(true);
      else setChip(true);
    }, mode === 'sheet' ? 280 : 900);

    return () => {
      window.clearTimeout(t);
      window.removeEventListener('beforeinstallprompt', onBip);
      window.removeEventListener('sa-open-install', onOpen);
    };
  }, [autoOpen, brand.enabled, brand.startPath, mode]);

  const close = useCallback(() => {
    markDismissed(brand.startPath);
    setOpen(false);
    setChip(false);
  }, [brand.startPath]);

  const install = useCallback(async () => {
    if (ios || !deferred) return;
    setBusy(true);
    try {
      await deferred.prompt();
      const { outcome } = await deferred.userChoice;
      setDeferred(null);
      if (outcome === 'accepted') {
        markDismissed(brand.startPath);
        setOpen(false);
        setChip(false);
      }
    } catch {
      /* user closed the browser sheet */
    } finally {
      setBusy(false);
    }
  }, [brand.startPath, deferred, ios]);

  if (!brand.enabled) return null;
  if (typeof window !== 'undefined' && isStandalone()) return null;

  const sheet = open ? (
    <InstallSheet
      brand={brand}
      ink={ink}
      ios={ios}
      deferred={deferred}
      busy={busy}
      onClose={close}
      onInstall={() => void install()}
    />
  ) : null;

  if (mode === 'chip') {
    if (!chip && !open) return null;
    return (
      <>
        {chip ? (
          <div
            className="fixed z-[500] left-3 right-3 flex justify-center pointer-events-none"
            style={{
              bottom:
                'max(1rem, calc(5.5rem + env(safe-area-inset-bottom, 0px)))',
            }}
          >
            <div className="pointer-events-auto flex max-w-md items-center gap-2 rounded-full border border-slate-200 bg-white/95 p-1 pl-1.5 shadow-2xl shadow-slate-900/20 dark:border-white/15 dark:bg-neutral-900">
              <BrandMark brand={brand} size={36} />
              <button
                type="button"
                onClick={() => {
                  if (ios || !deferred) setOpen(true);
                  else void install();
                }}
                disabled={busy}
                className="inline-flex min-w-0 flex-1 items-center gap-2 rounded-full px-3 py-2 text-left text-sm font-black text-slate-900 disabled:opacity-70 dark:text-white"
              >
                <span className="truncate">
                  Add {brand.shortName} to Home Screen
                </span>
              </button>
              <button
                type="button"
                onClick={close}
                className="rounded-full p-2.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10"
                aria-label="Hide"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        ) : null}
        {sheet}
      </>
    );
  }

  return sheet;
}

function InstallSheet({
  brand,
  ink,
  ios,
  deferred,
  busy,
  onClose,
  onInstall,
}: {
  brand: AdvisorPwaBrand;
  ink: string;
  ios: boolean;
  deferred: BeforeInstallPromptEvent | null;
  busy: boolean;
  onClose: () => void;
  onInstall: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[600] flex items-end justify-center bg-slate-950/55 p-3 sm:items-center"
      style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="advisor-pwa-install-title"
    >
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Close install"
        onClick={onClose}
      />
      <div className="relative z-[1] w-full max-w-md overflow-hidden rounded-[1.75rem] bg-white shadow-2xl dark:bg-neutral-900">
        <div
          className="px-5 pb-5 pt-4"
          style={{ background: brand.themeColor, color: ink }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <BrandMark brand={brand} size={56} />
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] opacity-80">
                  {brand.advisorLabel}
                </p>
                <h2
                  id="advisor-pwa-install-title"
                  className="truncate text-xl font-black tracking-tight"
                >
                  Add {brand.brandName} to your phone
                </h2>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full bg-black/10 p-2"
              aria-label="Not now"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <p className="mt-3 text-sm opacity-90">
            Install once — this is the {brand.brandName} {brand.audienceSingular}{' '}
            app, not a generic SupplierAdvisor icon.
          </p>
          {isSamsungInternet() ? (
            <p className="mt-2 rounded-xl bg-black/10 px-3 py-2 text-xs font-bold">
              On Galaxy phones, install from <span className="underline">Chrome</span>{' '}
              — not Samsung Internet. Samsung can block the install with an
              “older version of Android” warning.
            </p>
          ) : null}
        </div>

        <div className="space-y-3 px-5 py-4">
          {ios ? (
            <ol className="space-y-2.5 text-sm text-slate-700 dark:text-neutral-300">
              <li className="flex gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-white">
                  <Share className="h-4 w-4" />
                </span>
                <span>
                  <span className="font-black text-slate-900 dark:text-white">
                    1 · Share
                  </span>
                  <span className="mt-0.5 block text-[12px] text-slate-500 dark:text-neutral-400">
                    Tap Share in Safari (square with an arrow).
                  </span>
                </span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-white">
                  <SquarePlus className="h-4 w-4" />
                </span>
                <span>
                  <span className="font-black text-slate-900 dark:text-white">
                    2 · Add to Home Screen
                  </span>
                  <span className="mt-0.5 block text-[12px] text-slate-500 dark:text-neutral-400">
                    Tap Add to Home Screen, then Add. The icon is{' '}
                    {brand.shortName}.
                  </span>
                </span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-white">
                  <Smartphone className="h-4 w-4" />
                </span>
                <span>
                  <span className="font-black text-slate-900 dark:text-white">
                    3 · Open {brand.shortName}
                  </span>
                  <span className="mt-0.5 block text-[12px] text-slate-500 dark:text-neutral-400">
                    Use the new home-screen icon next time.
                  </span>
                </span>
              </li>
            </ol>
          ) : (
            <p className="text-sm text-slate-600 dark:text-neutral-300">
              {deferred
                ? `Your browser can install ${brand.brandName} now. You will get a home-screen icon.`
                : `In Chrome, open the menu (⋮) and tap Install app or Add to Home screen.`}
            </p>
          )}

          <div className="flex flex-col gap-2 pt-1">
            {!ios && deferred ? (
              <button
                type="button"
                disabled={busy}
                onClick={onInstall}
                className="inline-flex items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-black disabled:opacity-60"
                style={{ background: brand.themeColor, color: ink }}
              >
                <Download className="h-4 w-4" />
                {busy ? 'Installing…' : `Install ${brand.shortName}`}
              </button>
            ) : null}
            <button
              type="button"
              onClick={onClose}
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
