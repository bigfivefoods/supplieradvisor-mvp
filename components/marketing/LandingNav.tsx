'use client';

import {
  useCallback,
  useEffect,
  useState,
  type MouseEvent,
} from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, Menu, X } from 'lucide-react';
import { usePrivy } from '@privy-io/react-auth';
import { usePathname, useRouter } from 'next/navigation';
import ThemeToggle from '@/components/theme/ThemeToggle';
import { useTheme } from '@/components/theme/ThemeProvider';

/**
 * Primary story: Why → Product → How you buy → Price → See it.
 * Section links use /#id so they work from /industries, /demo, etc.
 */
type NavLink = {
  id: string;
  label: string;
  /** Home landing section id */
  section?: string;
  /** Absolute path or /#section */
  href: string;
  group: 'product' | 'pricing' | 'try';
};

const LINKS: NavLink[] = [
  {
    id: 'why',
    label: 'Why SA',
    section: 'why-join',
    href: '/#why-join',
    group: 'product',
  },
  {
    id: 'product',
    label: 'Product',
    section: 'modules',
    href: '/#modules',
    group: 'product',
  },
  {
    id: 'member',
    label: 'SA Member',
    section: 'member-app',
    href: '/#member-app',
    group: 'product',
  },
  {
    id: 'how',
    label: 'How it fits',
    section: 'packaging',
    href: '/#packaging',
    group: 'product',
  },
  {
    id: 'pricing',
    label: 'Pricing',
    section: 'pricing',
    href: '/#pricing',
    group: 'pricing',
  },
  {
    id: 'roi',
    label: 'ROI',
    section: 'roi',
    href: '/#roi',
    group: 'pricing',
  },
  {
    id: 'industries',
    label: 'Industries',
    href: '/industries',
    group: 'product',
  },
  { id: 'demo', label: 'Demo', href: '/demo', group: 'try' },
];

const SPY_SECTIONS = [
  'why-join',
  'modules',
  'member-app',
  'packaging',
  'pricing',
  'roi',
] as const;

const GROUP_LABELS: Record<NavLink['group'], string> = {
  product: 'Product',
  pricing: 'Pricing',
  try: 'Try it',
};

const NAV_OFFSET = 72;

