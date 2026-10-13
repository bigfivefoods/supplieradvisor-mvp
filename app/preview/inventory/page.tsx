import InventoryPreview from './preview-client';

export const dynamic = 'force-dynamic';

function one(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] || '' : value || '';
}

export default async function InventoryPreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ screen?: string | string[] }>;
}) {
  const params = await searchParams;
  return <InventoryPreview screen={one(params.screen) || 'hub'} />;
}
