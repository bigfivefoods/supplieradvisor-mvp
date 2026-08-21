import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import {
  advisorPwaPageMetadata,
  advisorPwaPageViewport,
  loadAdvisorPwaBrand,
} from '@/lib/advisors/load-advisor-pwa';

export const revalidate = 60;

async function readParams(
  params:
    | { module: string; token: string }
    | Promise<{ module: string; token: string }>
) {
  return await params;
}

export async function generateMetadata({
  params,
}: {
  params:
    | { module: string; token: string }
    | Promise<{ module: string; token: string }>;
}): Promise<Metadata> {
  const { module, token } = await readParams(params);
  const brand = await loadAdvisorPwaBrand(module, token);
  return advisorPwaPageMetadata(brand);
}

export async function generateViewport({
  params,
}: {
  params:
    | { module: string; token: string }
    | Promise<{ module: string; token: string }>;
}): Promise<Viewport> {
  const { module, token } = await readParams(params);
  const brand = await loadAdvisorPwaBrand(module, token);
  return advisorPwaPageViewport(brand);
}

export default function AdvisorPwaLayout({ children }: { children: ReactNode }) {
  return children;
}
