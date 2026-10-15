type Props = { params: Promise<{ token: string }> };

export async function GET(_request: Request, { params }: Props) {
  const { token } = await params;
  if (!token || token.length < 8 || token.includes('/') || token.includes('..')) {
    return new Response('Not found', { status: 404 });
  }
  const start = `/crew/recovergraph/${encodeURIComponent(token)}`;
  return Response.json(
    {
      name: 'RecoverAdvisor® workers',
      short_name: 'Workers',
      description: 'RecoverAdvisor® for collections agents: the assigned queue and the day’s work.',
      start_url: `${start}?source=pwa`,
      scope: start,
      id: start,
      display: 'standalone',
      background_color: '#f8fafc',
      theme_color: '#00b4d8',
      icons: [
        { src: '/recover/workers-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: '/recover/workers-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
        { src: '/recover/workers-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
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
