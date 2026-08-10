'use client';

/**
 * Fieldgraph form + table — process role tones:
 * fg-office / office (emerald) · fg-ops / ops (amber) · fg-trade / trade (cyan)
 */
import type { ReactNode } from 'react';
import {
  DataTable as RoleDataTable,
  FormCard as RoleFormCard,
  ListRowCard as RoleListRow,
  StatRow as RoleStatRow,
  SurfaceCard as RoleSurface,
  fieldInputClass,
  toneLinkClass as roleLink,
  toneTitleClass as roleTitle,
} from '@/components/chrome/RoleToneForm';

export type FieldFormTone =
  | 'fg-office'
  | 'fg-ops'
  | 'fg-trade'
  | 'office'
  | 'ops'
  | 'trade';

function normalizeTone(tone?: FieldFormTone | string): string {
  if (!tone || tone === 'office') return 'fg-office';
  if (tone === 'ops') return 'fg-ops';
  if (tone === 'trade') return 'fg-trade';
  if (tone === 'fg-office' || tone === 'fg-ops' || tone === 'fg-trade') return tone;
  return 'fg-office';
}

export function StatRow({
  items,
  tone = 'fg-office',
}: {
  items: Array<{ label: string; value: string | number }>;
  tone?: FieldFormTone | string;
}) {
  return <RoleStatRow items={items} tone={normalizeTone(tone)} />;
}

export function FormCard({
  title,
  children,
  onSubmit,
  saving,
  submitLabel = 'Save',
  tone = 'fg-office',
  description,
}: {
  title: string;
  children: ReactNode;
  onSubmit: () => void;
  saving: boolean;
  submitLabel?: string;
  tone?: FieldFormTone | string;
  description?: string;
}) {
  return (
    <RoleFormCard
      title={title}
      onSubmit={onSubmit}
      saving={saving}
      submitLabel={submitLabel}
      tone={normalizeTone(tone)}
      description={description}
    >
      {children}
    </RoleFormCard>
  );
}

export function DataTable({
  headers,
  rows,
  onDelete,
  tone = 'fg-office',
}: {
  headers: string[];
  rows: Array<{ id: string; cells: Array<string | number | ReactNode> }>;
  onDelete?: (id: string) => void;
  tone?: FieldFormTone | string;
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

export function ListRowCard({
  tone = 'fg-office',
  children,
  actions,
}: {
  tone?: FieldFormTone | string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <RoleListRow tone={normalizeTone(tone)} actions={actions}>
      {children}
    </RoleListRow>
  );
}

export function SurfaceCard({
  tone = 'fg-office',
  children,
  className,
}: {
  tone?: FieldFormTone | string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <RoleSurface tone={normalizeTone(tone)} className={className}>
      {children}
    </RoleSurface>
  );
}

export function fc() {
  return fieldInputClass();
}

export function toneLinkClass(tone: FieldFormTone | string = 'fg-office') {
  return roleLink(normalizeTone(tone));
}

export function toneTitleClass(tone: FieldFormTone | string = 'fg-office') {
  return roleTitle(normalizeTone(tone));
}
