import type { Metadata } from 'next';
import { Providers } from '@/components/Providers';

export const metadata: Metadata = {
  title: 'Log in',
  description: 'Sign in to your SupplierAdvisor® company workspace.',
  robots: { index: false, follow: false },
  alternates: { canonical: 'https://www.supplieradvisor.com/login' },
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <Providers>{children}</Providers>;
}
