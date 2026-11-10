import type { ReactNode } from 'react';
import LandingNav from '@/components/marketing/LandingNav';
import SiteFooter from '@/components/marketing/SiteFooter';
import { interactiveDemoHref } from '@/lib/preview/production-gate';

export default function MarketingPageShell({ title, intro, children }: { title: string; intro?: string; children: ReactNode }) {
  const demoHref = interactiveDemoHref();
  return (
    <div className="min-h-dvh bg-[#f8fafc] text-slate-900">
      <LandingNav demoHref={demoHref} />
      <main className="py-16">
        <div className="mx-auto max-w-screen-2xl px-4 sm:px-6 lg:px-10">
          <h1 className="text-4xl font-black tracking-tight sm:text-5xl">{title}</h1>
          {intro ? <p className="mt-4 max-w-3xl text-lg text-slate-600">{intro}</p> : null}
        </div>
        <div className="mt-10 space-y-10">{children}</div>
      </main>
      <SiteFooter demoHref={demoHref} />
    </div>
  );
}