function linkClass(active: boolean) {
  return [
    'rounded-full px-2.5 py-2 text-xs xl:text-sm font-semibold transition-colors xl:px-3.5 whitespace-nowrap',
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

function scrollToSection(id: string) {
  const el = document.getElementById(id);
  if (!el) return false;
  const y = el.getBoundingClientRect().top + window.scrollY - NAV_OFFSET;
  window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
  return true;
}

export default function LandingNav() {
  const { user, ready } = usePrivy();
  const router = useRouter();
  const pathname = usePathname() || '/';
  const { resolved } = useTheme();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState<string | null>(null);

  const onHome = pathname === '/';

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  /** After navigation to /#section (from industries, demo, etc.) */
  const scrollToHashIfPresent = useCallback(() => {
    if (typeof window === 'undefined') return;
    if (window.location.pathname !== '/') return;
    const hash = window.location.hash.replace(/^#/, '');
    if (!hash) return;
    // Retry: home content may still be mounting
    let tries = 0;
    const tick = () => {
      tries += 1;
      if (scrollToSection(hash)) {
        setActiveSection(hash);
        return;
      }
      if (tries < 20) window.setTimeout(tick, 50);
    };
    window.setTimeout(tick, 40);
  }, []);

  useEffect(() => {
    scrollToHashIfPresent();
  }, [pathname, scrollToHashIfPresent]);

  useEffect(() => {
    const onHash = () => scrollToHashIfPresent();
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, [scrollToHashIfPresent]);

  /** Scroll-spy on home only */
  useEffect(() => {
    if (!onHome) {
      setActiveSection(null);
      return;
    }
    const nodes = SPY_SECTIONS.map((id) => document.getElementById(id)).filter(
      (el): el is HTMLElement => Boolean(el)
    );
    if (!nodes.length) return;

    const OFFSET = 96;
    const update = () => {
      let current: string | null = null;
      for (const el of nodes) {
        if (el.getBoundingClientRect().top - OFFSET <= 0) {
          current = el.id;
        }
      }
      if (window.scrollY < 120) current = null;
      setActiveSection(current);
    };

    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update, { passive: true });
    return () => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [onHome]);

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

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  /**
   * Section nav: smooth-scroll on home; full assign off-home so hash always lands.
   * Next.js client router often drops or ignores hash-only navigations.
   */
  const handleSectionClick = (e: MouseEvent, section: string) => {
    setOpen(false);
    if (onHome) {
      e.preventDefault();
      scrollToSection(section);
      setActiveSection(section);
      // Keep URL in sync without full reload
      window.history.replaceState(null, '', `/#${section}`);
      return;
    }
    e.preventDefault();
    window.location.assign(`/#${section}`);
  };

  const goLogin = () => {
    setOpen(false);
    // Let /login route: personal → /me, operator → select-company
    router.push('/login');
  };

  const goMember = () => {
    setOpen(false);
    if (ready && user) router.push('/me');
    else router.push('/me');
  };

  const isActive = (l: NavLink) =>
    Boolean(l.section && onHome && activeSection === l.section);

  const renderLink = (l: NavLink, mobile: boolean) => {
    const active = isActive(l);
    const cls = mobile ? mobileLinkClass(active) : linkClass(active);
    const isSection = Boolean(l.section);

    return (
      <Link
        key={l.id}
        href={l.href}
        className={cls}
        aria-current={active ? 'true' : undefined}
        onClick={(e) => {
          if (isSection && l.section) {
            handleSectionClick(e, l.section);
            return;
          }
          setOpen(false);
        }}
      >
        {l.label}
      </Link>
    );
  };

  return (
    <>
      <header
        className="fixed top-0 left-0 right-0 z-[200] w-full border-b border-slate-200/80 bg-white/95 pt-safe dark:border-neutral-800 dark:bg-black/95"
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
        <div className="mx-auto flex h-14 sm:h-[4.25rem] max-w-screen-2xl items-center justify-between gap-2 sm:gap-3 px-3 sm:px-6 lg:px-10">
          <Link
            href="/"
            className="relative z-[210] flex shrink-0 items-center gap-2 sm:gap-2.5"
            onClick={() => setOpen(false)}
          >
            <Image
              src="/sa-logo.png"
              alt=""
              width={72}
              height={32}
              className="sa-logo h-7 w-auto sm:h-8 object-contain shrink-0"
              priority
            />
            <span className="sa-wordmark text-sm font-black tracking-tight sm:text-base md:text-xl">
              SupplierAdvisor
              <span className="sa-wordmark-mark">®</span>
            </span>
          </Link>

          <nav
            className="hidden items-center gap-0.5 lg:flex min-w-0"
            aria-label="Primary"
          >
            {LINKS.map((l) => renderLink(l, false))}
          </nav>

          <div className="hidden items-center gap-2 lg:flex shrink-0">
            <ThemeToggle />
            <button
              type="button"
              onClick={goMember}
              className="rounded-full px-3 py-2 text-sm font-semibold text-slate-600 transition-all hover:text-[#0077b6] lg:px-3.5 lg:py-2.5 min-h-[40px] dark:text-slate-300 dark:hover:text-cyan-300"
            >
              SA Member
            </button>
            <button
              type="button"
              onClick={goLogin}
              className="rounded-full border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition-all hover:border-[#00b4d8] hover:text-[#0077b6] lg:px-5 lg:py-2.5 min-h-[40px] dark:border-slate-700 dark:text-slate-200"
            >
              Log in
            </button>
            <Link
              href="/join"
              className="inline-flex items-center gap-1.5 rounded-full bg-[#00b4d8] px-3 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-[#0099b8] lg:px-5 lg:py-2.5 min-h-[40px]"
            >
              Start free trial
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="hidden md:flex lg:hidden items-center gap-1.5 shrink-0">
            <ThemeToggle />
            <button
              type="button"
              onClick={goMember}
              className="rounded-full px-2.5 py-2 text-xs font-semibold text-slate-600 min-h-[40px] dark:text-slate-300"
            >
              SA Member
            </button>
            <button
              type="button"
              onClick={goLogin}
              className="rounded-full border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 min-h-[40px] dark:border-slate-700 dark:text-slate-200"
            >
              Log in
            </button>
            <Link
              href="/join"
              className="inline-flex items-center gap-1 rounded-full bg-[#00b4d8] px-3 py-2 text-xs font-semibold text-white min-h-[40px]"
            >
              Free trial
            </Link>
          </div>

          <div className="flex items-center gap-1.5 lg:hidden shrink-0">
            <Link
              href="/join"
              className="md:hidden inline-flex items-center rounded-full bg-[#00b4d8] px-2.5 py-2 text-[11px] font-bold text-white min-h-[40px]"
            >
              Free trial
            </Link>
            <ThemeToggle className="md:hidden" />
            <button
              type="button"
              className="relative z-[210] inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-800 touch-manipulation dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              aria-label={open ? 'Close menu' : 'Open menu'}
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
        <div
          className="fixed inset-0 z-[190] lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Site menu"
        >
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
            aria-label="Close menu"
          />
          <div className="absolute left-0 right-0 top-14 sm:top-[4.25rem] max-h-[min(80vh,calc(100dvh-4rem))] overflow-y-auto border-b border-slate-200 bg-white shadow-xl pb-safe dark:border-neutral-800 dark:bg-neutral-950">
            <div className="mx-auto flex max-w-screen-2xl flex-col gap-4 px-4 py-4 sm:px-6">
              {(['product', 'pricing', 'try'] as const).map((group) => {
                const items = LINKS.filter((l) => l.group === group);
                if (!items.length) return null;
                return (
                  <div key={group}>
                    <p className="px-4 pb-1 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
                      {GROUP_LABELS[group]}
                    </p>
                    <div className="flex flex-col gap-0.5">
                      {items.map((l) => renderLink(l, true))}
                    </div>
                  </div>
                );
              })}

              <div className="grid grid-cols-2 gap-2 border-t border-slate-100 pt-3 dark:border-neutral-800">
                <button
                  type="button"
                  onClick={goLogin}
                  className="rounded-2xl border border-slate-200 py-3.5 font-semibold text-slate-700 touch-manipulation dark:border-neutral-700 dark:text-slate-200"
                >
                  Log in
                </button>
                <Link
                  href="/join"
                  onClick={() => setOpen(false)}
                  className="inline-flex items-center justify-center gap-1.5 rounded-2xl bg-[#00b4d8] py-3.5 text-center font-semibold text-white touch-manipulation"
                >
                  Start free trial
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
              <Link
                href="/me"
                onClick={() => setOpen(false)}
                className="inline-flex items-center justify-center rounded-2xl border border-sky-200 bg-sky-50 py-3.5 text-center font-semibold text-[#0077b6] touch-manipulation dark:border-sky-900 dark:bg-sky-950/40 dark:text-cyan-300"
              >
                Create free SA Member account
              </Link>
            </div>
          </div>
        </div>
      )}

      <div className="h-14 sm:h-[4.25rem]" aria-hidden />
    </>
  );
}
