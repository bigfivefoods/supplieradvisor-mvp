'use client';

import Link from 'next/link';

const loggedGlobalErrors = new WeakSet<Error>();

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  if (!loggedGlobalErrors.has(error)) {
    console.error(error);
    loggedGlobalErrors.add(error);
  }

  return (
    <html lang="en">
      <body className="min-h-screen bg-[#f8fafc] p-4 text-slate-900 sm:p-6">
        <main className="mx-auto mt-12 w-full max-w-2xl rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <p className="text-[11px] font-black uppercase tracking-[0.24em] text-[#00b4d8]">SupplierAdvisor®</p>
          <h1 className="mt-3 text-2xl font-black tracking-tight sm:text-3xl">
            Something went wrong
          </h1>
          <p className="mt-3 text-sm text-slate-600">
            Please reload the app. Your data is safe.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={reset}
              className="rounded-full bg-[#00b4d8] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#0098b8]"
            >
              Reload
            </button>
            <Link
              href="/"
              className="rounded-full border border-slate-200 px-5 py-2.5 text-sm font-bold text-slate-700 hover:border-[#00b4d8] hover:text-[#0077b6]"
            >
              Go home
            </Link>
          </div>
          {error.digest ? (
            <p className="mt-5 text-xs text-slate-500">
              Support digest: <span className="font-mono">{error.digest}</span>
            </p>
          ) : null}
        </main>
      </body>
    </html>
  );
}
