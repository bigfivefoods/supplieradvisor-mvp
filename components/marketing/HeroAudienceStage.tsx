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
    short:
      'Run the full OS with counterparties you can score and prove.',
    points: [
      'Verified company graph and OTIFEF ratings',
      'POs, invoices and lot holds on the same books',
      'One workspace for the whole trade loop',
    ],
    cta: { href: '/onboarding?lane=b2b', label: 'Register your company' },
    src: '/marketing/hero-b2b.jpg',
    alt: 'Warehouse operations beside a glass control room',
    /** Keep the aisle and operators in frame */
    imageClass: 'object-[28%_center] sm:object-[32%_center] lg:object-left',
  },
  {
    id: 'b2g',
    code: 'B2G',
    title: 'Business to government',
    body: 'Public entities and their suppliers need transparent procurement, accountable spend and audit-ready trails — not email chains and disconnected spreadsheets.',
    short:
      'Transparent procurement and audit-ready trails for public trade.',
    points: [
      'Transparent supplier discovery and handshakes',
      'Documented trade and performance scores',
      'SHEQ, NCR/CAPA and export packs for scrutiny',
    ],
    cta: { href: '/onboarding?lane=b2g', label: 'Request government access' },
    src: '/marketing/hero-b2g.jpg',
    alt: 'Civic plaza and public-sector offices at dusk',
    imageClass: 'object-[38%_center] sm:object-[42%_center] lg:object-[36%_center]',
  },
  {
    id: 'b2c',
    code: 'B2C',
    title: 'Business to consumer',
    body: 'One free personal wallet. Link any gym, clinic, hire desk or shop on this platform and manage that account — book, buy, records and push alerts. No company required.',
    short:
      'A free personal wallet for gym, clinic and hire — no company needed.',
    points: [
      'Free SA Member app on your phone',
      'Book, check in and see shared medical notes',
      'Same login if you later run a business',
    ],
    cta: { href: '/me', label: 'Create free SA Member account' },
    src: '/marketing/hero-b2c.jpg',
    alt: 'Member using SA Member on their phone',
    /** Keep the woman and her phone visible; copy sits on the right / bottom */
    imageClass: 'object-[22%_18%] sm:object-[20%_22%] lg:object-[18%_center]',
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
      className="relative isolate min-h-[100svh] overflow-hidden bg-slate-950"
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
            className={`object-cover ${s.imageClass}`}
          />
        </div>
      ))}

      {/* Mobile: lift the bottom only. Desktop: shade the right so copy sits off the people. */}
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/35 to-transparent lg:bg-gradient-to-l lg:from-slate-950/80 lg:via-slate-950/25 lg:to-transparent"
        aria-hidden
      />

      <div
        className="relative z-[1] mx-auto flex min-h-[100svh] w-full max-w-screen-2xl flex-col justify-end px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(5.5rem,env(safe-area-inset-top))] sm:px-6 lg:justify-center lg:px-10"
      >
        <div className="ml-auto w-full max-w-md rounded-2xl bg-slate-950/55 p-4 ring-1 ring-white/10 backdrop-blur-md sm:max-w-lg sm:p-6 lg:max-w-xl lg:rounded-[1.75rem] lg:bg-slate-950/70 lg:p-8 lg:backdrop-blur-xl">
          <h1 className="text-[1.65rem] font-black leading-[1.05] tracking-[-0.045em] text-white sm:text-4xl md:text-5xl lg:text-6xl">
            The world&apos;s most trusted
            <span className="mt-1 block text-[#67e8f9] sm:mt-1.5">
              supplier advice — and OS.
            </span>
          </h1>

          <div className="mt-3 border-t border-white/15 pt-3 sm:mt-4 sm:pt-4">
            <p className="font-mono text-[10px] font-bold tracking-[0.28em] text-cyan-200 sm:text-[11px]">
              {scene.code}
            </p>
            <h2 className="mt-1 text-base font-black tracking-tight text-white sm:text-xl">
              {scene.title}
            </h2>
            <p className="mt-1.5 text-[13px] leading-relaxed text-slate-100 sm:hidden">
              {scene.short}
            </p>
            <p className="mt-2 hidden text-[15px] leading-relaxed text-slate-100 sm:block sm:text-base">
              {scene.body}
            </p>
            <ul className="mt-3 hidden space-y-1.5 lg:block">
              {scene.points.map((pt) => (
                <li key={pt} className="text-sm font-medium text-slate-200">
                  <span className="mr-2 text-cyan-300">—</span>
                  {pt}
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-4 flex flex-col gap-2 sm:mt-5 sm:flex-row sm:flex-wrap sm:items-center">
            <Link
              href={scene.cta.href}
              className="group inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[#00b4d8] px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-cyan-950/40 transition-all hover:bg-[#0099b8] active:scale-[0.99] sm:min-h-12 sm:px-6 sm:text-[15px]"
            >
              {scene.cta.label}
              <ArrowRight className="h-4 w-4 sm:h-5 sm:w-5" />
            </Link>
            {scene.id === 'b2c' ? (
              <Link
                href="/onboarding?type=business"
                className="inline-flex min-h-11 items-center justify-center rounded-full border border-white/25 bg-white/10 px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/18 sm:min-h-12 sm:px-6 sm:text-[15px]"
              >
                I run a business
              </Link>
            ) : (
              <Link
                href="/demo"
                className="inline-flex min-h-11 items-center justify-center rounded-full border border-white/25 bg-white/10 px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/18 sm:min-h-12 sm:px-6 sm:text-[15px]"
              >
                Book a demo
              </Link>
            )}
          </div>

          <p className="mt-3 hidden text-xs leading-relaxed text-slate-300 sm:block sm:text-sm">
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

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {SCENES.map((s, idx) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setI(idx)}
                className={`min-h-9 rounded-full px-3.5 py-1.5 text-[11px] font-bold tracking-wide transition-all ${
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
