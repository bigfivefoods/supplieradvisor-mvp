import { Providers } from '@/components/Providers';

export default function JoinMemberLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <Providers>{children}</Providers>;
}
