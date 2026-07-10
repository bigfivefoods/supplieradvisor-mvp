'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Building2,
  Users,
  FolderOpen,
  ShieldCheck,
  FileText,
  Settings,
  Scale,
  UserPlus,
  CheckCircle2,
  AlertTriangle,
  Globe,
} from 'lucide-react';
import { usePrivy } from '@privy-io/react-auth';
import { getSelectedCompanyId } from '@/lib/containers/company';
import { getCanonicalUserId } from '@/lib/auth/identity';
import {
  CompanyRequired,
  BusinessPage,
} from '@/components/business/BusinessShell';
import {
  KpiCard,
  ModuleGrid,
  Panel,
  RelationshipHeader,
  SectionLabel,
  type ModuleCard,
} from '@/components/relationship/RelationshipChrome';

type Summary = {
  trading_name: string;
  verification_status: string;
  is_verified: boolean;
  is_discoverable: boolean;
  primary_currency: string;
  timezone: string;
  teamTotal: number;
  teamActive: number;
  teamInvited: number;
  openRiads: number;
  purchaseOrders: number;
  documents: number;
  profileCompleteness: number;
  completeness: Record<string, boolean>;
};

const PROCESS = [
  {
    label: 'Profile',
    href: '/dashboard/my-business/profile',
    desc: 'Trading identity the network trusts.',
  },
  {
    label: 'Legal',
    href: '/dashboard/my-business/legal',
    desc: 'Registration, tax, and regulatory posture.',
  },
  {
    label: 'Team',
    href: '/dashboard/my-business/team',
    desc: 'Invite with roles and least privilege.',
  },
  {
    label: 'Settings',
    href: '/dashboard/my-business/settings',
    desc: 'Currency, timezone, discoverability.',
  },
  {
    label: 'Documents',
    href: '/dashboard/my-business/documents',
    desc: 'Company vault for proofs and packs.',
  },
  {
    label: 'RIAD',
    href: '/dashboard/my-business/riad-log',
    desc: 'Company-level risk and decision log.',
  },
];

const MODULES: ModuleCard[] = [
  {
    href: '/dashboard/my-business/profile',
    icon: Building2,
    title: 'Profile',
    desc: 'Trading name, contacts, industry, location, certifications, wallet',
    badge: 'Core',
  },
  {
    href: '/dashboard/my-business/team',
    icon: Users,
    title: 'Team',
    desc: 'Invite members, assign roles, manage access rights',
    badge: 'Core',
  },
  {
    href: '/dashboard/my-business/settings',
    icon: Settings,
    title: 'Settings',
    desc: 'Timezone, currency, notifications, discoverability',
    badge: 'Core',
  },
  {
    href: '/dashboard/my-business/legal',
    icon: ShieldCheck,
    title: 'Legal',
    desc: 'Registration, B-BBEE, tax, regulatory posture',
  },
  {
    href: '/dashboard/my-business/documents',
    icon: FileText,
    title: 'Documents',
    desc: 'Company files, policies, and contracts vault',
  },
  {
    href: '/dashboard/my-business/projects',
    icon: FolderOpen,
    title: 'Projects',
    desc: 'Strategic initiatives and internal workstreams',
  },
  {
    href: '/dashboard/my-business/riad-log',
    icon: Scale,
    title: 'RIAD',
    desc: 'Internal risks, issues, actions, and decisions',
  },
];

export default function MyBusinessHub() {
  return (
    <CompanyRequired>
      <HubInner />
    </CompanyRequired>
  );
}

