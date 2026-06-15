import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'SupplierAdvisor Dashboard',
  description: 'Business Network for Africa',
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}