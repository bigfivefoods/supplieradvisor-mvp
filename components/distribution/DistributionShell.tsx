'use client';

import {
  CompanyGate,
  RelationshipHeader,
  RelationshipNav,
  RelationshipPage,
  type NavItem,
} from '@/components/relationship/RelationshipChrome';

export const DISTRIBUTION_NAV: readonly NavItem[] = [
  { href: '/dashboard/distribution', label: 'Command', exact: true },
  { href: '/dashboard/distribution/inbound', label: 'Inbound' },
  { href: '/dashboard/distribution/outbound', label: 'Outbound' },
  { href: '/dashboard/distribution/tracking', label: 'Tracking' },
  { href: '/dashboard/distribution/carriers', label: 'Carriers' },
  { href: '/dashboard/distribution/fleet-drivers', label: 'Fleet' },
  { href: '/dashboard/distribution/incoterms', label: 'Incoterms' },
] as const;


export function DistributionNav() {
  return <RelationshipNav items={DISTRIBUTION_NAV} />;
}

export function CompanyRequired({ children }: { children: React.ReactNode }) {
  return <CompanyGate noun="Distribution">{children}</CompanyGate>;
}


export function DistributionHeader({
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
      backHref="/dashboard/distribution"
      backLabel="Command center"
      eyebrow="Distribution & logistics"
      title={title}
      titleAccent={titleAccent}
      description={description}
      action={action}
    />
  );
}

export function DistributionPage({ children }: { children: React.ReactNode }) {
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
  icon: Icon,
}: {
  label: string;
  value: string | number;
  sub?: string;
  accent?: 'cyan' | 'emerald' | 'amber' | 'rose' | 'slate' | 'violet' | 'sky';
  icon?: React.ComponentType<{ className?: string }>;
}) {
  const accents = {
    cyan: 'from-cyan-50 to-white border-cyan-100',
    emerald: 'from-emerald-50 to-white border-emerald-100',
    amber: 'from-amber-50 to-white border-amber-100',
    rose: 'from-rose-50 to-white border-rose-100',
    slate: 'from-slate-50 to-white border-slate-200',
    violet: 'from-violet-50 to-white border-violet-100',
    sky: 'from-sky-50 to-white border-sky-100',
  };
  return (
    <div
      className={`rounded-2xl border bg-gradient-to-br ${accents[accent]} px-4 py-3.5 shadow-sm`}
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <div className="text-[10px] font-black uppercase tracking-[0.16em] text-neutral-400">
          {label}
        </div>
        {Icon && (
          <div className="w-7 h-7 rounded-lg bg-white/80 border border-white flex items-center justify-center text-[#00b4d8]">
            <Icon className="w-3.5 h-3.5" />
          </div>
        )}
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
    <div className="rounded-3xl border border-dashed border-cyan-200 bg-gradient-to-br from-white to-sky-50/60 px-8 py-16 text-center">
      <div className="mx-auto mb-4 h-12 w-12 rounded-2xl bg-[#00b4d8]/10 flex items-center justify-center">
        <span className="text-[#00b4d8] font-black text-sm">DX</span>
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
      <strong className="font-bold">Schema:</strong> {message} Run{' '}
      <code className="font-mono bg-white/80 px-1 rounded">
        supabase/migrations/20260710_distribution_module.sql
      </code>{' '}
      on production Supabase if tables are missing.
    </div>
  );
}

export function ProgressBar({ pct, tone = 'cyan' }: { pct: number; tone?: 'cyan' | 'emerald' }) {
  const color =
    tone === 'emerald'
      ? 'from-emerald-400 to-teal-400'
      : 'from-[#00b4d8] to-sky-400';
  return (
    <div className="h-2 rounded-full bg-neutral-100 overflow-hidden">
      <div
        className={`h-full rounded-full bg-gradient-to-r ${color} transition-all`}
        style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
      />
    </div>
  );
}
