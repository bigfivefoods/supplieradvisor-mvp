import type { Metadata } from 'next';
import { PreviewShell } from '@/components/construction/PreviewApp';

export const metadata: Metadata = {
  title: 'ConstructionAdvisor® sample',
  robots: { index: false, follow: false },
};

export default function PreviewConstructionLayout({ children }: { children: React.ReactNode }) {
  return <PreviewShell>{children}</PreviewShell>;
}
