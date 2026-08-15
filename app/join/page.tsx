'use client';

import Link from 'next/link';
import Image from 'next/image';
import {
  ArrowRight,
  Building2,
  Landmark,
  ShieldCheck,
  Smartphone,
} from 'lucide-react';

const LANES = [
  {
    id: 'b2c',
    code: 'B2C',
    href: '/me',
    icon: Smartphone,
    kicker: 'Free · personal',
    title: 'Member account',
    body: 'One personal wallet. Link any business to shop, book, check in, family-book, join a waitlist, add bookings to your calendar, pay or send proof, and share care notes after you consent. No company, no card. Same login can still open a business later.',
    cta: 'Create free member account',
    tone: 'from-sky-50 to-white border-sky-200 ring-sky-100',
    iconTone: 'from-[#00b4d8] to-[#0077b6]',
  },
  {
    id: 'b2b',
    code: 'B2B',
    href: '/onboarding?lane=b2b',
    icon: Building2,
    kicker: 'Company workspace',
    title: 'Business',
    body: 'Register a company. Next you choose the organisation type — private, public, NPO and so on — then sector, industry and role.',
    cta: 'Continue as a business',
    tone: 'from-white to-slate-50 border-slate-200',
    iconTone: 'from-slate-800 to-slate-950',
  },
  {
    id: 'b2g',
    code: 'B2G',
    href: '/onboarding?lane=b2g',
    icon: Landmark,
    kicker: 'Platform approval required',
    title: 'Government',
    body: 'National, provincial or municipal offices. Your request is held until a SupplierAdvisor admin activates the workspace.',
    cta: 'Request government access',
    tone: 'from-violet-50 to-white border-violet-200',
    iconTone: 'from-violet-700 to-violet-950',
  },
] as const;

/**
 * /join — why are you joining us?
 * Only three first choices: B2C member · B2B business · B2G government.
 */
export default function JoinPage() {
  return (
    <div className="min-h-screen bg-[#f8fafc]">
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <div className="mb-10 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <Image
              src="/sa-logo.png"
              alt="SupplierAdvisor"
              width={100}
              height={44}
              className="h-9 w-auto object-contain"
            />
            <span className="text-xl font-black tracking-[-1px] text-slate-900">
              SupplierAdvisor®
            </span>
          </Link>
          <Link
            href="/login"
            className="text-sm font-bold text-[#0077b6] hover:underline"
          >
            Sign in
          </Link>
        </div>

        <div className="mb-8">
          <p className="mb-2 text-[10px] font-black uppercase tracking-[0.16em] text-[#0077b6]">
            Join SupplierAdvisor
          </p>
          <h1 className="mb-3 text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">
            Why are you joining us?
          </h1>
          <p className="max-w-2xl leading-relaxed text-slate-600">
            Choose one path. A member wallet and a company workspace can share
            the same login later — they stay separate.
          </p>
        </div>

        <div className="space-y-3">
          {LANES.map((lane) => {
            const Icon = lane.icon;
            return (
              <Link
                key={lane.id}
                href={lane.href}
                className={`group flex items-start gap-4 rounded-[1.75rem] border bg-gradient-to-br p-5 shadow-sm ring-1 transition-all hover:border-[#00b4d8] hover:shadow-md sm:p-6 ${lane.tone}`}
              >
                <div
                  className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow ${lane.iconTone}`}
                >
                  <Icon className="h-6 w-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#0077b6]">
                      {lane.kicker}
                    </p>
                    <span className="rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[9px] font-black uppercase text-slate-600">
                      {lane.code}
                    </span>
                  </div>
                  <h2 className="mt-0.5 text-lg font-black tracking-tight text-slate-900 sm:text-xl">
                    {lane.title}
                  </h2>
                  <p className="mt-1 text-sm leading-relaxed text-slate-600">
                    {lane.body}
                  </p>
                  <p className="mt-3 inline-flex items-center gap-1 text-sm font-bold text-[#0077b6]">
                    {lane.cta}
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </p>
                </div>
              </Link>
            );
          })}
        </div>

        <p className="mt-6 flex items-start gap-2 rounded-2xl border border-violet-100 bg-violet-50/70 px-4 py-3 text-xs text-violet-950">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
          Government (B2G) is not self-serve. Submit the request; platform
          admin must approve before the workspace opens.
        </p>

        <p className="mt-10 text-center text-xs text-slate-400">
          Already have an account?{' '}
          <Link href="/login" className="font-bold text-[#0077b6] underline">
            Sign in
          </Link>
          {' — '}
          same login opens SA Member and any companies you operate.
        </p>
      </div>
    </div>
  );
}
