'use client';

import type { ReactNode } from 'react';
import { CompanyRequired as BaseCompanyRequired } from '@/components/business/BusinessShell';
import {
  RelationshipHeader,
  RelationshipPage,
} from '@/components/relationship/RelationshipChrome';

export function RetailgraphRequired({ children }: { children: ReactNode }) {
  return <BaseCompanyRequired>{children}</BaseCompanyRequired>;
}

export function RetailgraphPage({
  title,
  description,
  children,
}: {
  title?: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <RelationshipPage>
      {title ? (
        <RelationshipHeader
          eyebrow="RetailAdvisor®"
          title={title}
          description={description}
        />
      ) : null}
      {children}
    </RelationshipPage>
  );
}
