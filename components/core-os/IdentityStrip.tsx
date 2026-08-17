'use client';

import type { IdentityLinks } from '@/lib/core-os/identity';

export function IdentityStrip({
  identity,
}: {
  identity: IdentityLinks;
}) {
  const chips = [
    identity.crm_customer_id ? `CRM #${identity.crm_customer_id}` : null,
    identity.hr_employee_id ? `People #${identity.hr_employee_id}` : null,
    identity.advisor_person_id
      ? `${identity.advisor_module || 'Advisor'} ${identity.advisor_person_id}`
      : null,
    identity.platform_user_id
      ? `Wallet ${String(identity.platform_user_id).slice(-8)}`
      : null,
    identity.email || null,
  ].filter(Boolean) as string[];
  if (!chips.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {chips.map((c) => (
        <span
          key={c}
          className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-600"
        >
          {c}
        </span>
      ))}
    </div>
  );
}

export function KindChips({ kinds }: { kinds: string[] }) {
  return (
    <div className="flex flex-wrap gap-1">
      {kinds.map((k) => (
        <span
          key={k}
          className="rounded-full bg-cyan-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-cyan-900"
        >
          {k.replace(/_/g, ' ')}
        </span>
      ))}
    </div>
  );
}
