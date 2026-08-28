import { Providers } from '@/components/Providers';

export default function MemberLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <Providers>{children}</Providers>;
}
