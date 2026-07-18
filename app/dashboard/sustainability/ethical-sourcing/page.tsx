'use client';

/**
 * Ethical sourcing module — lightweight live surface (was ComingSoon).
 * Links trade partners, docs, and settle path for responsible sourcing.
 */
import Link from 'next/link';
import { Leaf, ArrowRight, Shield, FileText, Network } from 'lucide-react';

const LINKS = [
  {
    title: 'Supplier discovery',
    body: 'Prefer CIPC-verified, open-to-trade partners with trust / OTIFEF.',
    href: '/dashboard/connections/discover',
    icon: Network,
  },
  {
    title: 'Supplier documents',
    body: 'Certificates, specs, and compliance packs on the supplier book.',
    href: '/dashboard/suppliers/documents',
    icon: FileText,
  },
  {
    title: 'Quality & SHEQ',
    body: 'Inspections and hold logic before ship — proof in the supply chain.',
    href: '/dashboard/quality/inspections',
    icon: Shield,
  },
  {
    title: 'Settle with proof',
    body: 'Claims + POP on Money hub; optional USDC escrow for high-stakes POs.',
    href: '/dashboard/settle',
    icon: Leaf,
  },
];

export default function EthicalSourcingPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">
        Sustainability
      </p>
      <h1 className="text-2xl font-black text-slate-900 tracking-tight mt-1">
        Ethical sourcing
      </h1>
      <p className="text-sm text-slate-600 mt-2 leading-relaxed">
        Start with verified identity, documented suppliers, QA gates, and settle proof.
        Deeper ESG scorecards can plug into this rail as data lands.
      </p>

      <ul className="mt-8 space-y-3">
        {LINKS.map((l) => (
          <li key={l.href}>
            <Link
              href={l.href}
              className="flex items-start gap-3 rounded-2xl border border-neutral-200 bg-white p-4 hover:border-emerald-300 transition-colors"
            >
              <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-2">
                <l.icon className="w-4 h-4 text-emerald-800" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-black text-slate-900 flex items-center gap-1">
                  {l.title}
                  <ArrowRight className="w-3.5 h-3.5 text-neutral-400" />
                </p>
                <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                  {l.body}
                </p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
