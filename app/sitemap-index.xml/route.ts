import { generateSitemaps } from '@/app/sitemap';
import { SITE_URL } from '@/lib/seo/site';

export async function GET() {
  const shards = await getSitemapShardIds();
  const body = buildSitemapIndexXml(shards);

  return new Response(body, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}

async function getSitemapShardIds(): Promise<number[]> {
  try {
    const items = await generateSitemaps();
    const ids = items
      .map((item) => Number(item.id))
      .filter((id) => Number.isFinite(id) && id >= 0);
    return ids.length > 0 ? ids : [0, 1];
  } catch {
    return [0, 1];
  }
}

function buildSitemapIndexXml(ids: number[]): string {
  const now = new Date().toISOString();
  const lines = ids.map(
    (id) =>
      `  <sitemap><loc>${SITE_URL}/sitemap/${id}.xml</loc><lastmod>${now}</lastmod></sitemap>`
  );

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...lines,
    '</sitemapindex>',
  ].join('\n');
}
