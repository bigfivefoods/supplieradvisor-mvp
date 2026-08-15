'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowRight,
  Home,
  QrCode,
  Store,
  UserRound,
  WalletCards,
} from 'lucide-react';
import { COMPANY_TRIAL_DAYS } from '@/lib/billing/company-subscription';

const SCENES = [
  {
    id: 'b2b',
    code: 'B2B',
    title: 'Business to business',
    body: 'Manufacturers, distributors and brands run the full OS — network, buy and sell, inventory, make, ship, finance, SHEQ and quality — with counterparties you can score and prove.',
    short: 'Run the full OS with counterparties you can score and prove.',
    points: [
      'Verified company graph and OTIFEF ratings',
      'POs, invoices and lot holds on the same books',
      'One workspace for the whole trade loop',
    ],
    cta: { href: '/onboarding?lane=b2b', label: 'Register your company' },
    src: '/marketing/hero-b2b.jpg',
    alt: 'Warehouse operations beside a glass control room',
    imageClass: 'object-[28%_center] sm:object-[32%_center] lg:object-left',
  },
  {
    id: 'b2g',
    code: 'B2G',
    title: 'Business to government',
    body: 'Public entities and their suppliers need transparent procurement, accountable spend and audit-ready trails — not email chains and disconnected spreadsheets.',
    short: 'Transparent procurement and audit-ready trails for public trade.',
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
    body: 'One free personal wallet. Link any gym, clinic, hire desk or shop on this platform and manage that account — book, buy, check in, family, waitlist, pay & proof, records and push alerts. No company required.',
    short: 'A free personal wallet for gym, clinic and hire — no company needed.',
    points: [
      'Free SA Member app on your phone',
      'Book, check in, family, waitlist, .ics and shared medical notes',
      'Pay or send proof — same login if you later run a business',
    ],
    cta: { href: '/me', label: 'Create free SA Member account' },
    src: '/marketing/hero-b2c.jpg',
    alt: 'Member using SA Member on their phone',
    imageClass: 'object-[22%_18%] sm:object-[20%_22%] lg:object-[18%_center]',
  },
] as const;

function ShotWindow({
  path,
  children,
}: {
  path: string;
  children: ReactNode;
}) {
  return (
    <div className="flex h-full min-w-0 flex-col overflow-hidden rounded-xl border border-white/20 bg-white shadow-[0_18px_40px_-12px_rgba(0,0,0,0.55)]">
      <div className="flex shrink-0 items-center gap-1.5 border-b border-slate-100 bg-slate-50 px-2.5 py-1.5">
        <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
        <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
        <span className="ml-1 min-w-0 truncate font-mono text-[8px] font-medium text-slate-500">
          {path}
        </span>
      </div>
      <div className="min-h-0 flex-1 bg-gradient-to-br from-slate-50 via-white to-sky-50/50 p-3">
        {children}
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-2 py-1.5">
      <div className="text-[7px] font-black uppercase tracking-wider text-slate-400">
        {label}
      </div>
      <div className="text-[13px] font-black tabular-nums tracking-tight text-slate-900">
        {value}
      </div>
    </div>
  );
}

