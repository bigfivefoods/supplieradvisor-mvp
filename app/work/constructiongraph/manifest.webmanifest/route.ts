export function GET() {
  return Response.json(
    {
      name: 'ConstructionAdvisor®',
      short_name: 'Construction',
      description: 'ConstructionAdvisor® site diary, snags, and programme.',
      start_url: '/work/constructiongraph?source=pwa',
      scope: '/work/constructiongraph',
      id: '/work/constructiongraph',
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
        'Cache-Control': 'public, max-age=3600',
      },
    }
  );
}
