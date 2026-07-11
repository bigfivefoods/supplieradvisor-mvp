'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, Menu, X } from 'lucide-react';
import { usePrivy } from '@privy-io/react-auth';
import { useRouter } from 'next/navigation';

const LINKS = [
  { id: 'platform', label: 'Platform' },
  { id: 'modules', label: 'Modules' },
  { id: 'how-it-works', label: 'How it works' },
  { id: 'verified', label: 'Network' },
  { id: 'audiences', label: 'Who it\'s for' },
] as const;

export default function LandingNav() {
  const { user, ready } = usePrivy();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  const scrollTo = (id: string) => {
    setOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  const goLogin = () => {
    setOpen(false);
    if (ready && user) router.push('/dashboard/select-company');
    else router.push('/login?next=/dashboard/select-company');
  };

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled || open
            ? 'bg-white/90 backdrop-blur-xl border-b border-slate-200/80 shadow-sm'
            : 'bg-white/70 backdrop-blur-md border-b border-transparent'
        }`}
      >
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-10 h-16 sm:h-[4.25rem] flex items-center justify-between gap-3">
          <Link href="/" className="flex items-center gap-2.5 min-w-0 shrink-0">
            <Image
              src="/sa-logo.png"
              alt="SupplierAdvisor"
              width={40}
              height={40}
              className="rounded-2xl object-contain w-9 h-9 sm:w-10 sm:h-10"
              priority
            />
            <span className="text-lg sm:text-xl font-black tracking-[-0.04em] text-slate-900 truncate">
              SupplierAdvisor<span className="text-[#00b4d8]">®</span>
            </span>
          </Link>

          <nav className="hidden lg:flex items-center gap-1">
            {LINKS.map((l) => (
              <button
                key={l.id}
                type="button"
                onClick={() => scrollTo(l.id)}
                className="px-3.5 py-2 text-sm font-semibold text-slate-600 hover:text-[#0077b6] rounded-full hover:bg-slate-50 transition-colors"
              >
                {l.label}
              </button>
            ))}
          </nav>

          <div className="hidden lg:flex items-center gap-2.5">
            <button
              type="button"
              onClick={goLogin}
              className="px-5 py-2.5 text-sm font-semibold text-slate-700 border border-slate-200 rounded-full hover:border-[#00b4d8] hover:text-[#0077b6] transition-all"
            >
              Log in
            </button>
            <Link
              href="/onboarding?type=business"
              className="inline-flex items-center gap-1.5 px-5 py-2.5 text-sm font-semibold text-white bg-[#00b4d8] hover:bg-[#0099b8] rounded-full transition-all shadow-sm"
            >
              Join free <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <button
            type="button"
            className="lg:hidden w-11 h-11 inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-800 touch-manipulation"
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* Mobile drawer */}
      <div
        className={`fixed inset-0 z-40 lg:hidden transition-opacity duration-300 ${
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      >
        <button
          type="button"
          className="absolute inset-0 bg-slate-900/30 backdrop-blur-[2px]"
          aria-label="Close menu overlay"
          onClick={() => setOpen(false)}
        />
        <div
          className={`absolute top-16 sm:top-[4.25rem] left-0 right-0 bg-white border-b border-slate-200 shadow-xl transition-transform duration-300 ${
            open ? 'translate-y-0' : '-translate-y-3'
          }`}
        >
          <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-4 flex flex-col gap-1">
            {LINKS.map((l) => (
              <button
                key={l.id}
                type="button"
                onClick={() => scrollTo(l.id)}
                className="text-left px-4 py-3.5 rounded-2xl text-base font-semibold text-slate-800 hover:bg-sky-50 hover:text-[#0077b6] transition-colors touch-manipulation"
              >
                {l.label}
              </button>
            ))}
            <div className="grid grid-cols-2 gap-2 pt-3 mt-1 border-t border-slate-100">
              <button
                type="button"
                onClick={goLogin}
                className="py-3.5 rounded-2xl border border-slate-200 font-semibold text-slate-700 touch-manipulation"
              >
                Log in
              </button>
              <Link
                href="/onboarding?type=business"
                onClick={() => setOpen(false)}
                className="py-3.5 rounded-2xl bg-[#00b4d8] text-white font-semibold text-center touch-manipulation"
              >
                Join free
              </Link>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
