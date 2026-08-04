import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: {
    default: 'Verified storefront | SupplierAdvisor®',
    template: '%s | SupplierAdvisor®',
  },
  description:
    'Order on the verified network — catalog, quotes, and orders in one OS for trade and proof.',
};

export default function StoreLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900">
      <header className="border-b border-slate-200/80 bg-white/90 backdrop-blur sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <Link href="/" className="flex items-center gap-2 min-w-0">
            <span className="font-black text-[#0077b6] tracking-tight text-lg">
              SupplierAdvisor®
            </span>
            <span className="hidden sm:inline text-[11px] font-semibold text-slate-500 truncate">
              Verified B2B trade
            </span>
          </Link>
          <nav className="flex items-center gap-2 text-sm">
            <Link
              href="/login"
              className="px-3 py-1.5 rounded-full font-semibold text-[#0077b6] hover:bg-sky-50"
            >
              Sign in
            </Link>
            <Link
              href="/onboarding?type=business"
              className="px-3 py-1.5 rounded-full font-bold bg-[#00b4d8] text-white hover:bg-[#0096c7]"
            >
              Join network
            </Link>
          </nav>
        </div>
      </header>
      <main>{children}</main>
      <footer className="border-t border-slate-200 mt-16 py-8 text-center text-xs text-slate-500">
        <p>
          Catalog, stock, orders, and invoices live on SupplierAdvisor® — not a
          second order book on marketing sites.
        </p>
        <p className="mt-2">
          <Link href="/" className="text-[#0077b6] font-semibold hover:underline">
            supplieradvisor.com
          </Link>
        </p>
      </footer>
    </div>
  );
}
