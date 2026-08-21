import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import {
  generateAdvisorPortalTokenMetadata,
  generateAdvisorPortalTokenViewport,
} from '@/lib/advisors/load-advisor-pwa';

export async function generateMetadata({
  params,
}: {
  params: { token: string } | Promise<{ token: string }>;
}): Promise<Metadata> {
  return generateAdvisorPortalTokenMetadata('psychiatrygraph', params);
}

export async function generateViewport({
  params,
}: {
  params: { token: string } | Promise<{ token: string }>;
}): Promise<Viewport> {
  return generateAdvisorPortalTokenViewport('psychiatrygraph', params);
}

export default function PsychiatryMemberPwaLayout({
  children,
}: {
  children: ReactNode;
}) {
  return children;
}
