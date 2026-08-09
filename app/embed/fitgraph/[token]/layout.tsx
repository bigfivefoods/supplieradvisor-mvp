import type { ReactNode } from 'react';

export const metadata = {
  title: 'Class schedule',
  robots: 'noindex',
};

export default function EmbedFitgraphLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-white antialiased">{children}</div>
  );
}
