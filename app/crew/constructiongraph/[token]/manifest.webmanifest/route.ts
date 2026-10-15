type Props = { params: Promise<{ token: string }> };

export async function GET(_request: Request, { params }: Props) {
  const { token } = await params;
  if (!token || token.length < 8 || token.includes('/') || token.includes('..')) {
    return new Response('Not found', { status: 404 });
  }
  const start = `/crew/constructiongraph/${encodeURIComponent(token)}`;
  return Response.json(
    {
      name: 'ConstructionAdvisor® workers',
      short_name: 'Workers',
      description: 'ConstructionAdvisor® today, diary, snags, and time.',
      start_url: `${start}?source=pwa`,
      scope: start,
      id: start,
      display: 'standalone',
      background_color: '#f8fafc',
      theme_color: '#00b4d8',
      icons: [
        { src: '/construction/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: '/construction/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
        { src: '/construction/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    },
    {
      headers: {
        'Content-Type': 'application/manifest+json; charset=utf-8',
        'Cache-Control': 'private, no-store',
      },
    }
  );
}
