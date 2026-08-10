'use client';

/**
 * DentalAdvisor form surfaces — practice sky via shared role tones.
 */
import type { ReactNode } from 'react';
import {
  DataTable as RoleDataTable,
  FormCard as RoleFormCard,
  ListRowCard as RoleListRow,
  StatRow as RoleStatRow,
  fieldInputClass,
  toneLinkClass as roleLink,
} from '@/components/chrome/RoleToneForm';

const TONE = 'fg-trade';

export function StatRow({
  items,
}: {
  items: Array<{ label: string; value: string | number }>;
}) {
  return <RoleStatRow items={items} tone={TONE} />;
}

export function FormCard({
  title,
  children,
  onSubmit,
  saving,
  submitLabel = 'Save',
  description,
}: {
  title: string;
  children: ReactNode;
  onSubmit: () => void;
  saving: boolean;
  submitLabel?: string;
  description?: string;
}) {
  return (
    <RoleFormCard
      title={title}
      onSubmit={onSubmit}
      saving={saving}
      submitLabel={submitLabel}
      tone={TONE}
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
}: {
  headers: string[];
  rows: Array<{ id: string; cells: Array<string | number | ReactNode> }>;
  onDelete?: (id: string) => void;
}) {
  return (
    <RoleDataTable
      headers={headers}
      rows={rows}
      onDelete={onDelete}
      tone={TONE}
    />
  );
}

export function ListRowCard({
  children,
  actions,
}: {
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <RoleListRow tone={TONE} actions={actions}>
      {children}
    </RoleListRow>
  );
}

export function fc() {
  return fieldInputClass();
}

export function toneLinkClass() {
  return roleLink(TONE);
}
