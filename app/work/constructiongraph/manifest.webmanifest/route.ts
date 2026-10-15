export function GET() {
  return Response.json(
    {
      name: 'ConstructionAdvisor® owner',
      short_name: 'Owner',
      description: 'ConstructionAdvisor® for the whole business: projects, programme, money, variations, diary, and the team.',
      start_url: '/work/constructiongraph?source=pwa',
      scope: '/work/constructiongraph',
      id: '/work/constructiongraph',
      display: 'standalone',
      background_color: '#f8fafc',
      theme_color: '#00b4d8',
      icons: [
        { src: '/construction/owner-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: '/construction/owner-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
        { src: '/construction/owner-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
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
