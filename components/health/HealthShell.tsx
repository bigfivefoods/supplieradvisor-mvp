'use client';

import {
  CompanyGate,
  RelationshipHeader,
  RelationshipPage,
} from '@/components/relationship/RelationshipChrome';

export function CompanyRequired({ children }: { children: React.ReactNode }) {
  return <CompanyGate noun="Health / DoH">{children}</CompanyGate>;
}

export function HealthHeader({
  title,
  description,
  action,
  titleAccent,
  mode = 'facility',
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  titleAccent?: string;
  mode?: 'facility' | 'agency' | 'isp';
}) {
  const eyebrow =
    mode === 'agency'
      ? 'DoH · Health programme'
      : mode === 'isp'
        ? 'SP · Health supply'
        : 'Facility · Clinic / hospital';

  return (
    <RelationshipHeader
      backHref="/dashboard/health"
      backLabel="Health command"
      eyebrow={eyebrow}
      title={title}
      titleAccent={titleAccent}
      description={description}
      action={action}
    />
  );
}

export function HealthPage({ children }: { children: React.ReactNode }) {
  return <RelationshipPage>{children}</RelationshipPage>;
}
