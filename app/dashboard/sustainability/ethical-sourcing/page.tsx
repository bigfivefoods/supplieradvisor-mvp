'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  FileText,
  Leaf,
  Loader2,
  Network,
  Shield,
  Users,
} from 'lucide-react';
import {
  RelationshipHeader,
  RelationshipPage,
  Panel,
} from '@/components/relationship/RelationshipChrome';
import { getSelectedCompanyId } from '@/lib/containers/company';

const LINKS = [
  {
    title: 'Supplier discovery',
    body: 'Prefer CIPC-verified, open-to-trade partners with trust / OTIFEF.',
    href: '/dashboard/connections/discover',
    icon: Network,
  },
  {
    title: 'Supplier book & scorecards',
    body: 'OTIFEF, verification, and performance on the supplier master.',
    href: '/dashboard/suppliers',
    icon: Users,
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
  {
    title: 'ESG initiatives (social)',
    body: 'Code of conduct, living wage pilots, community programmes.',
    href: '/dashboard/sustainability/initiatives',
    icon: Leaf,
  },
];

export default function EthicalSourcingPage() {
  const companyId = getSelectedCompanyId();
  const [loading, setLoading] = useState(true);
  const [social, setSocial] = useState<{
    suppliers_total?: number;
    suppliers_verified?: number;
    avg_otifef_pct?: number | null;
    quality_pass?: number | null;
  } | null>(null);

  useEffect(() => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    fetch(`/api/sustainability/esg-pack?companyId=${companyId}`)
      .then((r) => r.json())
      .then((j) => {
        const s = j.pack?.social;
        setSocial({
          suppliers_total: s?.suppliers_total,
          suppliers_verified: s?.suppliers_verified,
          avg_otifef_pct: s?.avg_otifef_pct,
          quality_pass: s?.quality_inspections?.pass_rate,
        });
      })
      .catch(() => null)
      .finally(() => setLoading(false));
  }, [companyId]);

  return (
    <RelationshipPage>
      <RelationshipHeader
        backHref="/dashboard/sustainability"
        backLabel="Sustainability"
        eyebrow="Social · Supply chain integrity"
        title="Ethical"
        titleAccent="sourcing"
        description="Responsible procurement rides on verified identity, documented suppliers, QA gates, and settle proof — with live OTIFEF and verification signals."
      />

      <div className="mb-6 grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Panel className="p-3">
          <div className="text-[10px] font-bold uppercase text-neutral-400">
            Suppliers
          </div>
          <div className="text-2xl font-black">
            {loading ? '…' : social?.suppliers_total ?? 0}
          </div>
        </Panel>
        <Panel className="p-3">
          <div className="text-[10px] font-bold uppercase text-neutral-400">
            Verified
          </div>
          <div className="text-2xl font-black text-emerald-700">
            {loading ? '…' : social?.suppliers_verified ?? 0}
          </div>
        </Panel>
        <Panel className="p-3">
          <div className="text-[10px] font-bold uppercase text-neutral-400">
            Avg OTIFEF
          </div>
          <div className="text-2xl font-black text-[#00b4d8]">
            {loading
              ? '…'
              : social?.avg_otifef_pct != null
                ? `${social.avg_otifef_pct}%`
                : '—'}
          </div>
        </Panel>
        <Panel className="p-3">
          <div className="text-[10px] font-bold uppercase text-neutral-400">
            QA pass rate
          </div>
          <div className="text-2xl font-black">
            {loading
              ? '…'
              : social?.quality_pass != null
                ? `${social.quality_pass}%`
                : '—'}
          </div>
        </Panel>
      </div>

      {loading && (
        <div className="flex justify-center py-4">
          <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
        </div>
      )}

      <ul className="space-y-3">
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
    </RelationshipPage>
  );
}
