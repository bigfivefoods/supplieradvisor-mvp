'use client';

import Link from 'next/link';
import {
  CompanyGate,
  RelationshipHeader,
  RelationshipNav,
  RelationshipPage,
  type NavItem,
} from '@/components/relationship/RelationshipChrome';

/** Manufacturing mission-control nav */
export const MANUFACTURING_NAV: readonly NavItem[] = [
  { href: '/dashboard/manufacturing', label: 'Command', exact: true },
  { href: '/dashboard/manufacturing/production-orders', label: 'Work orders' },
  { href: '/dashboard/manufacturing/bills-of-materials', label: 'BOMs' },
  { href: '/dashboard/manufacturing/master-production-schedules', label: 'MPS' },
  { href: '/dashboard/manufacturing/mrp', label: 'MRP' },
  { href: '/dashboard/manufacturing/work-centers', label: 'Cells' },
  {
    href: '/dashboard/manufacturing/cost-centres',
    label: 'Cost centres',
  },
] as const;


export function ManufacturingNav() {
  return <RelationshipNav items={MANUFACTURING_NAV} />;
}

export function CompanyRequired({ children }: { children: React.ReactNode }) {
  return <CompanyGate noun="Manufacturing">{children}</CompanyGate>;
}


export function ManufacturingHeader({
  title,
  titleAccent,
  description,
  action,
}: {
  title: string;
  titleAccent?: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <RelationshipHeader
      backHref="/dashboard/manufacturing"
      backLabel="Command center"
      eyebrow="Manufacturing systems"
      title={title}
      titleAccent={titleAccent}
      description={description}
      action={action}
    />
  );
}

export function ManufacturingPage({ children }: { children: React.ReactNode }) {
  return <RelationshipPage>{children}</RelationshipPage>;
}

export function StatusPill({
  label,
  className = '',
  pulse,
}: {
  label: string;
  className?: string;
  pulse?: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-black tracking-wider uppercase ${className}`}
    >
      {pulse && (
        <span className="relative flex h-1.5 w-1.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
        </span>
      )}
      {label}
    </span>
  );
}

export function TelemetryCard({
  label,
  value,
  sub,
  accent = 'cyan',
}: {
  label: string;
  value: string | number;
  sub?: string;
  accent?: 'cyan' | 'emerald' | 'amber' | 'rose' | 'slate' | 'violet';
}) {
  const accents = {
    cyan: 'from-cyan-50 to-white border-cyan-100 text-[#0077b6]',
    emerald: 'from-emerald-50 to-white border-emerald-100 text-emerald-700',
    amber: 'from-amber-50 to-white border-amber-100 text-amber-800',
    rose: 'from-rose-50 to-white border-rose-100 text-rose-700',
    slate: 'from-slate-50 to-white border-slate-200 text-slate-700',
    violet: 'from-violet-50 to-white border-violet-100 text-violet-700',
  };
  return (
    <div
      className={`rounded-2xl border bg-gradient-to-br ${accents[accent]} px-4 py-3.5 shadow-sm`}
    >
      <div className="text-[10px] font-black uppercase tracking-[0.16em] text-neutral-400 mb-1">
        {label}
      </div>
      <div className="text-2xl sm:text-3xl font-black tabular-nums tracking-tight text-slate-900">
        {value}
      </div>
      {sub && <div className="text-[11px] text-neutral-500 mt-0.5 font-medium">{sub}</div>}
    </div>
  );
}

export function EmptyMission({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-dashed border-neutral-300 bg-white/80 px-8 py-16 text-center">
      <div className="mx-auto mb-4 h-12 w-12 rounded-2xl bg-[#00b4d8]/10 flex items-center justify-center">
        <span className="text-[#00b4d8] font-black text-sm">MFG</span>
      </div>
      <h3 className="text-lg font-black text-slate-800 mb-2">{title}</h3>
      <p className="text-sm text-neutral-500 max-w-md mx-auto leading-relaxed mb-6">{body}</p>
      {action}
    </div>
  );
}

export function SchemaHint({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900 mb-4">
      <strong className="font-bold">Schema:</strong> {message} Run manufacturing
      migrations under{' '}
      <code className="font-mono bg-white/80 px-1 rounded">
        supabase/migrations/
      </code>{' '}
      (e.g. <code className="font-mono bg-white/80 px-1 rounded">20260710_manufacturing_module.sql</code>
      ,{' '}
      <code className="font-mono bg-white/80 px-1 rounded">
        20260720_manufacturing_cost_structure.sql
      </code>
      ) on production Supabase if tables are missing.
    </div>
  );
}
