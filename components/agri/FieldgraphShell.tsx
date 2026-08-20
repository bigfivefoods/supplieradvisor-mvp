'use client';

import type { ReactNode } from 'react';
import {
  CompanyRequired as BaseCompanyRequired,
} from '@/components/business/BusinessShell';
import { RelationshipPage } from '@/components/relationship/RelationshipChrome';

export function FieldgraphRequired({ children }: { children: ReactNode }) {
  return <BaseCompanyRequired>{children}</BaseCompanyRequired>;
}

export function FieldgraphPage({ children }: { children: ReactNode }) {
  return <RelationshipPage>{children}</RelationshipPage>;
}
