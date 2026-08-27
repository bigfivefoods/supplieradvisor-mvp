import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import {
  advisorPwaPageMetadata,
  advisorPwaPageViewport,
  loadAdvisorPwaBrand,
} from '@/lib/advisors/load-advisor-pwa';

async function readToken(
  params: { token: string } | Promise<{ token: string }>
) {
  const { token } = await params;
  return String(token || '').trim();
}

export async function generateMetadata({
  params,
}: {
  params: { token: string } | Promise<{ token: string }>;
}): Promise<Metadata> {
  const token = await readToken(params);
  const brand = await loadAdvisorPwaBrand('fitgraph', token);
  return advisorPwaPageMetadata(brand);
}

export async function generateViewport({
  params,
}: {
  params: { token: string } | Promise<{ token: string }>;
}): Promise<Viewport> {
  const token = await readToken(params);
  const brand = await loadAdvisorPwaBrand('fitgraph', token);
  return advisorPwaPageViewport(brand);
}

export default function GymPublicSiteLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-white antialiased">{children}</div>
  );
}
