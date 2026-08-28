import { Providers } from '@/components/Providers';

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <Providers>{children}</Providers>;
}
