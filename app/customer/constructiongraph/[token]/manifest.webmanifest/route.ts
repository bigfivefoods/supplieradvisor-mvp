type Props = { params: Promise<{ token: string }> };

export async function GET(_request: Request, { params }: Props) {
  const { token } = await params;
  if (!token || token.length < 8 || token.includes('/') || token.includes('..')) {
    return new Response('Not found', { status: 404 });
  }
  const start = `/customer/constructiongraph/${encodeURIComponent(token)}`;
  return Response.json(
    {
      name: 'ConstructionAdvisor®',
      short_name: 'Construction',
      description: 'ConstructionAdvisor® project, plan, and wallet.',
      start_url: `${start}?source=pwa`,
      scope: start,
      id: start,
      display: 'standalone',
      background_color: '#f8fafc',
      theme_color: '#00b4d8',
      icons: [
        { src: '/construction/client-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: '/construction/client-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
        { src: '/construction/client-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
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
