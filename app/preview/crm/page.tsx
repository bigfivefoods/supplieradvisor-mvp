import CrmPreviewClient from './preview-client';
import { cardQueryFromParams, sortFromParams } from '@/lib/relationship/card-filter';

export const dynamic = 'force-dynamic';

function one(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] || '' : value || '';
}

export default async function CrmPreviewPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const flat = new URLSearchParams();
  for (const key of ['q', 'status', 'region', 'industry', 'band', 'compliance', 'sort', 'id', 'screen']) {
    const text = one(params[key]);
    if (text) flat.set(key, text);
  }
  const screen = flat.get('screen') || 'hub';
  const id = Number(flat.get('id') || 0);
  return (
    <CrmPreviewClient
      screen={screen}
      initialId={Number.isFinite(id) ? id : 0}
      query={cardQueryFromParams(flat)}
      sort={sortFromParams(flat, ['name', 'city', 'status'])}
    />
  );
}
