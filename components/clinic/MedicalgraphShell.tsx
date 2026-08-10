'use client';

import type { ReactNode } from 'react';
import { CompanyRequired as BaseCompanyRequired } from '@/components/business/BusinessShell';

export function MedicalgraphRequired({ children }: { children: ReactNode }) {
  return <BaseCompanyRequired>{children}</BaseCompanyRequired>;
}

export function MedicalgraphPage({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">{children}</div>
  );
}
