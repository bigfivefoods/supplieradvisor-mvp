import SheqPreview from './preview-client';

export const dynamic = 'force-dynamic';

function one(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] || '' : value || '';
}

export default async function SheqPreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ screen?: string | string[] }>;
}) {
  const params = await searchParams;
  return <SheqPreview screen={one(params.screen) || 'hub'} />;
}
