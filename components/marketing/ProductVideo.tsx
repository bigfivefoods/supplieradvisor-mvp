'use client';

import Link from 'next/link';
import { Play, ArrowRight } from 'lucide-react';

/**
 * Product story block — animated “video” panel until a real host is added.
 * CTA deep-links to interactive demo.
 */
export default function ProductVideo() {
  return (
    <section
      id="video"
      className="relative flex min-h-below-nav flex-col justify-center sa-anchor border-t border-slate-200 bg-[#0b1220] px-4 py-16 sm:px-6 sm:py-20 lg:px-10"
    >
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_0%,rgba(0,180,216,0.18),transparent_55%)]"
        aria-hidden
      />
      <div className="relative mx-auto flex w-full max-w-screen-2xl flex-1 flex-col justify-center">
        <div className="mx-auto mb-8 max-w-3xl text-center lg:mb-10">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.28em] text-[#00b4d8]">
            Product story
          </p>
          <h2 className="text-3xl font-black tracking-tight text-white sm:text-5xl">
            See the OS in under a minute
          </h2>
          <p className="mt-4 text-base leading-relaxed text-slate-300 sm:text-lg">
            Watch modules rotate live on the home hero — or open the interactive
            demo to click through operations, suppliers, finance, quality, and
            people without signing up first.
          </p>
        </div>

        <div className="mx-auto w-full max-w-5xl">
          <div className="relative overflow-hidden rounded-[1.75rem] border border-white/10 bg-slate-950 shadow-2xl aspect-video">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_20%,rgba(0,180,216,0.35),transparent_50%),radial-gradient(ellipse_at_80%_70%,rgba(139,92,246,0.25),transparent_45%)]" />
            <div className="absolute inset-0 opacity-30 bg-[linear-gradient(rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.06)_1px,transparent_1px)] bg-[size:32px_32px]" />
            <div className="relative flex h-full flex-col items-center justify-center p-8 text-center">
              <Link
                href="/demo"
                className="group mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-white text-[#00b4d8] shadow-lg transition-transform hover:scale-105 sm:h-20 sm:w-20"
                aria-label="Play interactive demo"
              >
                <Play className="ml-0.5 h-7 w-7 fill-current sm:h-8 sm:w-8" />
              </Link>
              <div className="text-lg font-black text-white sm:text-2xl">
                Interactive product walkthrough
              </div>
              <p className="mt-2 max-w-md text-sm text-slate-300">
                No video host required — click through live UI mocks for Ops,
                SRM, Finance, SHEQ, and People.
              </p>
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                {['Ops', 'Suppliers', 'Finance', 'Quality', 'People'].map(
                  (t) => (
                    <span
                      key={t}
                      className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-bold text-white/90"
                    >
                      {t}
                    </span>
                  )
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/demo"
            className="inline-flex items-center gap-2 rounded-full bg-[#00b4d8] px-6 py-3 text-sm font-bold text-white hover:bg-[#0099b8]"
          >
            <Play className="h-4 w-4 fill-current" />
            Open interactive demo
          </Link>
          <a
            href="#modules"
            className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-6 py-3 text-sm font-bold text-white"
          >
            Browse modules <ArrowRight className="h-4 w-4" />
          </a>
        </div>
      </div>
    </section>
  );
}
