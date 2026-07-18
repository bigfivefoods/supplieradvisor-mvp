import type { Metadata } from 'next';
import Link from 'next/link';
import { ShieldCheck, Clock, CreditCard, RefreshCw, BadgeCheck } from 'lucide-react';
import { SITE_URL } from '@/lib/seo/company-public';

export const metadata: Metadata = {
  title: 'CIPC verification SLA — paid identity in 24 hours | SupplierAdvisor',
  description:
    'SupplierAdvisor paid CIPC company verification: R69 via Paystack, live CIPC match, 24-hour SLA from payment to badge (or clear mismatch with free re-run). Money → trust for B2B trade.',
  keywords: [
    'CIPC verification',
    'company verification South Africa',
    'B2B trust badge',
    'Paystack verification',
    'SupplierAdvisor SLA',
    'verified suppliers',
  ],
  alternates: { canonical: `${SITE_URL}/verification-sla` },
  openGraph: {
    title: 'Paid CIPC verification with a 24-hour SLA',
    description:
      'Pay R69 → CIPC company match → public verified badge. Target under 24 hours, self-serve re-run if stuck — no second charge.',
    url: `${SITE_URL}/verification-sla`,
    siteName: 'SupplierAdvisor®',
    type: 'website',
  },
  robots: { index: true, follow: true },
};

const STEPS = [
  {
    icon: CreditCard,
    title: 'Pay R69',
    body: 'Secure Paystack checkout. Payment reference is stored on your company profile.',
  },
  {
    icon: ShieldCheck,
    title: 'CIPC match',
    body: 'We call VerifyNow CIPC with your registration or VAT number and compare legal names.',
  },
  {
    icon: BadgeCheck,
    title: 'Public badge',
    body: 'On success, verification_status becomes verified and the directory shows your trust badge.',
  },
  {
    icon: Clock,
    title: '24-hour SLA',
    body: 'We aim for badge (or clear mismatch/failure) within 24 hours of successful payment.',
  },
  {
    icon: RefreshCw,
    title: 'Free re-run',
    body: 'If CIPC is pending or failed, re-use the same payment — no second charge. Ops auto-replays at-risk cases.',
  },
] as const;

export default function VerificationSlaPage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'CIPC verification SLA',
    description:
      'Paid CIPC company verification on SupplierAdvisor with a 24-hour money-to-trust SLA.',
    url: `${SITE_URL}/verification-sla`,
    isPartOf: {
      '@type': 'WebSite',
      name: 'SupplierAdvisor',
      url: SITE_URL,
    },
    about: {
      '@type': 'Service',
      name: 'CIPC company verification',
      provider: { '@type': 'Organization', name: 'SupplierAdvisor' },
      offers: {
        '@type': 'Offer',
        price: '69',
        priceCurrency: 'ZAR',
        description: 'One-time CIPC company match via Paystack',
      },
    },
  };

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto max-w-3xl px-4 py-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link
              href="/"
              className="text-xs font-bold uppercase tracking-wider text-[#0077b6]"
            >
              SupplierAdvisor®
            </Link>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mt-1">
              CIPC verification SLA
            </h1>
            <p className="text-sm text-neutral-600 mt-1 max-w-xl leading-relaxed">
              Money → trust: paid identity verification for B2B companies on
              SupplierAdvisor, with a clear 24-hour service target.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/directory"
              className="btn-secondary !py-2.5 !px-4 text-sm"
            >
              Directory
            </Link>
            <Link
              href="/onboarding?type=business"
              className="btn-primary !py-2.5 !px-4 text-sm"
            >
              List &amp; verify
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-10 space-y-8">
        <section className="rounded-3xl border border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-sky-50 p-6 sm:p-8">
          <p className="text-sm font-black text-emerald-950">
            What you get
          </p>
          <p className="text-sm text-emerald-900/90 mt-2 leading-relaxed">
            A <strong>CIPC-verified</strong> badge on your public company
            profile and directory listing after a live company match. Buyers can
            trust that the legal identity was checked against CIPC data — not
            just a free form checkbox.
          </p>
          <ul className="mt-4 grid sm:grid-cols-2 gap-2 text-xs text-slate-700">
            <li className="rounded-xl bg-white/80 border border-emerald-100 px-3 py-2">
              <strong>Price:</strong> R69 once (ZAR via Paystack)
            </li>
            <li className="rounded-xl bg-white/80 border border-emerald-100 px-3 py-2">
              <strong>SLA:</strong> target badge within 24h of payment
            </li>
            <li className="rounded-xl bg-white/80 border border-emerald-100 px-3 py-2">
              <strong>Re-run:</strong> free if pending/failed (same ref)
            </li>
            <li className="rounded-xl bg-white/80 border border-emerald-100 px-3 py-2">
              <strong>Mismatch:</strong> apply CIPC name or fix reg/VAT
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-black text-slate-900 mb-3">
            How the path works
          </h2>
          <ol className="space-y-3">
            {STEPS.map((s, i) => {
              const Icon = s.icon;
              return (
                <li
                  key={s.title}
                  className="flex gap-3 rounded-2xl border border-neutral-200 bg-white p-4"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-800 font-black text-sm">
                    {i + 1}
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
                      <Icon className="w-4 h-4 text-[#0077b6]" />
                      {s.title}
                    </div>
                    <p className="text-xs text-neutral-600 mt-1 leading-relaxed">
                      {s.body}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        </section>

        <section className="rounded-2xl border border-neutral-200 bg-white p-5 text-sm text-neutral-700 leading-relaxed">
          <h2 className="text-base font-black text-slate-900 mb-2">
            For partners evaluating trust
          </h2>
          <p>
            Verified companies on the{' '}
            <Link href="/directory" className="font-bold text-[#0077b6] hover:underline">
              SupplierAdvisor directory
            </Link>{' '}
            completed this paid path. Look for the CIPC-verified badge and the
            “24h paid SLA” marker on public profiles. Unverified listings may
            still trade, but verified identity is the trust default for serious
            B2B deals.
          </p>
        </section>

        <div className="flex flex-wrap gap-3">
          <Link
            href="/onboarding?type=business"
            className="btn-primary !py-2.5 !px-5 text-sm"
          >
            Start free · verify when ready
          </Link>
          <Link
            href="/dashboard/my-business/profile#identity"
            className="btn-secondary !py-2.5 !px-5 text-sm"
          >
            Open identity (signed in)
          </Link>
        </div>
      </main>
    </div>
  );
}
