import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Container network',
  robots: { index: false, follow: false },
};

/**
 * Embed layout — minimal chrome for iframe on partner sites
 * (e.g. www.bigfivegroup.africa). No dashboard shell.
 */
export default function EmbedContainersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh bg-[#f8fafc] antialiased text-slate-900">
      {children}
    </div>
  );
}
