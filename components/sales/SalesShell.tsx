'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { usePrivy } from '@privy-io/react-auth';
import { useEffect, useState } from 'react';
import {
  LayoutDashboard,
  LogOut,
  Loader2,
  Target,
  Users,
  FileText,
  ShoppingCart,
  Receipt,
  Wallet,
  TrendingUp,
  FileSignature,
  ArrowLeftRight,
  Sparkles,
  GraduationCap,
} from 'lucide-react';
import { extractEmailFromPrivyUser, getCanonicalUserId } from '@/lib/auth/identity';
import { getSelectedCompanyId } from '@/lib/containers/company';

const NAV: {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  exact?: boolean;
}[] = [
  { href: '/sales', label: 'Command centre', icon: LayoutDashboard, exact: true },
  { href: '/sales/pipeline', label: 'Pipeline', icon: Target },
  { href: '/sales/customers', label: 'Customers', icon: Users },
  { href: '/sales/quotes', label: 'Quotes', icon: FileText },
  { href: '/sales/orders', label: 'Orders', icon: ShoppingCart },
  { href: '/sales/invoices', label: 'Invoices', icon: Receipt },
  { href: '/sales/earnings', label: 'Earnings', icon: Wallet },
  { href: '/sales/forecast', label: 'Forecast', icon: TrendingUp },
  { href: '/sales/agreement', label: 'Agreement', icon: FileSignature },
  { href: '/sales/subscribe', label: 'Subscribe', icon: Sparkles },
  { href: '/sales/leadership', label: 'Leadership', icon: GraduationCap },
];

export default function SalesShell({ children }: { children: React.ReactNode }) {
  const { ready, authenticated, logout, user } = usePrivy();
  const pathname = usePathname();
  const router = useRouter();
  const email = extractEmailFromPrivyUser(user);
  const privyUserId = getCanonicalUserId(user?.id);
  const companyId = typeof window !== 'undefined' ? getSelectedCompanyId() : null;
  const [companyName, setCompanyName] = useState('');
  const [needAgreement, setNeedAgreement] = useState(false);
  const [needSubscription, setNeedSubscription] = useState(false);

  useEffect(() => {
    if (!ready) return;
    if (!authenticated) {
      router.replace(`/login?next=${encodeURIComponent(pathname || '/sales')}`);
      return;
    }
    if (!companyId) {
      router.replace('/dashboard/select-company');
    }
  }, [ready, authenticated, companyId, router, pathname]);

  useEffect(() => {
    if (!companyId || !privyUserId) return;
    let cancelled = false;
    (async () => {
      try {
        const params = new URLSearchParams({
          companyId: String(companyId),
          privyUserId,
        });
        const res = await fetch(`/api/sales/agreement?${params}`);
        const data = await res.json();
        if (cancelled) return;
        if (res.ok) {
          setCompanyName(data.companyName || '');
          if (data.subscriptionExempt || !data.isSalesContractor) {
            setNeedAgreement(false);
            setNeedSubscription(false);
            return;
          }
          const signed = Boolean(data.signed);
          const subOk = Boolean(data.subscriptionActive);
          setNeedAgreement(!signed);
          setNeedSubscription(signed && !subOk);
          if (!signed && pathname && !pathname.startsWith('/sales/agreement')) {
            router.replace('/sales/agreement');
            return;
          }
          if (
            signed &&
            !subOk &&
            pathname &&
            !pathname.startsWith('/sales/subscribe') &&
            !pathname.startsWith('/sales/agreement')
          ) {
            router.replace('/sales/subscribe');
          }
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [companyId, privyUserId, pathname, router]);

  if (!ready || !authenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8fafc]">
        <Loader2 className="w-8 h-8 animate-spin text-[#00b4d8]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800">
      <header className="sticky top-0 z-40 border-b border-neutral-200 bg-white/95 backdrop-blur-xl shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <Link href="/sales" className="flex items-center gap-3 min-w-0">
            <div className="relative">
              <Image
                src="/sa-logo.png"
                alt="SA"
                width={40}
                height={40}
                className="rounded-xl ring-2 ring-[#00b4d8]/30"
              />
              <Sparkles className="w-3.5 h-3.5 text-amber-500 absolute -top-1 -right-1" />
            </div>
            <div className="min-w-0">
              <div className="font-black text-sm tracking-tight text-slate-900">
                Sales Contractor Portal
              </div>
              <div className="text-[11px] text-neutral-500 truncate">
                {companyName || 'Customer sales team'}
                {email ? ` · ${email}` : ''}
              </div>
            </div>
          </Link>
          <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
            <Link
              href="/dashboard/select-company"
              className="px-3 py-2 rounded-2xl text-xs sm:text-sm font-medium text-neutral-600 hover:bg-neutral-100 inline-flex items-center gap-1.5"
            >
              <ArrowLeftRight className="w-4 h-4 text-[#00b4d8]" />
              <span className="hidden sm:inline">Switch company</span>
            </Link>
            <button
              type="button"
              onClick={() => logout()}
              className="px-3 py-2 rounded-2xl text-xs sm:text-sm font-medium text-neutral-600 hover:bg-neutral-100 inline-flex items-center gap-1.5"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </div>
        <nav className="max-w-7xl mx-auto px-2 sm:px-4 pb-2 overflow-x-auto">
          <div className="flex gap-1.5 min-w-max">
            {NAV.map((item) => {
              const Icon = item.icon;
              const active = item.exact
                ? pathname === item.href
                : pathname === item.href || pathname?.startsWith(`${item.href}/`);
              const locked =
                (needAgreement &&
                  item.href !== '/sales/agreement' &&
                  item.href !== '/sales') ||
                (needSubscription &&
                  item.href !== '/sales/subscribe' &&
                  item.href !== '/sales/agreement' &&
                  item.href !== '/sales');
              const lockHref = needAgreement
                ? '/sales/agreement'
                : needSubscription
                  ? '/sales/subscribe'
                  : item.href;
              return (
                <Link
                  key={item.href}
                  href={locked ? lockHref : item.href}
                  className={`px-3 py-2 rounded-full text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5 border transition-all ${
                    active
                      ? 'border-[#00b4d8] bg-[#00b4d8] text-white shadow-sm'
                      : 'border-neutral-200 bg-white text-neutral-600 hover:border-[#00b4d8]/40 hover:text-[#0077b6]'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </nav>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 sm:py-8">{children}</main>

      <footer className="text-center text-[11px] text-neutral-500 py-10 px-4 border-t border-neutral-100 bg-white">
        Independent sales contractor · CRM data belongs to the company · Commission 3.5%–5.5% ·
        Contractors: R199/mo · 6-month sub · Owners &amp; finance: free full access · Powered by
        SupplierAdvisor®
      </footer>
    </div>
  );
}
