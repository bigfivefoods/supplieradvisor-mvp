import type { Metadata } from 'next';
import { PreviewShell } from '@/components/recovery/PreviewDesk';

export const metadata: Metadata = {
  title: 'RecoverAdvisor® sample',
  robots: { index: false, follow: false },
};

export default function PreviewRecoverLayout({ children }: { children: React.ReactNode }) {
  return <PreviewShell>{children}</PreviewShell>;
}