function MemberPhone() {
  return (
    <div
      className="relative h-full w-[118px] shrink-0 xl:w-[128px]"
      aria-label="SA Member on a phone"
    >
      <div className="flex h-full flex-col rounded-[1.35rem] bg-zinc-900 p-[5px] shadow-[0_18px_40px_-12px_rgba(0,0,0,0.55)] ring-1 ring-white/25">
        <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-[1.05rem] bg-[#f8fafc]">
          <div
            className="pointer-events-none absolute left-1/2 top-1.5 z-10 h-3 w-10 -translate-x-1/2 rounded-full bg-zinc-900"
            aria-hidden
          />
          <div className="bg-gradient-to-br from-[#0077b6] via-[#0284c7] to-[#0c4a6e] px-2 pb-2 pt-5 text-white">
            <div className="flex items-center gap-1">
              <Image
                src="/sa-logo.png"
                alt=""
                width={28}
                height={12}
                className="sa-logo h-2.5 w-auto object-contain"
              />
              <p className="text-[7px] font-black uppercase tracking-[0.16em] text-white/75">
                SA Member
              </p>
            </div>
            <p className="mt-0.5 text-[12px] font-black leading-tight tracking-tight">
              Home
            </p>
            <p className="text-[8px] text-white/85">Book · family · check in</p>
          </div>
          <div className="min-h-0 flex-1 space-y-1.5 overflow-hidden px-1.5 py-1.5">
            <div className="grid grid-cols-2 gap-1">
              {[
                { t: 'Gym', d: 'Tue 06:00' },
                { t: 'Clinic', d: 'Thu 14:00' },
                { t: 'Hire', d: 'Out today' },
                { t: 'Shop', d: '12 near you' },
              ].map((tile) => (
                <div
                  key={tile.t}
                  className="rounded-md bg-white px-1.5 py-1 shadow-sm ring-1 ring-slate-100"
                >
                  <div className="text-[7px] font-black uppercase tracking-wide text-[#00b4d8]">
                    {tile.t}
                  </div>
                  <div className="text-[9px] font-black leading-tight text-slate-900">
                    {tile.d}
                  </div>
                </div>
              ))}
            </div>
            <div className="rounded-md bg-white px-1.5 py-1.5 shadow-sm ring-1 ring-slate-100">
              <div className="text-[7px] font-black uppercase tracking-wide text-slate-400">
                Next
              </div>
              <div className="text-[9px] font-black leading-tight text-slate-900">
                VUKA spin · check in
              </div>
            </div>
          </div>
          <div className="flex shrink-0 items-end justify-around border-t border-slate-200 bg-white px-0.5 pb-2 pt-1">
            {(
              [
                { Icon: Home, on: true },
                { Icon: Store, on: false },
                { Icon: WalletCards, on: false },
                { Icon: QrCode, on: false },
                { Icon: UserRound, on: false },
              ] as const
            ).map(({ Icon, on }, idx) => (
              <Icon
                key={idx}
                className={`h-2.5 w-2.5 ${on ? 'text-[#0077b6]' : 'text-slate-400'}`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function HeroProductShots({ sceneId }: { sceneId: (typeof SCENES)[number]['id'] }) {
  if (sceneId === 'b2c') {
    return (
      <div className="flex h-[248px] w-full items-stretch gap-3 xl:h-[272px] xl:gap-3.5">
        <div className="min-w-0 flex-1">
          <ShotWindow path="app.supplieradvisor.com/me">
            <div className="text-[8px] font-black uppercase tracking-[0.16em] text-[#00b4d8]">
              SA Member
            </div>
            <div className="mt-0.5 text-[13px] font-black text-slate-900">Your wallet</div>
            <div className="mt-2.5 grid grid-cols-3 gap-1.5">
              <Metric label="Gym" value="Tue 06:00" />
              <Metric label="Hire" value="Out" />
              <Metric label="Clinic" value="Thu" />
            </div>
            <div className="mt-2.5 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[10px] font-semibold text-slate-600">
              Next: VUKA spin · family · check in
            </div>
          </ShotWindow>
        </div>
        <MemberPhone />
      </div>
    );
  }

  return (
    <div className="grid h-[208px] w-full grid-cols-2 gap-3 xl:h-[228px] xl:gap-3.5">
      {sceneId === 'b2g' ? (
        <>
          <ShotWindow path="app.supplieradvisor.com/network">
            <div className="text-[8px] font-black uppercase tracking-[0.16em] text-[#00b4d8]">
              Network
            </div>
            <div className="mt-0.5 text-[13px] font-black text-slate-900">
              Public procurement
            </div>
            <div className="mt-2.5 grid grid-cols-3 gap-1.5">
              <Metric label="Open" value="14" />
              <Metric label="Awarded" value="6" />
              <Metric label="Audit" value="Ready" />
            </div>
          </ShotWindow>
          <ShotWindow path="app.supplieradvisor.com/sheq">
            <div className="text-[8px] font-black uppercase tracking-[0.16em] text-[#00b4d8]">
              SHEQ · proof
            </div>
            <div className="mt-2.5 space-y-1.5">
              {[
                { n: 'NCR-041', s: 'Closed' },
                { n: 'CAPA pack', s: 'Export' },
                { n: 'Lot hold', s: 'Clear' },
              ].map((r) => (
                <div
                  key={r.n}
                  className="flex items-center justify-between rounded-md bg-white px-2 py-1.5 text-[11px] ring-1 ring-slate-100"
                >
                  <span className="font-semibold text-slate-700">{r.n}</span>
                  <span className="font-black text-emerald-600">{r.s}</span>
                </div>
              ))}
            </div>
          </ShotWindow>
        </>
      ) : (
        <>
          <ShotWindow path="app.supplieradvisor.com/operations">
            <div className="text-[8px] font-black uppercase tracking-[0.16em] text-[#00b4d8]">
              Operations
            </div>
            <div className="mt-0.5 text-[13px] font-black text-slate-900">
              One chain. Live.
            </div>
            <div className="mt-2.5 grid grid-cols-4 gap-1.5">
              <Metric label="POs" value="12" />
              <Metric label="In" value="4" />
              <Metric label="WIP" value="7" />
              <Metric label="Ship" value="9" />
            </div>
          </ShotWindow>
          <ShotWindow path="app.supplieradvisor.com/suppliers">
            <div className="text-[8px] font-black uppercase tracking-[0.16em] text-[#00b4d8]">
              Suppliers
            </div>
            <div className="mt-2.5 space-y-1.5">
              {[
                { n: 'Cape Harvest', s: '99%' },
                { n: 'Atlas Logistics', s: '97%' },
                { n: 'Kalahari Inputs', s: '96%' },
              ].map((r) => (
                <div
                  key={r.n}
                  className="flex items-center justify-between rounded-md bg-white px-2 py-1.5 text-[11px] ring-1 ring-slate-100"
                >
                  <span className="truncate font-semibold text-slate-700">{r.n}</span>
                  <span className="font-black tabular-nums text-[#00b4d8]">{r.s}</span>
                </div>
              ))}
            </div>
          </ShotWindow>
        </>
      )}
    </div>
  );
}

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

      {/* Mobile: fade up so type reads and the person stays in the top of the frame. */}
      <div
        className="pointer-events-none absolute inset-0 lg:hidden"
        style={{
          background:
            'linear-gradient(to top, rgba(2,6,23,0.88) 0%, rgba(2,6,23,0.55) 28%, rgba(2,6,23,0.16) 52%, transparent 74%)',
        }}
        aria-hidden
      />
      {/* Desktop: fade from the right into the photo so people stay visible. */}
      <div
        className="pointer-events-none absolute inset-0 hidden lg:block"
        style={{
          background:
            'linear-gradient(to left, rgba(2,6,23,0.90) 0%, rgba(2,6,23,0.70) 22%, rgba(2,6,23,0.28) 44%, rgba(2,6,23,0.06) 62%, transparent 78%)',
        }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 hidden h-64 bg-gradient-to-t from-slate-950/40 to-transparent lg:block"
        aria-hidden
      />

      <div className="relative z-[1] mx-auto flex min-h-[100svh] w-full max-w-screen-2xl">
        {/* Product shots sit on the photo, not in the text column */}
        <div className="pointer-events-none absolute bottom-6 left-4 hidden w-[min(44rem,56%)] lg:block lg:bottom-8 lg:left-10 xl:w-[min(48rem,58%)]">
          <HeroProductShots sceneId={scene.id} />
        </div>

        {/* Right-hand copy — big type, no glass card */}
        <div className="relative ml-auto flex w-full max-w-xl flex-col justify-end px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-[calc(var(--sa-nav-offset)+0.75rem)] sm:px-6 sm:pb-8 lg:max-w-[34rem] lg:justify-center lg:px-10 lg:pb-10 xl:max-w-[38rem]">
          <div className="w-full">
            <h1 className="text-[1.9rem] font-black leading-[1.04] tracking-[-0.048em] text-white [text-shadow:0_2px_28px_rgba(0,0,0,0.45)] sm:text-5xl lg:text-[3.35rem] xl:text-7xl">
              The world&apos;s most trusted
              <span className="mt-1 block text-[#67e8f9] sm:mt-1.5">
                supplier advice — and OS.
              </span>
            </h1>

            <p className="mt-3 font-mono text-[10px] font-bold tracking-[0.28em] text-cyan-200 sm:mt-5 sm:text-[11px]">
              {scene.code}
            </p>
            <h2 className="mt-1 text-lg font-black tracking-tight text-white sm:text-2xl lg:text-[1.65rem]">
              {scene.title}
            </h2>
            <p className="mt-2 max-w-md text-[14px] leading-relaxed text-slate-100 sm:hidden">
              {scene.short}
            </p>
            <p className="mt-2 hidden max-w-lg text-[15px] leading-relaxed text-slate-100 sm:block sm:text-base lg:text-[17px]">
              {scene.body}
            </p>
            <ul className="mt-3 hidden space-y-1.5 xl:block">
              {scene.points.map((pt) => (
                <li key={pt} className="text-sm font-medium text-slate-200">
                  <span className="mr-2 text-cyan-300">—</span>
                  {pt}
                </li>
              ))}
            </ul>

            <div className="mt-5 flex flex-col gap-2 sm:mt-6 sm:flex-row sm:flex-wrap sm:items-center">
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
                  className="inline-flex min-h-11 items-center justify-center rounded-full border border-white/30 bg-white/10 px-5 py-2.5 text-sm font-semibold text-white backdrop-blur-[2px] hover:bg-white/18 sm:min-h-12 sm:px-6 sm:text-[15px]"
                >
                  I run a business
                </Link>
              ) : (
                <Link
                  href="/demo"
                  className="inline-flex min-h-11 items-center justify-center rounded-full border border-white/30 bg-white/10 px-5 py-2.5 text-sm font-semibold text-white backdrop-blur-[2px] hover:bg-white/18 sm:min-h-12 sm:px-6 sm:text-[15px]"
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
      </div>
    </section>
  );
}
