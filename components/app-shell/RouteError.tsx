'use client';

import Link from 'next/link';

type RouteErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
  backHref: string;
  backLabel: string;
  title?: string;
};

export default function RouteError({
  error,
  reset,
  backHref,
  backLabel,
  title = 'This section hit a problem — your data is safe',
}: RouteErrorProps) {
  return (
    <main className="mx-auto w-full max-w-4xl p-4 sm:p-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-[11px] font-black uppercase tracking-[0.24em] text-[#00b4d8]">SupplierAdvisor®</p>
        <h1 className="mt-3 text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">{title}</h1>
        <p className="mt-3 text-sm text-slate-600">You can retry now or return to a safe starting point.</p>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="rounded-full bg-[#00b4d8] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#0098b8]"
          >
            Try again
          </button>
          <Link
            href={backHref}
            className="rounded-full border border-slate-200 px-5 py-2.5 text-sm font-bold text-slate-700 hover:border-[#00b4d8] hover:text-[#0077b6]"
          >
            {backLabel}
          </Link>
        </div>
        {error.digest ? (
          <p className="mt-5 text-xs text-slate-500">
            Support digest: <span className="font-mono">{error.digest}</span>
          </p>
        ) : null}
      </div>
    </main>
  );
}
