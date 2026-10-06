import type { Metadata } from 'next';
import DashboardLayoutClient from '@/app/dashboard/DashboardLayoutClient';

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <DashboardLayoutClient>{children}</DashboardLayoutClient>;
}
