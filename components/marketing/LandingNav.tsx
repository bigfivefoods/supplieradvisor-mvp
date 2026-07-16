'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, Menu, X } from 'lucide-react';
import { usePrivy } from '@privy-io/react-auth';
import { useRouter } from 'next/navigation';

const LINKS = [
  { id: 'systems', label: 'Systems' },
  { id: 'modules', label: 'Modules' },
  { id: 'trust', label: 'Trust' },
  { id: 'earn', label: 'Earn' },
  { id: 'network', label: 'Network' },
  { id: 'audiences', label: "Who it's for" },
] as const;

export default function LandingNav() {
  const { user, ready } = usePrivy();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
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

  const solid = scrolled || open;

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-[200] w-full transition-[background,border,box-shadow] duration-300 ${
          solid
            ? 'border-b border-white/10 bg-[#05070b]/95 shadow-[0_1px_0_0_rgba(255,255,255,0.06)]'
            : 'border-b border-transparent bg-transparent'
        }`}
        style={{
          backdropFilter: solid || open ? 'blur(16px)' : 'none',
          WebkitBackdropFilter: solid || open ? 'blur(16px)' : 'none',
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
            <span className="truncate text-base font-black tracking-tight text-white sm:text-xl">
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
                className="rounded-full px-2.5 py-2 text-sm font-medium text-white/70 transition-colors hover:bg-white/5 hover:text-white lg:px-3.5"
              >
                {l.label}
              </button>
            ))}
          </nav>

          <div className="hidden items-center gap-2 md:flex">
            <Link
              href="/pricing"
              className="rounded-full px-3 py-2 text-sm font-medium text-white/70 transition-colors hover:bg-white/5 hover:text-white"
            >
              Pricing
            </Link>
            <button
              type="button"
              onClick={goLogin}
              className="rounded-full border border-white/20 px-4 py-2 text-sm font-semibold text-white transition-all hover:border-white/40 hover:bg-white/5 lg:px-5 lg:py-2.5"
            >
              Log in
            </button>
            <Link
              href="/onboarding?type=business"
              className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-950 shadow-sm transition-all hover:bg-white/90 lg:px-5 lg:py-2.5"
            >
              Start free <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <button
            type="button"
            className="relative z-[210] inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/15 bg-white/5 text-white touch-manipulation md:hidden"
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
            className="absolute inset-0 bg-black/60"
            style={{ backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }}
            onClick={() => setOpen(false)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') setOpen(false);
            }}
            role="button"
            tabIndex={0}
            aria-label="Close menu"
          />
          <div className="absolute left-0 right-0 top-16 max-h-[min(80vh,calc(100dvh-4rem))] overflow-y-auto border-b border-white/10 bg-[#0a0d14] shadow-xl sm:top-[4.25rem]">
            <div className="mx-auto flex max-w-screen-2xl flex-col gap-1 px-4 py-4 sm:px-6">
              {LINKS.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => scrollTo(l.id)}
                  className="rounded-2xl px-4 py-3.5 text-left text-base font-semibold text-white touch-manipulation hover:bg-white/5"
                >
                  {l.label}
                </button>
              ))}
              <Link
                href="/pricing"
                onClick={() => setOpen(false)}
                className="rounded-2xl px-4 py-3.5 text-left text-base font-semibold text-white touch-manipulation hover:bg-white/5"
              >
                Pricing
              </Link>
              <div className="mt-1 grid grid-cols-2 gap-2 border-t border-white/10 pt-3">
                <button
                  type="button"
                  onClick={goLogin}
                  className="rounded-2xl border border-white/15 py-3.5 font-semibold text-white touch-manipulation"
                >
                  Log in
                </button>
                <Link
                  href="/onboarding?type=business"
                  onClick={() => setOpen(false)}
                  className="rounded-2xl bg-white py-3.5 text-center font-semibold text-slate-950 touch-manipulation"
                >
                  Start free
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* No spacer — hero is full-bleed under transparent nav */}
    </>
  );
}
