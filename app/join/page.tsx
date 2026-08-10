'use client';

import Link from 'next/link';
import Image from 'next/image';
import {
  ArrowRight,
  Building2,
  Factory,
  GraduationCap,
  HeartPulse,
  Hospital,
  Landmark,
  Leaf,
  Truck,
  Users2,
} from 'lucide-react';
import { entityGroups } from '@/lib/entities/entity-kinds';

const ICONS: Record<string, typeof Building2> = {
  business: Building2,
  supplier: Factory,
  government_education: Landmark,
  government_health: HeartPulse,
  school: GraduationCap,
  hospital: Hospital,
  nsnp_isp: Truck,
  association: Users2,
  consumer_org: Leaf,
  consumer: Leaf,
};

/**
 * /join — choose organisation kind before Privy onboarding.
 * Lanes: B2B businesses → B2C consumer marketplace → B2G government last.
 */
export default function JoinPage() {
  const groups = entityGroups();

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <div className="flex items-center justify-between mb-10">
          <Link href="/" className="flex items-center gap-3">
            <Image
              src="/sa-logo.png"
              alt="SupplierAdvisor"
              width={100}
              height={44}
              className="h-9 w-auto object-contain"
            />
            <span className="font-black text-xl tracking-[-1px] text-slate-900">
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

        <div className="mb-10">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#0077b6] mb-2">
            Join SupplierAdvisor
          </p>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900 mb-3">
            Who are you joining as?
          </h1>
          <p className="text-slate-600 max-w-2xl leading-relaxed">
            <strong className="text-slate-900">1 · Businesses (B2B)</strong>
            {' '}first ·{' '}
            <strong className="text-slate-900">2 · Consumer (B2C)</strong>
            {' '}marketplace ·{' '}
            <strong className="text-slate-900">3 · Government (B2G)</strong>
            {' '}last. Most invitations register a normal company.
          </p>
        </div>

        <div className="space-y-10">
          {groups.map((group) => (
            <section key={group.id}>
              <h2
                className={`text-sm font-black mb-1 ${
                  group.lane === 'b2b'
                    ? 'text-[#0077b6]'
                    : group.lane === 'b2c'
                      ? 'text-fuchsia-700'
                      : 'text-slate-500'
                }`}
              >
                {group.title}
                {group.lane === 'b2b' ? (
                  <span className="ml-2 text-[10px] font-bold uppercase tracking-wide text-sky-800 bg-sky-100 px-2 py-0.5 rounded-full">
                    First · recommended
                  </span>
                ) : null}
                {group.lane === 'b2c' ? (
                  <span className="ml-2 text-[10px] font-bold uppercase tracking-wide text-fuchsia-800 bg-fuchsia-100 px-2 py-0.5 rounded-full">
                    Marketplace
                  </span>
                ) : null}
              </h2>
              <p className="text-xs text-slate-500 mb-4">{group.blurb}</p>
              <div className="grid sm:grid-cols-2 gap-3">
                {group.entities.map((ent) => {
                  const Icon = ICONS[ent.id] || Building2;
                  const isCompany = ent.id === 'business';
                  return (
                    <Link
                      key={ent.id}
                      href={`/onboarding?type=${encodeURIComponent(ent.business_type)}`}
                      className={`group rounded-3xl border bg-white p-5 hover:border-[#00b4d8] hover:shadow-md transition-all ${
                        isCompany
                          ? 'border-sky-200 ring-1 ring-sky-100'
                          : 'border-slate-200'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={`w-11 h-11 rounded-2xl border flex items-center justify-center shrink-0 ${ent.badgeClass}`}
                        >
                          <Icon className="w-5 h-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-black text-slate-900 text-sm">
                              {ent.label}
                            </p>
                            <span
                              className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-md border ${ent.badgeClass}`}
                            >
                              {ent.badge}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                            {ent.description}
                          </p>
                          <p className="text-[11px] font-bold text-[#0077b6] mt-2 inline-flex items-center gap-1">
                            Continue
                            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                          </p>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          ))}
        </div>

        <p className="mt-12 text-center text-xs text-slate-400">
          Already registered?{' '}
          <Link href="/login" className="font-bold text-[#0077b6] underline">
            Sign in
          </Link>{' '}
          then pick your organisation on Select company.
        </p>
      </div>
    </div>
  );
}
