'use client';

import type { ReactNode } from 'react';
import { CompanyRequired as BaseCompanyRequired } from '@/components/business/BusinessShell';
import { RelationshipPage } from '@/components/relationship/RelationshipChrome';
import { GymDeskPwaBrand } from '@/components/fitness/GymDeskPwaBrand';

export function FitgraphRequired({ children }: { children: ReactNode }) {
  return (
    <BaseCompanyRequired>
      <GymDeskPwaBrand />
      {children}
    </BaseCompanyRequired>
  );
}

export function FitgraphPage({ children }: { children: ReactNode }) {
  return <RelationshipPage>{children}</RelationshipPage>;
}
