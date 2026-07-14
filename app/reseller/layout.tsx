'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import AuthGate from '@/components/AuthGate';
import { Package, ShoppingCart, Home } from 'lucide-react';

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
              <nav className="flex gap-1">
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
              </nav>
            </div>
          </header>
        )}
        <main className="max-w-3xl mx-auto px-4 py-6">{children}</main>
      </div>
    </AuthGate>
  );
}
