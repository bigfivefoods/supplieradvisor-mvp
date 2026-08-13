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
        className="pointer-events-none absolute inset-0 bg-gradient-to-r from-slate-950/88 via-slate-950/55 to-slate-950/20"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/75 via-transparent to-slate-950/35"
        aria-hidden
      />

      <div className="relative z-[1] mx-auto flex min-h-svh w-full max-w-screen-2xl flex-col justify-end px-4 pb-10 pt-28 sm:px-6 sm:pb-14 lg:justify-center lg:px-10 lg:pb-16 lg:pt-28">
        <div className="max-w-2xl">
          <h1 className="text-[2.35rem] font-black leading-[1.04] tracking-[-0.045em] text-white sm:text-5xl md:text-6xl lg:text-[3.15rem] xl:text-[3.5rem]">
            The world&apos;s most trusted
            <span className="mt-1.5 block bg-gradient-to-r from-[#7dd3fc] via-[#22d3ee] to-[#00b4d8] bg-clip-text text-transparent">
              supplier advice — and OS.
            </span>
          </h1>

          <div className="mt-6 min-h-[13.5rem] sm:min-h-[12.5rem]">
            <p className="font-mono text-[11px] font-bold tracking-[0.28em] text-cyan-200">
              {scene.code}
            </p>
            <h2 className="mt-1.5 text-2xl font-black tracking-tight text-white sm:text-3xl">
              {scene.title}
            </h2>
            <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-white/85 sm:text-base">
              {scene.body}
            </p>
            <ul className="mt-4 hidden space-y-1.5 sm:block">
              {scene.points.map((pt) => (
                <li
                  key={pt}
                  className="text-sm font-medium text-white/75"
                >
                  <span className="mr-2 text-cyan-300">—</span>
                  {pt}
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-7 flex flex-col items-stretch gap-2.5 sm:flex-row sm:flex-wrap sm:items-center">
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
                className="inline-flex items-center justify-center gap-2 rounded-full border border-white/30 bg-white/10 px-6 py-3.5 text-[15px] font-semibold text-white backdrop-blur-sm hover:bg-white/20"
              >
                I run a business
              </Link>
            ) : (
              <Link
                href="/demo"
                className="inline-flex items-center justify-center gap-2 rounded-full border border-white/30 bg-white/10 px-6 py-3.5 text-[15px] font-semibold text-white backdrop-blur-sm hover:bg-white/20"
              >
                Book a demo
              </Link>
            )}
          </div>

          <p className="mt-5 text-xs leading-relaxed text-white/65 sm:text-sm">
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
        </div>

        <div className="mt-8 flex items-center gap-2">
          {SCENES.map((s, idx) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setI(idx)}
              className={`rounded-full px-3.5 py-1.5 text-[11px] font-bold tracking-wide backdrop-blur-sm transition-all ${
                idx === i
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'bg-white/15 text-white ring-1 ring-white/25 hover:bg-white/25'
              }`}
              aria-pressed={idx === i}
              aria-label={`Show ${s.title}`}
            >
              {s.code}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
