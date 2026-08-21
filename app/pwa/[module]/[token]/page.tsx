import { notFound } from 'next/navigation';
import { loadAdvisorPwaBrand } from '@/lib/advisors/load-advisor-pwa';
import { AdvisorPwaLauncher } from '@/components/advisors/AdvisorPwaLauncher';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function readParams(
  params:
    | { module: string; token: string }
    | Promise<{ module: string; token: string }>
) {
  return await params;
}

export default async function AdvisorPwaPage({
  params,
}: {
  params:
    | { module: string; token: string }
    | Promise<{ module: string; token: string }>;
}) {
  const { module, token } = await readParams(params);
  const brand = await loadAdvisorPwaBrand(module, token);
  if (!brand) notFound();
  return <AdvisorPwaLauncher brand={brand} />;
}
