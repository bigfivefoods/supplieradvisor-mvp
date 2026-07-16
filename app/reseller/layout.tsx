'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import AuthGate from '@/components/AuthGate';
import {
  Package,
  ShoppingCart,
  Home,
  MessageSquareHeart,
  AlertTriangle,
  GraduationCap,
} from 'lucide-react';

const TABS = [
  { href: '/reseller', label: 'Home', icon: Home, exact: true },
  { href: '/reseller/sell', label: 'Sell', icon: ShoppingCart },
  { href: '/reseller/stock', label: 'Stock', icon: Package },
  { href: '/reseller/feedback', label: 'Feedback', icon: MessageSquareHeart },
  { href: '/reseller/riad', label: 'RIAD', icon: AlertTriangle },
] as const;

function tabActive(path: string, href: string, exact?: boolean) {
  if (exact) return path === href;
  return path === href || path.startsWith(`${href}/`);
}

export default function ResellerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const path = usePathname() || '';
  const hideNav = path.startsWith('/reseller/invite');

  return (
    <AuthGate>
      <div className="min-h-screen bg-[#f8fafc]">
        {!hideNav && (
          <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur-xl">
            <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[10px] font-black uppercase tracking-widest text-[#00b4d8]">
                  SupplierAdvisor®
                </div>
                <div className="font-black text-sm tracking-tight text-slate-900">
                  Reseller portal
                </div>
              </div>
              {/* Desktop / wide: horizontal pills */}
              <nav className="hidden sm:flex gap-1 overflow-x-auto max-w-[70vw] pb-0.5">
                {TABS.map((t) => {
                  const Icon = t.icon;
                  const active = tabActive(path, t.href, 'exact' in t && t.exact);
                  return (
                    <Link
                      key={t.href}
                      href={t.href}
                      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold touch-manipulation ${
                        active
                          ? 'border-[#00b4d8] bg-[#00b4d8] text-white'
                          : 'border-slate-200 bg-white text-slate-600'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" /> {t.label}
                    </Link>
                  );
                })}
                <Link
                  href="/reseller/leadership"
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold touch-manipulation ${
                    path.startsWith('/reseller/leadership')
                      ? 'border-[#00b4d8] bg-[#00b4d8] text-white'
                      : 'border-slate-200 bg-white text-slate-600'
                  }`}
                >
                  <GraduationCap className="w-3.5 h-3.5" /> Lead
                </Link>
              </nav>
            </div>
          </header>
        )}
        <main
          className={`max-w-3xl mx-auto px-4 py-6 ${hideNav ? '' : 'pb-mobile-nav sm:pb-6'}`}
        >
          {children}
        </main>

        {/* Phone thumb bar */}
        {!hideNav && (
          <nav
            className="sm:hidden fixed bottom-0 inset-x-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur-xl pb-safe shadow-[0_-4px_20px_-8px_rgba(15,23,42,0.12)]"
            aria-label="Reseller primary navigation"
          >
            <div className="grid grid-cols-5 max-w-lg mx-auto">
              {TABS.map((t) => {
                const Icon = t.icon;
                const active = tabActive(path, t.href, 'exact' in t && t.exact);
                return (
                  <Link
                    key={t.href}
                    href={t.href}
                    className={`flex flex-col items-center justify-center gap-0.5 py-2 min-h-[3.25rem] text-[10px] font-bold touch-manipulation ${
                      active ? 'text-[#0077b6]' : 'text-neutral-500'
                    }`}
                  >
                    <Icon className={`w-5 h-5 ${active ? 'text-[#00b4d8]' : ''}`} />
                    {t.label}
                  </Link>
                );
              })}
            </div>
          </nav>
        )}
      </div>
    </AuthGate>
  );
}
