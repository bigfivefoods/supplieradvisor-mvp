import CrmPreviewClient from './preview-client';

export const dynamic = 'force-dynamic';

function one(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] || '' : value || '';
}

export default async function CrmPreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ screen?: string | string[]; id?: string | string[] }>;
}) {
  const params = await searchParams;
  const screen = one(params.screen) || 'hub';
  const id = Number(one(params.id) || 0);
  return <CrmPreviewClient screen={screen} initialId={Number.isFinite(id) ? id : 0} />;
}
