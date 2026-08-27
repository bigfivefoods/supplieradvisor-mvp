'use client';

import { groupCoaForAllocation } from '@/lib/accounting/party-gl-accounts';
import type { CoaAccount } from '@/lib/accounting/types';

export function AllocGlSelect({
  value,
  onChange,
  accounts,
  required,
  className,
  emptyLabel = 'Select…',
  id,
}: {
  value: string;
  onChange: (value: string) => void;
  accounts: CoaAccount[];
  required?: boolean;
  className?: string;
  emptyLabel?: string;
  id?: string;
}) {
  const groups = groupCoaForAllocation(accounts);
  const Option = ({ a }: { a: CoaAccount }) => (
    <option value={a.id}>
      {a.code} · {a.name}
    </option>
  );
  return (
    <select
      id={id}
      required={required}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={className || 'input'}
    >
      <option value="">{emptyLabel}</option>
      {groups.customers.length > 0 ? (
        <optgroup label="Customers (receivable)">
          {groups.customers.map((a) => (
            <Option key={a.id} a={a} />
          ))}
        </optgroup>
      ) : null}
      {groups.suppliers.length > 0 ? (
        <optgroup label="Suppliers (payable)">
          {groups.suppliers.map((a) => (
            <Option key={a.id} a={a} />
          ))}
        </optgroup>
      ) : null}
      {groups.incomeExpense.length > 0 ? (
        <optgroup label="Income / expense">
          {groups.incomeExpense.map((a) => (
            <Option key={a.id} a={a} />
          ))}
        </optgroup>
      ) : null}
      {groups.other.length > 0 ? (
        <optgroup label="Other">
          {groups.other.map((a) => (
            <Option key={a.id} a={a} />
          ))}
        </optgroup>
      ) : null}
    </select>
  );
}
