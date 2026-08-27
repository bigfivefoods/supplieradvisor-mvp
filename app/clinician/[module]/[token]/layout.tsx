import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import {
  generateAdvisorPortalTokenMetadata,
  generateAdvisorPortalTokenViewport,
} from '@/lib/advisors/load-advisor-pwa';
import { isAdvisorPwaModule } from '@/lib/advisors/member-pwa';

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
  if (!isAdvisorPwaModule(module)) {
    return { title: 'Work app', robots: 'noindex' };
  }
  return generateAdvisorPortalTokenMetadata(module, { token });
}

export async function generateViewport({
  params,
}: {
  params:
    | { module: string; token: string }
    | Promise<{ module: string; token: string }>;
}): Promise<Viewport> {
  const { module, token } = await readParams(params);
  if (!isAdvisorPwaModule(module)) {
    return { themeColor: '#0f172a', width: 'device-width', initialScale: 1 };
  }
  return generateAdvisorPortalTokenViewport(module, { token });
}

export default function ClinicianWorkLayout({ children }: { children: ReactNode }) {
  return children;
}
