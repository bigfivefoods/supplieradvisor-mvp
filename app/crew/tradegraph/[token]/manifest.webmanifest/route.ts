type Props = { params: Promise<{ token: string }> };

export async function GET(_request: Request, { params }: Props) {
  const { token } = await params;
  const start = `/crew/tradegraph/${encodeURIComponent(token)}`;
  return Response.json(
    {
      name: 'TradeAdvisor work',
      short_name: 'Trade work',
      description: 'Today’s jobs, diary, and site clock.',
      start_url: `${start}?source=pwa`,
      scope: start,
      id: start,
      display: 'standalone',
      background_color: '#f8fafc',
      theme_color: '#0077b6',
      icons: [
        { src: '/sa-icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: '/sa-icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
      ],
    },
    { headers: { 'Content-Type': 'application/manifest+json; charset=utf-8', 'Cache-Control': 'public, max-age=3600' } }
  );
}
