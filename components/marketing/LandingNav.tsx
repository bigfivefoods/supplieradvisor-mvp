'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, ChevronDown, Menu, X } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import LanguageSwitcher from '@/components/i18n/LanguageSwitcher';
import { useLocaleDictionary } from '@/components/i18n/LocaleDictionaryProvider';
import { localizedPath, stripLocale } from '@/lib/i18n/config';
import AppearanceToggle from '@/components/theme/AppearanceToggle';
import { useTheme } from '@/components/theme/ThemeProvider';
import { legacyHomeAnchorTarget } from '@/lib/marketing/legacy-home-anchors';

type NavLink = {
  id: string;
  labelKey:
    | 'nav.product'
    | 'nav.modules'
    | 'nav.industries'
    | 'nav.pricing'
    | 'nav.roi'
    | 'nav.member'
    | 'nav.why'
    | 'nav.howFits'
    | 'nav.trust'
    | 'nav.catalogues';
  href: string;
};

const PRIMARY_LINKS: NavLink[] = [
  { id: 'product', labelKey: 'nav.product', href: '/product' },
  { id: 'modules', labelKey: 'nav.modules', href: '/modules' },
  { id: 'industries', labelKey: 'nav.industries', href: '/industries' },
  { id: 'pricing', labelKey: 'nav.pricing', href: '/pricing' },
  { id: 'roi', labelKey: 'nav.roi', href: '/roi' },
];

const MORE_LINKS: NavLink[] = [
  { id: 'member', labelKey: 'nav.member', href: '/sa-member' },
  { id: 'why', labelKey: 'nav.why', href: '/why-supplieradvisor' },
  { id: 'how', labelKey: 'nav.howFits', href: '/how-it-fits' },
  { id: 'trust', labelKey: 'nav.trust', href: '/trust' },
  { id: 'catalogues', labelKey: 'nav.catalogues', href: '/catalogues' },
];

function linkClass(active: boolean) {
  return [
    'inline-flex shrink-0 items-center rounded-full px-2.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap',
    active
      ? 'bg-[#00b4d8]/12 text-[#0077b6] dark:bg-cyan-500/15 dark:text-cyan-300'
      : 'text-slate-600 hover:bg-slate-50 hover:text-[#0077b6] dark:text-slate-300 dark:hover:bg-white/5 dark:hover:text-cyan-300',
  ].join(' ');
}

function mobileLinkClass(active: boolean) {
  return [
    'rounded-2xl px-4 py-3.5 text-left text-base font-semibold touch-manipulation transition-colors',
    active
      ? 'bg-sky-50 text-[#0077b6] dark:bg-cyan-500/15 dark:text-cyan-300'
      : 'text-slate-800 hover:bg-sky-50 hover:text-[#0077b6] dark:text-slate-100 dark:hover:bg-white/5',
  ].join(' ');
}

