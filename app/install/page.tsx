'use client';

import Link from 'next/link';
import Image from 'next/image';
import {
  ArrowLeft,
  Share,
  MoreVertical,
  Smartphone,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { openInstallHelp } from '@/components/pwa/InstallAppBanner';

/**
 * Public install guide — works even when the floating chip was dismissed.
 * iPhone requires Safari; Android uses Chrome Install / Add to Home screen.
 */
export default function InstallPage() {
  return (
    <div className="min-h-dvh bg-[#f8fafc] text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-lg px-4 py-3 flex items-center gap-3">
          <Link
            href="/"
            className="rounded-xl p-2 text-slate-500 hover:bg-slate-50 touch-manipulation"
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex items-center gap-2 min-w-0">
            <Image
              src="/sa-icon-192.png"
              alt=""
              width={36}
              height={36}
              className="rounded-xl"
            />
            <div>
              <div className="font-black text-sm tracking-tight">Install SupplierAdvisor</div>
              <div className="text-[11px] text-slate-500">Add to home screen</div>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 py-8 space-y-6">
        <div className="rounded-3xl border border-sky-100 bg-gradient-to-br from-sky-50 to-white p-5">
          <Smartphone className="w-8 h-8 text-[#00b4d8] mb-3" />
          <h1 className="text-xl font-black tracking-tight">
            Use it like an app on your phone
          </h1>
          <p className="mt-2 text-sm text-slate-600 leading-relaxed">
            No App Store required. Install from your browser for full-screen access,
            faster launch, and field-friendly navigation.
          </p>
          <button
            type="button"
            onClick={() => openInstallHelp()}
            className="mt-4 inline-flex items-center gap-2 rounded-full bg-[#00b4d8] px-5 py-2.5 text-sm font-bold text-white touch-manipulation"
          >
            Show install helper
          </button>
        </div>

        <section className="rounded-3xl border border-slate-200 bg-white p-5 space-y-3">
          <h2 className="font-black text-slate-900 flex items-center gap-2">
            <Share className="w-4 h-4 text-[#00b4d8]" /> iPhone / iPad
          </h2>
          <div className="rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-xs text-amber-950 flex gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              Must use <strong>Safari</strong>. Chrome, Instagram, Facebook, and other
              apps cannot add websites to the home screen on iOS.
            </span>
          </div>
          <ol className="list-decimal pl-5 space-y-2 text-sm text-slate-700">
            <li>
              Open <strong>Safari</strong> and go to{' '}
              <strong>www.supplieradvisor.com</strong>
            </li>
            <li>
              Tap <strong>Share</strong> (square with ↑)
            </li>
            <li>
              Scroll and tap <strong>Add to Home Screen</strong>
            </li>
            <li>
              Tap <strong>Add</strong>
            </li>
          </ol>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-5 space-y-3">
          <h2 className="font-black text-slate-900 flex items-center gap-2">
            <MoreVertical className="w-4 h-4 text-[#00b4d8]" /> Android
          </h2>
          <ol className="list-decimal pl-5 space-y-2 text-sm text-slate-700">
            <li>
              Open <strong>Chrome</strong> (not Facebook/Instagram in-app browser)
            </li>
            <li>
              Go to <strong>www.supplieradvisor.com</strong>
            </li>
            <li>
              Tap <strong>⋮</strong> menu → <strong>Install app</strong> or{' '}
              <strong>Add to Home screen</strong>
            </li>
            <li>
              Or use the blue <strong>Install app</strong> button if it appears
            </li>
          </ol>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-5 space-y-2 text-sm text-slate-600">
          <div className="font-black text-slate-900 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Tips if it still fails
          </div>
          <ul className="list-disc pl-5 space-y-1.5">
            <li>Use the real browser app, not a link opened inside another app</li>
            <li>Stay on the site 10–20 seconds so the install engine can load</li>
            <li>On iPhone, only Safari has “Add to Home Screen”</li>
            <li>If you hid the install button, open this page and tap “Show install helper”</li>
            <li>Update Chrome / Safari to the latest version</li>
          </ul>
        </section>

        <Link
          href="/login"
          className="block text-center text-sm font-bold text-[#0077b6] hover:underline"
        >
          Already installed? Log in →
        </Link>
      </main>
    </div>
  );
}