function HubInner() {
  const companyId = getSelectedCompanyId()!;
  const { user } = usePrivy();
  const privyUserId = getCanonicalUserId(user?.id);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ companyId: String(companyId) });
      if (privyUserId) params.set('privyUserId', privyUserId);
      const res = await fetch(`/api/business/summary?${params}`);
      const data = await res.json();
      setSummary(data.summary || null);
    } catch {
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [companyId, privyUserId]);

  useEffect(() => {
    void load();
  }, [load]);

  const pct = summary?.profileCompleteness ?? 0;

  return (
    <BusinessPage>
      <RelationshipHeader
        eyebrow="Company workspace"
        title="My business,"
        titleAccent="mastered"
        description="One precision control room for identity, team, compliance, documents, and settings — every change membership-checked and synced to Supabase."
        action={
          <>
            <Link
              href="/dashboard/my-business/profile"
              className="btn-primary !py-2.5 !px-5 text-sm"
            >
              <Building2 className="w-4 h-4" /> Edit profile
            </Link>
            <Link
              href="/dashboard/my-business/team"
              className="btn-secondary !py-2.5 !px-5 text-sm"
            >
              <UserPlus className="w-4 h-4" /> Invite team
            </Link>
          </>
        }
      />

      <SectionLabel>Pulse</SectionLabel>
      <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-3 sm:gap-4 mb-8">
        <KpiCard
          icon={CheckCircle2}
          label="Profile complete"
          value={loading ? '—' : `${pct}%`}
          sub={pct >= 80 ? 'World class' : pct >= 50 ? 'Building' : 'Needs attention'}
          href="/dashboard/my-business/profile"
          tone={pct >= 80 ? 'emerald' : pct >= 50 ? 'cyan' : 'amber'}
          loading={loading}
        />
        <KpiCard
          icon={Users}
          label="Team active"
          value={summary?.teamActive ?? 0}
          sub={`${summary?.teamInvited ?? 0} invited · ${summary?.teamTotal ?? 0} total`}
          href="/dashboard/my-business/team"
          loading={loading}
        />
        <KpiCard
          icon={ShieldCheck}
          label="Verification"
          value={summary?.is_verified ? 'Verified' : 'Pending'}
          sub={summary?.verification_status || 'unverified'}
          href="/dashboard/my-business/profile"
          tone={summary?.is_verified ? 'emerald' : 'amber'}
          loading={loading}
        />
        <KpiCard
          icon={Globe}
          label="Discoverable"
          value={summary?.is_discoverable === false ? 'Off' : 'On'}
          sub="Network visibility"
          href="/dashboard/my-business/settings"
          tone="cyan"
          loading={loading}
        />
        <KpiCard
          icon={FileText}
          label="Documents"
          value={summary?.documents ?? 0}
          sub="Company vault"
          href="/dashboard/my-business/documents"
          loading={loading}
        />
        <KpiCard
          icon={AlertTriangle}
          label="Open RIADs"
          value={summary?.openRiads ?? 0}
          sub="Company risks"
          href="/dashboard/my-business/riad-log"
          tone={(summary?.openRiads || 0) > 0 ? 'amber' : 'neutral'}
          loading={loading}
        />
      </div>

      {/* Completeness checklist */}
      <SectionLabel>Profile integrity</SectionLabel>
      <Panel className="mb-10">
        <div className="px-5 py-5 sm:px-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="font-bold text-slate-900 tracking-tight">
                {summary?.trading_name || 'Your company'}
              </div>
              <div className="text-xs text-neutral-500 mt-0.5">
                {summary?.primary_currency || 'ZAR'} · {summary?.timezone || 'Africa/Johannesburg'}
              </div>
            </div>
            <div className="text-right">
              <div className="text-3xl font-black tracking-tighter text-slate-900 tabular-nums">
                {pct}%
              </div>
              <div className="text-[10px] uppercase tracking-wider text-neutral-400 font-semibold">
                complete
              </div>
            </div>
          </div>
          <div className="h-2 rounded-full bg-neutral-100 overflow-hidden mb-5">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#00b4d8] to-[#0077b6] transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-2">
            {Object.entries(summary?.completeness || {}).map(([k, ok]) => (
              <div
                key={k}
                className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium ${
                  ok
                    ? 'border-emerald-100 bg-emerald-50/50 text-emerald-900'
                    : 'border-neutral-100 bg-neutral-50 text-neutral-500'
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${ok ? 'bg-emerald-500' : 'bg-neutral-300'}`}
                />
                {labelFor(k)}
              </div>
            ))}
          </div>
        </div>
      </Panel>

      <SectionLabel>Workspace</SectionLabel>
      <ModuleGrid modules={MODULES} />

      <div className="mt-10">
        <Panel title="Operating principle">
          <div className="px-5 py-6 sm:px-8 sm:py-8 grid sm:grid-cols-3 gap-6 text-sm">
            <Principle
              n="01"
              title="Identity first"
              desc="A complete, verified profile is the foundation of trust across CRM, SRM, and on-chain flows."
            />
            <Principle
              n="02"
              title="Least privilege team"
              desc="Invite with roles. Every member is membership-checked against company scope."
            />
            <Principle
              n="03"
              title="Synced always"
              desc="Profile, settings, and team changes write through APIs to Supabase — no local-only drift."
            />
          </div>
        </Panel>
      </div>
    </BusinessPage>
  );
}

function labelFor(k: string) {
  const map: Record<string, string> = {
    trading_name: 'Trading name',
    legal_name: 'Legal name',
    email: 'Email',
    contact: 'Contact',
    industry: 'Industry',
    location: 'Location',
    address: 'Address',
    registration: 'Reg / VAT',
    certs: 'Certifications',
    wallet: 'Wallet',
  };
  return map[k] || k;
}

function Principle({ n, title, desc }: { n: string; title: string; desc: string }) {
  return (
    <div>
      <div className="text-[10px] font-black tracking-[0.2em] text-[#00b4d8] mb-2">{n}</div>
      <div className="font-bold text-slate-900 mb-1.5">{title}</div>
      <p className="text-xs text-neutral-500 leading-relaxed">{desc}</p>
    </div>
  );
}
