'use client';

import type { ReactNode } from 'react';
import { CompanyRequired as BaseCompanyRequired } from '@/components/business/BusinessShell';

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
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      {title ? (
        <div className="mb-5">
          <p className="text-[10px] font-black uppercase tracking-widest text-orange-700">
            RetailAdvisor®
          </p>
          <h1 className="text-2xl font-black tracking-tight text-slate-900">
            {title}
          </h1>
          {description ? (
            <p className="mt-1 max-w-2xl text-sm text-slate-600">{description}</p>
          ) : null}
        </div>
      ) : null}
      {children}
    </div>
  );
}
