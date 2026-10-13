import SrmPreviewClient from './preview-client';

export const dynamic = 'force-dynamic';

function one(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] || '' : value || '';
}

export default async function SrmPreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string | string[] }>;
}) {
  const params = await searchParams;
  const id = Number(one(params.id) || 0);
  return <SrmPreviewClient initialId={Number.isFinite(id) ? id : 0} />;
}
