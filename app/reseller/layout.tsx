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
          <header className="border-b border-slate-200 bg-white">
            <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
              <div>
                <div className="text-[10px] font-black uppercase tracking-widest text-[#00b4d8]">
                  SupplierAdvisor®
                </div>
                <div className="font-black text-sm tracking-tight text-slate-900">
                  Reseller portal
                </div>
              </div>
              <nav className="flex gap-1 overflow-x-auto max-w-[70vw] pb-0.5 scrollbar-thin">
                <Link
                  href="/reseller"
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold ${
                    path === '/reseller'
                      ? 'border-[#00b4d8] bg-[#00b4d8] text-white'
                      : 'border-slate-200 bg-white text-slate-600'
                  }`}
                >
                  <Home className="w-3.5 h-3.5" /> Home
                </Link>
                <Link
                  href="/reseller/sell"
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold ${
                    path.startsWith('/reseller/sell')
                      ? 'border-[#00b4d8] bg-[#00b4d8] text-white'
                      : 'border-slate-200 bg-white text-slate-600'
                  }`}
                >
                  <ShoppingCart className="w-3.5 h-3.5" /> Sell
                </Link>
                <Link
                  href="/reseller/stock"
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold ${
                    path.startsWith('/reseller/stock')
                      ? 'border-[#00b4d8] bg-[#00b4d8] text-white'
                      : 'border-slate-200 bg-white text-slate-600'
                  }`}
                >
                  <Package className="w-3.5 h-3.5" /> Stock
                </Link>
                <Link
                  href="/reseller/feedback"
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold ${
                    path.startsWith('/reseller/feedback')
                      ? 'border-[#00b4d8] bg-[#00b4d8] text-white'
                      : 'border-slate-200 bg-white text-slate-600'
                  }`}
                >
                  <MessageSquareHeart className="w-3.5 h-3.5" /> Feedback
                </Link>
                <Link
                  href="/reseller/riad"
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold ${
                    path.startsWith('/reseller/riad')
                      ? 'border-[#00b4d8] bg-[#00b4d8] text-white'
                      : 'border-slate-200 bg-white text-slate-600'
                  }`}
                >
                  <AlertTriangle className="w-3.5 h-3.5" /> RIAD
                </Link>
                <Link
                  href="/reseller/leadership"
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold ${
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
        <main className="max-w-3xl mx-auto px-4 py-6">{children}</main>
      </div>
    </AuthGate>
  );
}
