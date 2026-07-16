'use client';

import { useEffect } from 'react';

/**
 * /install → static guide that always works (no React install bugs).
 */
export default function InstallRedirectPage() {
  useEffect(() => {
    window.location.replace('/add-to-home.html');
  }, []);

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center gap-4 bg-[#f8fafc] px-6 text-center">
      <p className="text-sm font-semibold text-slate-700">Opening install guide…</p>
      <a
        href="/add-to-home.html"
        className="rounded-full bg-[#00b4d8] px-6 py-3 text-sm font-bold text-white"
      >
        Continue to Add to Home Screen
      </a>
    </div>
  );
}
