import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Page not found',
  robots: {
    index: false,
    follow: false,
  },
};

export default function NotFound() {
  return (
    <main className="min-h-screen bg-[#f8fafc] px-4 py-12 text-slate-900 sm:px-6">
      <div className="mx-auto w-full max-w-3xl rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-[11px] font-black uppercase tracking-[0.24em] text-[#00b4d8]">SupplierAdvisor®</p>
        <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Page not found</h1>
        <p className="mt-3 text-sm text-slate-600">
          We couldn’t find that page. Try one of these routes.
        </p>
        <nav className="mt-6 flex flex-wrap gap-3 text-sm font-bold">
          <Link href="/" className="rounded-full border border-slate-200 px-4 py-2 hover:border-[#00b4d8] hover:text-[#0077b6]">
            Home
          </Link>
          <Link href="/login" className="rounded-full border border-slate-200 px-4 py-2 hover:border-[#00b4d8] hover:text-[#0077b6]">
            Login
          </Link>
          <Link href="/industries" className="rounded-full border border-slate-200 px-4 py-2 hover:border-[#00b4d8] hover:text-[#0077b6]">
            Industries
          </Link>
          <Link href="/pricing" className="rounded-full border border-slate-200 px-4 py-2 hover:border-[#00b4d8] hover:text-[#0077b6]">
            Pricing
          </Link>
        </nav>
      </div>
    </main>
  );
}
