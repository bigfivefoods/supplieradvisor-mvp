import { isPublicTradeToken } from '@/lib/trades/tradegraph';

type Props = { params: Promise<{ token: string }> };

export async function GET(_request: Request, { params }: Props) {
  const { token } = await params;
  if (!isPublicTradeToken(token)) {
    return new Response('Not found', { status: 404 });
  }
  const start = `/customer/tradegraph/${encodeURIComponent(token)}`;
  const manifest = {
    name: 'TradeAdvisor',
    short_name: 'TradeAdvisor',
    description: 'Job progress, statement, and new requests.',
    start_url: `${start}?source=pwa`,
    scope: `${start}`,
    id: start,
    display: 'standalone',
    background_color: '#f8fafc',
    theme_color: '#00b4d8',
    icons: [
      { src: '/sa-icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/sa-icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/sa-icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/sa-icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
  return Response.json(manifest, {
    headers: {
      'Content-Type': 'application/manifest+json; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
