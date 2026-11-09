'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import {
  Bot,
  LayoutDashboard,
  LogOut,
  CalendarDays,
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

const NAV: {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  exact?: boolean;
}[] = [
  { href: '/sales', label: 'Command centre', icon: LayoutDashboard, exact: true },
  { href: '/sales/pipeline', label: 'Pipeline', icon: Target },
  { href: '/sales/tasks', label: 'Diary', icon: CalendarDays },
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

/** Primary destinations for phone thumb bar */
const MOBILE_TABS: {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  exact?: boolean;
}[] = [
  { href: '/sales', label: 'Home', icon: LayoutDashboard, exact: true },
  { href: '/sales/pipeline', label: 'Pipeline', icon: Target },
  { href: '/sales/tasks', label: 'Diary', icon: CalendarDays },
  { href: '/sales/quotes', label: 'Quotes', icon: FileText },
  { href: '/sales/customers', label: 'Customers', icon: Users },
];

export function SalesShellFrame({
  children,
  email,
  companyName = '',
  needAgreement = false,
  needSubscription = false,
  onLogout,
  onAskSam,
  headerExtras = null,
}: {
  children: React.ReactNode;
  email?: string | null;
  companyName?: string;
  needAgreement?: boolean;
  needSubscription?: boolean;
  onLogout?: () => void;
  onAskSam?: () => void;
  headerExtras?: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800">
      <header className="sticky top-0 z-40 border-b border-neutral-200 bg-white/95 backdrop-blur-xl shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <Link href="/sales" className="flex items-center gap-3 min-w-0">
            <div className="relative">
              <Image
                src="/sa-logo.png"
                alt="SA"
                width={96}
                height={42}
                className="h-10 w-auto object-contain"
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
            <button
              type="button"
              onClick={() => {
                if (onAskSam) onAskSam();
                else window.dispatchEvent(new Event('sa:open-sam'));
              }}
              className="relative p-2 min-h-[40px] min-w-[40px] rounded-xl bg-sky-50 hover:bg-sky-100 text-sky-700 inline-flex items-center justify-center touch-manipulation"
              aria-label="Ask SAM — Grok assistant"
              title="Ask SAM (Grok)"
            >
              <Bot className="w-4 h-4" />
              <span className="absolute top-1.5 right-1.5 flex h-1.5 w-1.5 rounded-full bg-emerald-400 ring-1 ring-white" />
            </button>
            {headerExtras}
            <Link
              href="/dashboard/select-company"
              className="px-3 py-2 rounded-2xl text-xs sm:text-sm font-medium text-neutral-600 hover:bg-neutral-100 inline-flex items-center gap-1.5"
            >
              <ArrowLeftRight className="w-4 h-4 text-[#00b4d8]" />
              <span className="hidden sm:inline">Switch company</span>
            </Link>
            <button
              type="button"
              onClick={() => onLogout?.()}
              className="px-3 py-2 rounded-2xl text-xs sm:text-sm font-medium text-neutral-600 hover:bg-neutral-100 inline-flex items-center gap-1.5"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </div>
        <nav className="hidden md:block max-w-7xl mx-auto px-2 sm:px-4 pb-2 overflow-x-auto">
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

      <main className="max-w-7xl mx-auto px-4 py-6 sm:py-8 pb-mobile-nav">
        {children}
      </main>

      {/* Mobile thumb bar — primary field actions */}
      <nav
        className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-neutral-200 bg-white/95 backdrop-blur-xl pb-safe shadow-[0_-4px_20px_-8px_rgba(15,23,42,0.12)]"
        aria-label="Sales primary navigation"
      >
        <div className="grid grid-cols-5 max-w-lg mx-auto">
          {MOBILE_TABS.map((item) => {
            const Icon = item.icon;
            const active = item.exact
              ? pathname === item.href
              : pathname === item.href ||
                pathname?.startsWith(`${item.href}/`);
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
                className={`flex flex-col items-center justify-center gap-0.5 py-2 min-h-[3.25rem] text-[10px] font-bold touch-manipulation ${
                  active ? 'text-[#0077b6]' : 'text-neutral-500'
                }`}
              >
                <Icon
                  className={`w-5 h-5 ${active ? 'text-[#00b4d8]' : ''}`}
                />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>

      <footer className="hidden md:block text-center text-[11px] text-neutral-500 py-10 px-4 border-t border-neutral-100 bg-white">
        Independent sales contractor · CRM data belongs to the company · Commission 4%–6% (super-link 6%) ·
        Contractors: 6 months free, then R199/mo · 6-month term · Owners &amp; finance: free full access · Powered by
        SupplierAdvisor®
      </footer>
    </div>
  );
}
