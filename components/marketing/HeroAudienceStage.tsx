'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { COMPANY_TRIAL_DAYS } from '@/lib/billing/company-subscription';

const SCENES = [
  {
    id: 'b2b',
    code: 'B2B',
    title: 'Business to business',
    body: 'Manufacturers, distributors and brands run the full OS — network, buy and sell, inventory, make, ship, finance, SHEQ and quality — with counterparties you can score and prove.',
    points: [
      'Verified company graph and OTIFEF ratings',
      'POs, invoices and lot holds on the same books',
      'One workspace for the whole trade loop',
    ],
    cta: { href: '/onboarding?lane=b2b', label: 'Register your company' },
    src: '/marketing/hero-b2b.jpg',
    alt: 'Warehouse operations beside a glass control room',
  },
  {
    id: 'b2g',
    code: 'B2G',
    title: 'Business to government',
    body: 'Public entities and their suppliers need transparent procurement, accountable spend and audit-ready trails — not email chains and disconnected spreadsheets.',
    points: [
      'Transparent supplier discovery and handshakes',
      'Documented trade and performance scores',
      'SHEQ, NCR/CAPA and export packs for scrutiny',
    ],
    cta: { href: '/onboarding?lane=b2g', label: 'Request government access' },
    src: '/marketing/hero-b2g.jpg',
    alt: 'Civic plaza and public-sector offices at dusk',
  },
  {
    id: 'b2c',
    code: 'B2C',
    title: 'Business to consumer',
    body: 'One free personal wallet. Link any gym, clinic, hire desk or shop on this platform and manage that account — book, buy, records and push alerts. No company required.',
    points: [
      'Free SA Member app on your phone',
      'Book, check in and see shared medical notes',
      'Same login if you later run a business',
    ],
    cta: { href: '/me', label: 'Create free SA Member account' },
    src: '/marketing/hero-b2c.jpg',
    alt: 'Member using SA Member on their phone',
  },
] as const;

export default function HeroAudienceStage() {
  const [i, setI] = useState(0);

  useEffect(() => {
    const t = setInterval(() => {
      setI((n) => (n + 1) % SCENES.length);
    }, 8000);
    return () => clearInterval(t);
  }, []);

  const scene = SCENES[i];

  return (
    <section
      id="platform"
      className="relative isolate min-h-svh overflow-hidden bg-slate-950"
    >
      {SCENES.map((s, idx) => (
        <div
          key={s.id}
          className={`absolute inset-0 transition-opacity duration-700 ease-out ${
            idx === i ? 'opacity-100' : 'opacity-0'
          }`}
          aria-hidden={idx !== i}
        >
          <Image
            src={s.src}
            alt={s.alt}
            fill
            priority={idx === 0}
            sizes="100vw"
            className="object-cover object-center"
          />
        </div>
      ))}

      <div
        className="pointer-events-none absolute inset-0 bg-slate-950/25"
        aria-hidden
      />

      <div className="relative z-[1] mx-auto flex min-h-svh w-full max-w-screen-2xl items-end px-4 pb-8 pt-24 sm:px-6 sm:pb-12 lg:items-center lg:px-10 lg:pb-16 lg:pt-24">
        <div className="w-full max-w-3xl rounded-[1.75rem] bg-slate-950/78 p-6 shadow-[0_24px_80px_-20px_rgba(0,0,0,0.65)] ring-1 ring-white/15 backdrop-blur-xl sm:p-8 lg:p-10">
          <h1 className="text-4xl font-black leading-[1.02] tracking-[-0.05em] text-white sm:text-5xl md:text-6xl lg:text-7xl">
            The world&apos;s most trusted
            <span className="mt-2 block text-[#67e8f9]">
              supplier advice — and OS.
            </span>
          </h1>

          <div className="mt-5 border-t border-white/15 pt-5">
            <p className="font-mono text-[11px] font-bold tracking-[0.28em] text-cyan-200">
              {scene.code}
            </p>
            <h2 className="mt-1.5 text-lg font-black tracking-tight text-white sm:text-xl">
              {scene.title}
            </h2>
            <p className="mt-2.5 text-[15px] leading-relaxed text-slate-100 sm:text-base">
              {scene.body}
            </p>
            <ul className="mt-3.5 hidden space-y-1.5 sm:block">
              {scene.points.map((pt) => (
                <li key={pt} className="text-sm font-medium text-slate-200">
                  <span className="mr-2 text-cyan-300">—</span>
                  {pt}
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-6 flex flex-col items-stretch gap-2.5 sm:flex-row sm:flex-wrap sm:items-center">
            <Link
              href={scene.cta.href}
              className="group inline-flex items-center justify-center gap-2 rounded-full bg-[#00b4d8] px-6 py-3.5 text-[15px] font-semibold text-white shadow-lg shadow-cyan-950/40 transition-all hover:bg-[#0099b8] active:scale-[0.99] sm:px-7"
            >
              {scene.cta.label}
              <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-0.5" />
            </Link>
            {scene.id === 'b2c' ? (
              <Link
                href="/onboarding?type=business"
                className="inline-flex items-center justify-center gap-2 rounded-full border border-white/25 bg-white/10 px-6 py-3.5 text-[15px] font-semibold text-white hover:bg-white/18"
              >
                I run a business
              </Link>
            ) : (
              <Link
                href="/demo"
                className="inline-flex items-center justify-center gap-2 rounded-full border border-white/25 bg-white/10 px-6 py-3.5 text-[15px] font-semibold text-white hover:bg-white/18"
              >
                Book a demo
              </Link>
            )}
          </div>

          <p className="mt-4 text-xs leading-relaxed text-slate-300 sm:text-sm">
            Not Excel. Not accounting-only. Not a multi-year ERP project.{' '}
            <a
              href="#compare"
              className="font-semibold text-cyan-200 underline decoration-cyan-200/40 underline-offset-4 hover:text-white"
            >
              See how we compare
            </a>
            {scene.id !== 'b2c' ? (
              <>
                {' · '}
                {COMPANY_TRIAL_DAYS}-day free trial
              </>
            ) : (
              ' · Members never pay us'
            )}
          </p>

          <div className="mt-6 flex items-center gap-2">
            {SCENES.map((s, idx) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setI(idx)}
                className={`rounded-full px-3.5 py-1.5 text-[11px] font-bold tracking-wide transition-all ${
                  idx === i
                    ? 'bg-white text-slate-900'
                    : 'bg-white/10 text-white ring-1 ring-white/20 hover:bg-white/20'
                }`}
                aria-pressed={idx === i}
                aria-label={`Show ${s.title}`}
              >
                {s.code}
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
