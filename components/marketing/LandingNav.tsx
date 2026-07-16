'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, Menu, X } from 'lucide-react';
import { usePrivy } from '@privy-io/react-auth';
import { useRouter } from 'next/navigation';

const LINKS = [
  { id: 'markets', label: 'B2B · B2G · B2C' },
  { id: 'why-join', label: 'Why join' },
  { id: 'systems', label: 'Systems' },
  { id: 'trust', label: 'Trust' },
  { id: 'pricing', label: 'Pricing' },
  { id: 'network', label: 'Companies' },
  { id: 'directory', label: 'Directory' },
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
      if (window.innerWidth >= 768) setOpen(false);
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
    // Directory opens the rich company search tab
    if (id === 'directory') {
      if (typeof window !== 'undefined') {
        window.history.replaceState(null, '', '#directory');
        window.dispatchEvent(new HashChangeEvent('hashchange'));
      }
    }
    window.setTimeout(() => {
      const el =
        document.getElementById(id) ||
        (id === 'directory' ? document.getElementById('network') : null);
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
        className="fixed top-0 left-0 right-0 z-[200] w-full border-b border-slate-200/80 bg-white/95"
        style={{
          backgroundColor: scrolled || open ? 'rgba(255,255,255,0.98)' : 'rgba(255,255,255,0.95)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          boxShadow: scrolled || open ? '0 1px 3px 0 rgb(0 0 0 / 0.06)' : 'none',
        }}
      >
        <div className="mx-auto flex h-16 max-w-screen-2xl items-center justify-between gap-3 px-4 sm:h-[4.25rem] sm:px-6 lg:px-10">
          <Link
            href="/"
            className="relative z-[210] flex min-w-0 shrink-0 items-center gap-2 sm:gap-2.5"
            onClick={() => setOpen(false)}
          >
            <Image
              src="/sa-logo.png"
              alt="SupplierAdvisor"
              width={40}
              height={40}
              className="h-9 w-9 rounded-2xl object-contain sm:h-10 sm:w-10"
              priority
            />
            <span className="truncate text-base font-black tracking-tight text-slate-900 sm:text-xl">
              SupplierAdvisor
              <span className="text-[#00b4d8]">®</span>
            </span>
          </Link>

          <nav className="hidden items-center gap-0.5 md:flex" aria-label="Primary">
            {LINKS.map((l) => (
              <button
                key={l.id}
                type="button"
                onClick={() => scrollTo(l.id)}
                className="rounded-full px-2.5 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 hover:text-[#0077b6] lg:px-3.5"
              >
                {l.label}
              </button>
            ))}
          </nav>

          <div className="hidden items-center gap-2 md:flex">
            <button
              type="button"
              onClick={goLogin}
              className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition-all hover:border-[#00b4d8] hover:text-[#0077b6] lg:px-5 lg:py-2.5"
            >
              Log in
            </button>
            <Link
              href="/onboarding?type=business"
              className="inline-flex items-center gap-1.5 rounded-full bg-[#00b4d8] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-[#0099b8] lg:px-5 lg:py-2.5"
            >
              Start free <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <button
            type="button"
            className="relative z-[210] inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-800 touch-manipulation md:hidden"
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
        <div className="fixed inset-0 z-[190] md:hidden" role="dialog" aria-modal="true">
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
          <div className="absolute left-0 right-0 top-16 max-h-[min(80vh,calc(100dvh-4rem))] overflow-y-auto border-b border-slate-200 bg-white shadow-xl sm:top-[4.25rem]">
            <div className="mx-auto flex max-w-screen-2xl flex-col gap-1 px-4 py-4 sm:px-6">
              {LINKS.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => scrollTo(l.id)}
                  className="rounded-2xl px-4 py-3.5 text-left text-base font-semibold text-slate-800 touch-manipulation hover:bg-sky-50 hover:text-[#0077b6]"
                >
                  {l.label}
                </button>
              ))}
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
                  Start free
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="h-16 sm:h-[4.25rem]" aria-hidden />
    </>
  );
}
