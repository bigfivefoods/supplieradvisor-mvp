import { Providers } from '@/components/Providers';

export default function JoinClaimLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <Providers>{children}</Providers>;
}
