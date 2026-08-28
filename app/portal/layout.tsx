import { Providers } from '@/components/Providers';

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <Providers>{children}</Providers>;
}
