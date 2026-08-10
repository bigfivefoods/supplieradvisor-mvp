'use client';

/**
 * Quarrygraph form + table — process role tones:
 * qg-office (amber) · qg-ops (violet) · qg-trade (cyan)
 */
import type { ReactNode } from 'react';
import {
  DataTable as RoleDataTable,
  FormCard as RoleFormCard,
  StatRow as RoleStatRow,
  fieldInputClass,
} from '@/components/chrome/RoleToneForm';

export type QuarryFormTone = 'qg-office' | 'qg-ops' | 'qg-trade' | 'office' | 'ops' | 'trade';

function normalizeTone(tone?: QuarryFormTone | string): string {
  if (!tone || tone === 'office') return 'qg-office';
  if (tone === 'ops') return 'qg-ops';
  if (tone === 'trade') return 'qg-trade';
  if (tone === 'qg-office' || tone === 'qg-ops' || tone === 'qg-trade') return tone;
  return 'qg-office';
}

export function StatRow({
  items,
  tone = 'qg-office',
}: {
  items: Array<{ label: string; value: string | number }>;
  tone?: QuarryFormTone | string;
}) {
  return <RoleStatRow items={items} tone={normalizeTone(tone)} />;
}

export function FormCard({
  title,
  children,
  onSubmit,
  saving,
  submitLabel = 'Save',
  tone = 'qg-office',
}: {
  title: string;
  children: ReactNode;
  onSubmit: () => void;
  saving: boolean;
  submitLabel?: string;
  tone?: QuarryFormTone | string;
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
  tone = 'qg-office',
}: {
  headers: string[];
  rows: Array<{ id: string; cells: Array<string | number | ReactNode> }>;
  onDelete?: (id: string) => void;
  tone?: QuarryFormTone | string;
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
