import { PreviewWork } from '@/components/trades/PreviewWork';

type Query = Record<string, string | string[] | undefined>;

function one(query: Query, key: string): string {
  const value = query[key];
  return Array.isArray(value) ? value[0] || '' : value || '';
}

export default async function PreviewWorkPage({ searchParams }: { searchParams: Promise<Query> }) {
  const query = await searchParams;
  return <PreviewWork role={one(query, 'role')} memberId={one(query, 'member')} />;
}
