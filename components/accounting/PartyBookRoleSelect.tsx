'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  partyRoleLabel,
  type PartyBookRole,
  type PartyRoleRow,
} from '@/lib/accounting/party-roles';

export function PartyBookRoleSelect({
  companyId,
  customerId,
  supplierId,
  role,
  arCode,
  apCode,
  onChanged,
  compact,
}: {
  companyId: number;
  customerId?: number | null;
  supplierId?: number | null;
  role: PartyBookRole;
  arCode?: string | null;
  apCode?: string | null;
  onChanged?: (next: {
    role: PartyBookRole;
    customer_id: number | null;
    supplier_id: number | null;
    ar_account_code: string | null;
    ap_account_code: string | null;
  }) => void;
  compact?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [value, setValue] = useState<PartyBookRole>(role);

  const save = async (next: PartyBookRole) => {
    if (next === value || busy) return;
    setBusy(true);
    try {
      const res = await fetch('/api/accounting/parties', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          companyId,
          role: next,
          customer_id: customerId || undefined,
          supplier_id: supplierId || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not update book');
      setValue(data.role || next);
      toast.success(
        next === 'both'
          ? `Both books · ${data.ar_account_code || '1180-*'} / ${data.ap_account_code || '2180-*'}`
          : next === 'supplier'
            ? `Supplier · ${data.ap_account_code || '2180-*'}`
            : `Customer · ${data.ar_account_code || '1180-*'}`
      );
      onChanged?.({
        role: data.role || next,
        customer_id: data.customer_id ?? customerId ?? null,
        supplier_id: data.supplier_id ?? supplierId ?? null,
        ar_account_code: data.ar_account_code ?? arCode ?? null,
        ap_account_code: data.ap_account_code ?? apCode ?? null,
      });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={compact ? 'space-y-0.5' : 'space-y-1'}>
      <label className="flex items-center gap-2">
        <select
          className="input !py-1.5 !px-2 !text-xs min-w-[10rem]"
          value={value}
          disabled={busy}
          onChange={(e) => void save(e.target.value as PartyBookRole)}
          aria-label="Customer or supplier book"
        >
          <option value="customer">Customer · you sell</option>
          <option value="supplier">Supplier · you buy</option>
          <option value="both">Both books</option>
        </select>
        {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin text-[#00b4d8]" /> : null}
      </label>
      <div className="font-mono text-[10px] text-neutral-500">
        {value === 'supplier' ? null : (
          <span>{arCode || '1180-…'}</span>
        )}
        {value === 'both' ? <span> · </span> : null}
        {value === 'customer' ? null : (
          <span>{apCode || '2180-…'}</span>
        )}
      </div>
      {!compact ? (
        <p className="text-[10px] text-neutral-400">{partyRoleLabel(value)}</p>
      ) : null}
    </div>
  );
}

export function roleFromPartyRow(row?: PartyRoleRow | null): PartyBookRole {
  return row?.role || 'customer';
}
