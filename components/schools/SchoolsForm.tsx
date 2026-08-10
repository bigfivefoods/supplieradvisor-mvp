'use client';

/**
 * NSNP / DBE form surfaces — process role tones:
 * dbe (sky) · school (emerald) · sp (amber)
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

export type SchoolsFormTone = 'dbe' | 'school' | 'sp';

export function StatRow({
  items,
  tone = 'school',
}: {
  items: Array<{ label: string; value: string | number }>;
  tone?: SchoolsFormTone;
}) {
  return <RoleStatRow items={items} tone={tone} />;
}

export function FormCard({
  title,
  children,
  onSubmit,
  saving,
  submitLabel = 'Save',
  tone = 'school',
  description,
}: {
  title: string;
  children: ReactNode;
  onSubmit: () => void;
  saving: boolean;
  submitLabel?: string;
  tone?: SchoolsFormTone;
  description?: string;
}) {
  return (
    <RoleFormCard
      title={title}
      onSubmit={onSubmit}
      saving={saving}
      submitLabel={submitLabel}
      tone={tone}
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
  tone = 'school',
}: {
  headers: string[];
  rows: Array<{ id: string; cells: Array<string | number | ReactNode> }>;
  onDelete?: (id: string) => void;
  tone?: SchoolsFormTone;
}) {
  return (
    <RoleDataTable
      headers={headers}
      rows={rows}
      onDelete={onDelete}
      tone={tone}
    />
  );
}

export function ListRowCard({
  tone = 'school',
  children,
  actions,
}: {
  tone?: SchoolsFormTone;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <RoleListRow tone={tone} actions={actions}>
      {children}
    </RoleListRow>
  );
}

export function SurfaceCard({
  tone = 'school',
  children,
  className,
}: {
  tone?: SchoolsFormTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <RoleSurface tone={tone} className={className}>
      {children}
    </RoleSurface>
  );
}

export function fc() {
  return fieldInputClass();
}

export function toneLinkClass(tone: SchoolsFormTone = 'school') {
  return roleLink(tone);
}

export function toneTitleClass(tone: SchoolsFormTone = 'school') {
  return roleTitle(tone);
}
