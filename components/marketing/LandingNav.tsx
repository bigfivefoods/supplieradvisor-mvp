'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, Menu, X } from 'lucide-react';
import { usePrivy } from '@privy-io/react-auth';
import { useRouter } from 'next/navigation';

const LINKS = [
  { id: 'compare', label: 'Compare' },
  { id: 'roi', label: 'ROI' },
  { id: 'modules', label: 'Modules' },
  { id: 'pricing', label: 'Pricing' },
  { id: 'industries', label: 'Industries', href: '/industries' as const },
  { id: 'demo', label: 'Demo', href: '/demo' as const },
  { id: 'network', label: 'Companies' },
  /** SEO directory — full page, not just in-page hash */
  { id: 'directory', label: 'Directory', href: '/directory' as const },
] as const;



export default function LandingNav() {
  const { user, ready } = usePrivy();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

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

  const scrollTo = (id: string) => {
    setOpen(false);
    window.setTimeout(() => {
      const el = document.getElementById(id);
      if (!el) return;
      const y = el.getBoundingClientRect().top + window.scrollY - 72;
      window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
    }, 50);
  };

  const goLogin = () => {
    setOpen(false);
    if (ready && user) router.push('/dashboard/select-company');
    else router.push('/login?next=/dashboard/select-company');
  };

  return (
    <>
      <header
        className="fixed top-0 left-0 right-0 z-[200] w-full border-b border-slate-200/80 bg-white/95 pt-safe"
        style={{
          backgroundColor: scrolled || open ? 'rgba(255,255,255,0.98)' : 'rgba(255,255,255,0.95)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          boxShadow: scrolled || open ? '0 1px 3px 0 rgb(0 0 0 / 0.06)' : 'none',
        }}
      >
        <div className="mx-auto flex h-14 sm:h-[4.25rem] max-w-screen-2xl items-center justify-between gap-2 sm:gap-3 px-3 sm:px-6 lg:px-10">
          <Link
            href="/"
            className="relative z-[210] flex min-w-0 shrink-0 items-center gap-1.5 sm:gap-2.5"
            onClick={() => setOpen(false)}
          >
            <Image
              src="/sa-logo.png"
              alt="SupplierAdvisor"
              width={40}
              height={40}
              className="h-8 w-8 sm:h-9 sm:w-9 md:h-10 md:w-10 rounded-2xl object-contain"
              priority
            />
            <span className="truncate text-sm sm:text-base font-black tracking-tight text-slate-900 sm:text-xl max-w-[9.5rem] min-[400px]:max-w-none">
              SupplierAdvisor
              <span className="text-[#00b4d8]">®</span>
            </span>
          </Link>

          <nav
            className="hidden items-center gap-0.5 lg:flex min-w-0 overflow-x-auto scrollbar-none max-w-[46vw] xl:max-w-none"
            aria-label="Primary"
          >
            {LINKS.map((l) =>
              'href' in l && l.href ? (
                <Link
                  key={l.id}
                  href={l.href}
                  className="rounded-full px-2 py-2 text-xs xl:text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 hover:text-[#0077b6] xl:px-3.5 whitespace-nowrap"
                >
                  {l.label}
                </Link>
              ) : (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => scrollTo(l.id)}
                  className="rounded-full px-2 py-2 text-xs xl:text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 hover:text-[#0077b6] xl:px-3.5 whitespace-nowrap"
                >
                  {l.label}
                </button>
              )
            )}
          </nav>

          <div className="hidden items-center gap-2 lg:flex shrink-0">
            <button
              type="button"
              onClick={goLogin}
              className="rounded-full border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition-all hover:border-[#00b4d8] hover:text-[#0077b6] lg:px-5 lg:py-2.5 min-h-[40px]"
            >
              Log in
            </button>
            <Link
              href="/onboarding?type=business"
              className="inline-flex items-center gap-1.5 rounded-full bg-[#00b4d8] px-3 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-[#0099b8] lg:px-5 lg:py-2.5 min-h-[40px]"
            >
              Start free trial
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          {/* Compact login on tablet when hamburger is showing */}
          <div className="hidden md:flex lg:hidden items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={goLogin}
              className="rounded-full border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 min-h-[40px]"
            >
              Log in
            </button>
          </div>

          <button
            type="button"
            className="relative z-[210] inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-800 touch-manipulation lg:hidden"
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
      </header>

      {open && (
        <div className="fixed inset-0 z-[190] lg:hidden" role="dialog" aria-modal="true">
          <div
            className="absolute inset-0 bg-slate-900/40"
            style={{ backdropFilter: 'blur(2px)', WebkitBackdropFilter: 'blur(2px)' }}
            onClick={() => setOpen(false)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') setOpen(false);
            }}
            role="button"
            tabIndex={0}
            aria-label="Close menu"
          />
          <div className="absolute left-0 right-0 top-14 sm:top-[4.25rem] max-h-[min(80vh,calc(100dvh-4rem))] overflow-y-auto border-b border-slate-200 bg-white shadow-xl pb-safe">
            <div className="mx-auto flex max-w-screen-2xl flex-col gap-1 px-4 py-4 sm:px-6">
              {LINKS.map((l) =>
                'href' in l && l.href ? (
                  <Link
                    key={l.id}
                    href={l.href}
                    onClick={() => setOpen(false)}
                    className="rounded-2xl px-4 py-3.5 text-left text-base font-semibold text-slate-800 touch-manipulation hover:bg-sky-50 hover:text-[#0077b6]"
                  >
                    {l.label}
                  </Link>
                ) : (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => scrollTo(l.id)}
                    className="rounded-2xl px-4 py-3.5 text-left text-base font-semibold text-slate-800 touch-manipulation hover:bg-sky-50 hover:text-[#0077b6]"
                  >
                    {l.label}
                  </button>
                )
              )}
              <div className="mt-1 grid grid-cols-2 gap-2 border-t border-slate-100 pt-3">
                <button
                  type="button"
                  onClick={goLogin}
                  className="rounded-2xl border border-slate-200 py-3.5 font-semibold text-slate-700 touch-manipulation"
                >
                  Log in
                </button>
                <Link
                  href="/onboarding?type=business"
                  onClick={() => setOpen(false)}
                  className="rounded-2xl bg-[#00b4d8] py-3.5 text-center font-semibold text-white touch-manipulation"
                >
                  Start free trial
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="h-14 sm:h-[4.25rem]" aria-hidden />
    </>
  );
}
