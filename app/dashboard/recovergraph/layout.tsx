import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: {
    default: 'RecoverAdvisor®',
    template: '%s · RecoverAdvisor® · SupplierAdvisor',
  },
  description:
    'RecoverAdvisor® collections workspace — command centre, queue, creditors, mandates, team, and portals.',
  robots: { index: false, follow: false },
};

export default function RecoverAdvisorLayout({ children }: { children: React.ReactNode }) {
  return children;
}