export default function LandingNav({ demoHref: _demoHref }: { demoHref: string }) {
  void _demoHref;
  const router = useRouter();
  const pathname = usePathname() || '/';
  const { locale, t } = useLocaleDictionary();
  const { resolved } = useTheme();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  const plainPath = stripLocale(pathname).pathname;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const hash = window.location.hash.replace(/^#/, '');
    if (!hash) return;
    const target = legacyHomeAnchorTarget(hash, locale);
    if (!target) return;
    const current = `${window.location.pathname}${window.location.search}`;
    if (current === target) return;
    router.replace(target);
  }, [locale, pathname, router]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth >= 1024) setOpen(false);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const hrefFor = useMemo(
    () =>
      (href: string) => {
        if (href === '/' || href === '/pricing') return localizedPath(locale, href);
        return href;
      },
    [locale]
  );

  const isActive = (href: string) => plainPath === href;

  const goLogin = () => {
    setOpen(false);
    router.push('/login');
  };

  const goMember = () => {
    setOpen(false);
    router.push('/me');
  };

  return (
    <>
      <header
        data-landing-nav
        className="fixed top-0 left-0 right-0 z-[310] w-full overflow-x-clip border-b border-slate-200/80 bg-white/95 pt-safe dark:border-neutral-800 dark:bg-black/95"
        style={{
          backgroundColor:
            resolved === 'dark'
              ? scrolled || open
                ? 'rgba(0,0,0,0.98)'
                : 'rgba(0,0,0,0.94)'
              : scrolled || open
                ? 'rgba(255,255,255,0.98)'
                : 'rgba(255,255,255,0.95)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          boxShadow:
            scrolled || open
              ? resolved === 'dark'
                ? '0 1px 3px 0 rgb(0 0 0 / 0.55)'
                : '0 1px 3px 0 rgb(0 0 0 / 0.06)'
              : 'none',
        }}
      >
        <div className="mx-auto flex h-[var(--sa-nav-h)] min-w-0 max-w-screen-2xl items-center justify-between gap-2 overflow-x-clip px-3 sm:gap-3 sm:px-6 lg:px-10">
          <Link href={localizedPath(locale, '/')} className="relative z-[320] flex min-w-0 shrink-0 items-center gap-2 sm:gap-2.5">
            <Image src="/sa-logo.png" alt="" width={72} height={32} className="sa-logo h-7 w-[3.9375rem] object-contain shrink-0 sm:h-8 sm:w-[4.5rem]" priority />
            <span className="sa-wordmark hidden text-sm font-black tracking-tight sm:inline sm:text-base md:text-xl">
              SupplierAdvisor
              <span className="sa-wordmark-mark">®</span>
            </span>
          </Link>

          <nav className="hidden min-w-0 flex-1 items-center gap-0.5 overflow-visible lg:flex" aria-label={t('nav.ariaPrimary')}>
            {PRIMARY_LINKS.map((l) => (
              <Link key={l.id} href={hrefFor(l.href)} hrefLang={l.href === '/pricing' ? locale : 'en'} className={linkClass(isActive(l.href))} data-top-nav-item={l.id}>
                {t(l.labelKey)}
              </Link>
            ))}
            <div className="relative">
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-full px-2.5 py-2 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50 hover:text-[#0077b6] dark:text-slate-300 dark:hover:bg-white/5 dark:hover:text-cyan-300"
                aria-haspopup="menu"
                aria-expanded={moreOpen}
                aria-label={moreOpen ? t('nav.ariaCloseMore') : t('nav.ariaOpenMore')}
                data-top-nav-item="more"
                onClick={() => setMoreOpen((v) => !v)}
              >
                {t('nav.more')}
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
              {moreOpen ? (
                <div data-top-nav-more-menu className="absolute start-0 z-[360] mt-2 w-56 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl dark:border-neutral-700 dark:bg-neutral-900" role="menu" aria-label={t('nav.ariaMoreMenu')}>
                  <div className="space-y-0.5">
                    {MORE_LINKS.map((l) => (
                      <Link
                        key={`more-${l.id}`}
                        href={hrefFor(l.href)}
                        hrefLang="en"
                        role="menuitem"
                        className="flex min-h-10 items-center rounded-xl px-2.5 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-neutral-800"
                        onClick={() => setMoreOpen(false)}
                      >
                        {t(l.labelKey)}
                      </Link>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </nav>

          <div className="hidden shrink-0 items-center gap-2 lg:flex">
            <AppearanceToggle />
            <LanguageSwitcher compact />
            <button type="button" onClick={goLogin} className="hidden min-h-[40px] rounded-full border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition-all hover:border-[#00b4d8] hover:text-[#0077b6] xl:inline-flex xl:px-5 xl:py-2.5 dark:border-slate-700 dark:text-slate-200" data-top-nav-item="login-cta">
              {t('nav.logIn')}
            </button>
            <Link href="/join" className="hidden min-h-[40px] items-center gap-1.5 rounded-full bg-[#00b4d8] px-3 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-[#0099b8] xl:inline-flex xl:px-5 xl:py-2.5" data-top-nav-item="trial-cta">
              {t('nav.startTrial')}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="hidden md:flex lg:hidden items-center gap-1.5 shrink-0">
            <AppearanceToggle />
            <LanguageSwitcher />
            <button type="button" onClick={goMember} className="rounded-full px-2.5 py-2 text-xs font-semibold text-slate-600 min-h-[40px] dark:text-slate-300">
              {t('nav.member')}
            </button>
            <button type="button" onClick={goLogin} className="rounded-full border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 min-h-[40px] dark:border-slate-700 dark:text-slate-200">
              {t('nav.logIn')}
            </button>
            <Link href="/join" className="inline-flex items-center gap-1 rounded-full bg-[#00b4d8] px-3 py-2 text-xs font-semibold text-white min-h-[40px]">
              {t('nav.freeTrial')}
            </Link>
          </div>

          <div className="flex shrink-0 items-center gap-1.5 lg:hidden">
            <Link href="/login" data-landing-login className="md:hidden inline-flex min-h-[40px] items-center rounded-full border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 touch-manipulation dark:border-slate-700 dark:text-slate-200">
              {t('nav.logIn')}
            </Link>
            <LanguageSwitcher />
            <button
              type="button"
              className="relative z-[320] inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-800 touch-manipulation dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              aria-label={open ? t('nav.ariaCloseMenu') : t('nav.ariaOpenMenu')}
              aria-expanded={open}
              onClick={(e) => {
                e.stopPropagation();
                setOpen((v) => !v);
              }}
            >
              {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </header>

      {open && (
        <div className="fixed inset-0 z-[300] lg:hidden" role="dialog" aria-modal="true" aria-label={t('nav.ariaSiteMenu')}>
          <div
            className="absolute inset-0 bg-slate-900/40 dark:bg-black/70"
            style={{
              backdropFilter: 'blur(2px)',
              WebkitBackdropFilter: 'blur(2px)',
            }}
            onClick={() => setOpen(false)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') setOpen(false);
            }}
            role="button"
            tabIndex={0}
            aria-label={t('nav.ariaCloseOverlay')}
          />
          <div className="absolute left-0 right-0 top-nav-offset max-h-[min(80vh,calc(100dvh-var(--sa-nav-offset)))] overflow-y-auto border-b border-slate-200 bg-white shadow-xl pb-safe dark:border-neutral-800 dark:bg-neutral-950">
            <div className="mx-auto flex max-w-screen-2xl flex-col gap-4 px-4 py-4 sm:px-6">
              <div>
                <p className="px-4 pb-1 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">{t('nav.groupProduct')}</p>
                <div className="flex flex-col gap-0.5">
                  {PRIMARY_LINKS.map((l) => (
                    <Link
                      key={l.id}
                      href={hrefFor(l.href)}
                      className={mobileLinkClass(isActive(l.href))}
                      onClick={() => setOpen(false)}
                    >
                      {t(l.labelKey)}
                    </Link>
                  ))}
                </div>
              </div>
              <div>
                <p className="px-4 pb-1 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">{t('nav.more')}</p>
                <div className="flex flex-col gap-0.5">
                  {MORE_LINKS.map((l) => (
                    <Link
                      key={l.id}
                      href={hrefFor(l.href)}
                      className={mobileLinkClass(isActive(l.href))}
                      onClick={() => setOpen(false)}
                    >
                      {t(l.labelKey)}
                    </Link>
                  ))}
                </div>
              </div>

              <div className="border-t border-slate-100 pt-3 dark:border-neutral-800">
                <p className="px-1 pb-2 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
                  {t('nav.appearance')}
                </p>
                <AppearanceToggle />
                <div className="mt-2">
                  <LanguageSwitcher variant="list" onNavigate={() => setOpen(false)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Link href="/login" onClick={() => setOpen(false)} className="inline-flex items-center justify-center rounded-2xl border border-slate-200 py-3.5 font-semibold text-slate-700 touch-manipulation dark:border-neutral-700 dark:text-slate-200">
                  {t('nav.logIn')}
                </Link>
                <Link href="/join" onClick={() => setOpen(false)} className="inline-flex items-center justify-center gap-1.5 rounded-2xl bg-[#00b4d8] py-3.5 text-center font-semibold text-white touch-manipulation">
                  {t('nav.startTrial')}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
              <Link href="/me" onClick={() => setOpen(false)} className="inline-flex items-center justify-center rounded-2xl border border-sky-200 bg-sky-50 py-3.5 text-center font-semibold text-[#0077b6] touch-manipulation dark:border-sky-900 dark:bg-sky-950/40 dark:text-cyan-300">
                {t('nav.memberCreate')}
              </Link>
            </div>
          </div>
        </div>
      )}

      <div className="h-nav-offset" aria-hidden />
    </>
  );
}
