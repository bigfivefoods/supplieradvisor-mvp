'use client';

/**
 * HireAdvisor form + table — process role tones:
 * hg-desk (violet) · hg-talent (cyan) · hg-client (emerald)
 */
import type { ReactNode } from 'react';
import {
  DataTable as RoleDataTable,
  FormCard as RoleFormCard,
  StatRow as RoleStatRow,
  fieldInputClass,
} from '@/components/chrome/RoleToneForm';

export type HireFormTone =
  | 'hg-desk'
  | 'hg-talent'
  | 'hg-client'
  | 'office'
  | 'ops'
  | 'trade';

function normalizeTone(tone?: HireFormTone | string): string {
  if (!tone || tone === 'office') return 'hg-desk';
  if (tone === 'ops') return 'hg-talent';
  if (tone === 'trade') return 'hg-client';
  if (tone === 'hg-desk' || tone === 'hg-talent' || tone === 'hg-client')
    return tone;
  return 'hg-desk';
}

export function StatRow({
  items,
  tone = 'hg-desk',
}: {
  items: Array<{ label: string; value: string | number }>;
  tone?: HireFormTone | string;
}) {
  return <RoleStatRow items={items} tone={normalizeTone(tone)} />;
}

export function FormCard({
  title,
  children,
  onSubmit,
  saving,
  submitLabel = 'Save',
  tone = 'hg-desk',
}: {
  title: string;
  children: ReactNode;
  onSubmit: () => void;
  saving: boolean;
  submitLabel?: string;
  tone?: HireFormTone | string;
}) {
  return (
    <RoleFormCard
      title={title}
      onSubmit={onSubmit}
      saving={saving}
      submitLabel={submitLabel}
      tone={normalizeTone(tone)}
    >
      {children}
    </RoleFormCard>
  );
}

export function fieldClass() {
  return fieldInputClass();
}

export function DataTable({
  headers,
  rows,
  onDelete,
  tone = 'hg-desk',
}: {
  headers: string[];
  rows: Array<{ id: string; cells: Array<string | number | ReactNode> }>;
  onDelete?: (id: string) => void;
  tone?: HireFormTone | string;
}) {
  return (
    <RoleDataTable
      headers={headers}
      rows={rows}
      onDelete={onDelete}
      tone={normalizeTone(tone)}
    />
  );
}
