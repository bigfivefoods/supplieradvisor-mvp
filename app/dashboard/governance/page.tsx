'use client';

import Link from 'next/link';
import { ClipboardList, Globe2, Shield } from 'lucide-react';
import {
  RelationshipHeader,
  RelationshipPage,
} from '@/components/relationship/RelationshipChrome';
import {
  HubHero,
  HubModuleGrid,
  HubPrinciples,
  type HubModule,
} from '@/components/chrome/CommandHubChrome';

const MODULES: HubModule[] = [
  {
    href: '/dashboard/governance/raid',
    icon: ClipboardList,
    code: '01',
    title: 'Enterprise RIAD',
    desc: 'Risks, issues, actions, and decisions across the company.',
    accent: 'from-violet-50 to-white border-violet-100',
  },
  {
    href: '/dashboard/governance/pestle',
    icon: Globe2,
    code: '02',
    title: 'PESTLE',
    desc: 'Political, economic, social, tech, legal, environmental scan.',
    accent: 'from-sky-50 to-white border-sky-100',
  },
  {
    href: '/dashboard/my-business/riad-log',
    icon: Shield,
    code: '03',
    title: 'Company RIAD log',
    desc: 'Operational risk register for the selected company.',
    accent: 'from-cyan-50 to-white border-cyan-100',
  },
];

export default function GovernanceHub() {
  return (
    <RelationshipPage>
      <RelationshipHeader
        backHref="/dashboard"
        backLabel="Dashboard"
        eyebrow="Enterprise governance"
        title="Governance"
        titleAccent="Command"
        description="Enterprise RIAD, PESTLE, and on-chain posture — light control surface for leadership risk and compliance."
      />

      <HubHero
        pill="Live governance · risk → decide"
        title="Risk is owned, not ignored."
        description="Enterprise RIAD with PESTLE context keeps material risks visible. Decisions are logged so audit and leadership share one narrative."
        stats={[
          { label: 'RIAD', value: 'Live', valueClass: 'text-[#00b4d8]' },
          { label: 'PESTLE', value: 'Scan', valueClass: 'text-emerald-600' },
          { label: 'Scope', value: 'Co.', valueClass: 'text-amber-600' },
        ]}
      />

      <HubModuleGrid modules={MODULES} />

      <div className="rounded-3xl border border-dashed border-cyan-200 bg-gradient-to-br from-white to-sky-50/60 px-8 py-10 text-center mb-8">
        <p className="text-sm text-neutral-600 max-w-lg mx-auto leading-relaxed">
          Deeper enterprise dashboards and on-chain governance records are expanding. Use company
          RIAD today for operational risks, issues, actions, and decisions.
        </p>
        <Link
          href="/dashboard/my-business/riad-log"
          className="btn-primary !py-2.5 !px-6 text-sm mt-5 inline-flex"
        >
          Open company RIAD
        </Link>
      </div>

      <HubPrinciples
        items={[
          {
            title: 'Risk is owned',
            body: 'Every material risk has an owner and a next action. Silent risk is unmanaged risk.',
          },
          {
            title: 'Context matters',
            body: 'PESTLE frames external forces so internal RIAD stays connected to the real world.',
          },
          {
            title: 'Decisions leave a trail',
            body: 'Actions and decisions are logged so leadership, auditors, and partners share one truth.',
          },
        ]}
      />
    </RelationshipPage>
  );
}
