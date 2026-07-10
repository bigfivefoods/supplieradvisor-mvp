'use client';

import Link from 'next/link';
import {
  CompanyGate,
  RelationshipHeader,
  RelationshipNav,
  RelationshipPage,
  type NavItem,
} from '@/components/relationship/RelationshipChrome';

export const OPERATIONS_NAV: readonly NavItem[] = [
  { href: '/dashboard/operations', label: 'Command', exact: true },
  { href: '/dashboard/operations/supplier-orders', label: 'Procure' },
  { href: '/dashboard/operations/inbound', label: 'Inbound' },
  { href: '/dashboard/operations/warehouse', label: 'Warehouse' },
  { href: '/dashboard/operations/production', label: 'Make' },
  { href: '/dashboard/operations/outbound', label: 'Outbound' },
  { href: '/dashboard/operations/customer-orders', label: 'Fulfill' },
  { href: '/dashboard/operations/exceptions', label: 'Exceptions' },
] as const;

export function CompanyRequired({ children }: { children: React.ReactNode }) {
  return <CompanyGate noun="Operations">{children}</CompanyGate>;
}

export function OperationsNav() {
  return <RelationshipNav items={OPERATIONS_NAV} />;
}

export function OperationsHeader({
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
      nav={<OperationsNav />}
      backHref="/dashboard/operations"
      backLabel="Command center"
      eyebrow="Operations control tower"
      title={title}
      titleAccent={titleAccent}
      description={description}
      action={action}
    />
  );
}

export function OperationsPage({ children }: { children: React.ReactNode }) {
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
  href,
}: {
  label: string;
  value: string | number;
  sub?: string;
  accent?: 'cyan' | 'emerald' | 'amber' | 'rose' | 'slate' | 'violet' | 'sky';
  icon?: React.ComponentType<{ className?: string }>;
  href?: string;
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
  const inner = (
    <div
      className={`rounded-2xl border bg-gradient-to-br ${accents[accent]} px-4 py-3.5 shadow-sm h-full ${
        href ? 'hover:border-[#00b4d8]/50 hover:shadow-md transition-all' : ''
      }`}
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
  if (href) return <Link href={href}>{inner}</Link>;
  return inner;
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
    <div className="rounded-3xl border border-dashed border-cyan-200 bg-gradient-to-br from-white to-sky-50/60 px-8 py-14 text-center">
      <div className="mx-auto mb-4 h-12 w-12 rounded-2xl bg-[#00b4d8]/10 flex items-center justify-center">
        <span className="text-[#00b4d8] font-black text-sm">OPS</span>
      </div>
      <h3 className="text-lg font-black text-slate-800 mb-2">{title}</h3>
      <p className="text-sm text-neutral-500 max-w-md mx-auto leading-relaxed mb-6">{body}</p>
      {action}
    </div>
  );
}

export function WorkbenchLink({
  href,
  title,
  desc,
  icon: Icon,
}: {
  href: string;
  title: string;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Link
      href={href}
      className="group flex items-start gap-3 rounded-2xl border border-neutral-200 bg-white p-4 hover:border-[#00b4d8]/40 hover:shadow-sm transition-all"
    >
      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-50 to-sky-100 border border-cyan-100 flex items-center justify-center text-[#0077b6] shrink-0">
        <Icon className="w-5 h-5" />
      </div>
      <div className="min-w-0">
        <div className="font-bold text-slate-800 group-hover:text-[#0077b6] transition-colors">
          {title}
        </div>
        <p className="text-xs text-neutral-500 leading-relaxed mt-0.5">{desc}</p>
      </div>
    </Link>
  );
}
