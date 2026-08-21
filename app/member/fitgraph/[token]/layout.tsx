import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import {
  advisorPwaPageMetadata,
  advisorPwaPageViewport,
  loadAdvisorPwaBrandFromPortalToken,
} from '@/lib/advisors/load-advisor-pwa';

async function readParams(
  params: { token: string } | Promise<{ token: string }>
) {
  return await params;
}

export async function generateMetadata({
  params,
}: {
  params: { token: string } | Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await readParams(params);
  const brand = await loadAdvisorPwaBrandFromPortalToken('fitgraph', token);
  return advisorPwaPageMetadata(brand);
}

export async function generateViewport({
  params,
}: {
  params: { token: string } | Promise<{ token: string }>;
}): Promise<Viewport> {
  const { token } = await readParams(params);
  const brand = await loadAdvisorPwaBrandFromPortalToken('fitgraph', token);
  return advisorPwaPageViewport(brand);
}

export default function GymMemberPwaLayout({ children }: { children: ReactNode }) {
  return children;
}
