'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { usePrivy } from '@privy-io/react-auth';
import { useEffect } from 'react';
import { LayoutDashboard, LogOut, Loader2, GraduationCap } from 'lucide-react';
import { extractEmailFromPrivyUser } from '@/lib/auth/identity';

export default function ContractorLayout({ children }: { children: React.ReactNode }) {
  const { ready, authenticated, logout, user } = usePrivy();
  const pathname = usePathname();
  const router = useRouter();
  const isInvite = pathname?.startsWith('/contractor/invite');
  const email = extractEmailFromPrivyUser(user);

  useEffect(() => {
    if (!ready || isInvite) return;
    if (!authenticated) {
      router.replace(`/login?next=${encodeURIComponent(pathname || '/contractor')}`);
    }
  }, [ready, authenticated, isInvite, router, pathname]);

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8fafc]">
        <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
      </div>
    );
  }

  if (isInvite) {
    return <>{children}</>;
  }

  if (!authenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8fafc]">
        <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      <header className="bg-white/95 backdrop-blur-xl border-b border-neutral-200 sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <Link href="/contractor" className="flex items-center gap-2 min-w-0 touch-manipulation">
            <Image src="/sa-logo.png" alt="SA" width={36} height={36} className="rounded-xl flex-shrink-0" />
            <div className="min-w-0">
              <div className="font-black text-sm tracking-tight text-slate-900">Operator portal</div>
              <div className="text-[10px] text-neutral-500 truncate">
                {email || 'SupplierAdvisor®'}
              </div>
            </div>
          </Link>
          <nav className="hidden sm:flex items-center gap-1 sm:gap-2 flex-shrink-0">
            <Link
              href="/contractor"
              className={`px-3 py-2 rounded-2xl text-sm font-medium inline-flex items-center gap-1.5 touch-manipulation ${
                pathname === '/contractor' || pathname?.startsWith('/contractor/outlet')
                  ? 'bg-[#00b4d8]/10 text-[#00b4d8]'
                  : 'text-neutral-600 hover:bg-neutral-50'
              }`}
            >
              <LayoutDashboard className="w-4 h-4" />
              <span>My outlet</span>
            </Link>
            <Link
              href="/contractor/leadership"
              className={`px-3 py-2 rounded-2xl text-sm font-medium inline-flex items-center gap-1.5 touch-manipulation ${
                pathname?.startsWith('/contractor/leadership')
                  ? 'bg-[#00b4d8]/10 text-[#00b4d8]'
                  : 'text-neutral-600 hover:bg-neutral-50'
              }`}
            >
              <GraduationCap className="w-4 h-4" />
              <span>Leadership</span>
            </Link>
            <button
              type="button"
              onClick={() => logout()}
              className="px-3 py-2 rounded-2xl text-sm font-medium text-neutral-600 hover:bg-neutral-50 inline-flex items-center gap-1.5 touch-manipulation"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign out</span>
            </button>
          </nav>
          <button
            type="button"
            onClick={() => logout()}
            className="sm:hidden px-3 py-2 rounded-2xl text-sm font-medium text-neutral-600 hover:bg-neutral-50 inline-flex items-center gap-1.5 touch-manipulation"
            aria-label="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-4 py-6 sm:py-8 pb-mobile-nav sm:pb-8">
        {children}
      </main>

      <nav
        className="sm:hidden fixed bottom-0 inset-x-0 z-40 border-t border-neutral-200 bg-white/95 backdrop-blur-xl pb-safe shadow-[0_-4px_20px_-8px_rgba(15,23,42,0.12)]"
        aria-label="Operator primary navigation"
      >
        <div className="grid grid-cols-2 max-w-lg mx-auto">
          <Link
            href="/contractor"
            className={`flex flex-col items-center justify-center gap-0.5 py-2 min-h-[3.25rem] text-[10px] font-bold touch-manipulation ${
              pathname === '/contractor' || pathname?.startsWith('/contractor/outlet')
                ? 'text-[#0077b6]'
                : 'text-neutral-500'
            }`}
          >
            <LayoutDashboard
              className={`w-5 h-5 ${
                pathname === '/contractor' || pathname?.startsWith('/contractor/outlet')
                  ? 'text-[#00b4d8]'
                  : ''
              }`}
            />
            My outlet
          </Link>
          <Link
            href="/contractor/leadership"
            className={`flex flex-col items-center justify-center gap-0.5 py-2 min-h-[3.25rem] text-[10px] font-bold touch-manipulation ${
              pathname?.startsWith('/contractor/leadership')
                ? 'text-[#0077b6]'
                : 'text-neutral-500'
            }`}
          >
            <GraduationCap
              className={`w-5 h-5 ${
                pathname?.startsWith('/contractor/leadership') ? 'text-[#00b4d8]' : ''
              }`}
            />
            Leadership
          </Link>
        </div>
      </nav>

      <footer className="hidden sm:block text-center text-xs text-neutral-400 py-8">
        Independent contractor access · limited to your allocated container(s)
      </footer>
    </div>
  );
}
