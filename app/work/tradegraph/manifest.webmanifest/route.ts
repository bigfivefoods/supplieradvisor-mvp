export function GET() {
  return Response.json(
    {
      name: 'TradeAdvisor work',
      short_name: 'Trade work',
      description: 'Jobs, diary, and money for the trade business.',
      start_url: '/work/tradegraph?source=pwa',
      scope: '/work/tradegraph',
      id: '/work/tradegraph',
      display: 'standalone',
      background_color: '#f8fafc',
      theme_color: '#00b4d8',
      icons: [
        { src: '/sa-icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: '/sa-icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
      ],
    },
    { headers: { 'Content-Type': 'application/manifest+json; charset=utf-8', 'Cache-Control': 'public, max-age=3600' } }
  );
}
