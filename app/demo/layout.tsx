import { blockFixtureRoutes } from '@/lib/preview/production-gate';

export default function DemoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  blockFixtureRoutes();
  return children;
}
