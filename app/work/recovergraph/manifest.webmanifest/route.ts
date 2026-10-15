export function GET() {
  return Response.json(
    {
      name: 'RecoverAdvisor® owner',
      short_name: 'Owner',
      description: 'RecoverAdvisor® for the owner: the collections desk, queue, creditors, mandates, and team.',
      start_url: '/work/recovergraph?source=pwa',
      scope: '/work/recovergraph',
      id: '/work/recovergraph',
      display: 'standalone',
      background_color: '#f8fafc',
      theme_color: '#00b4d8',
      icons: [
        { src: '/recover/owner-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: '/recover/owner-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
        { src: '/recover/owner-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
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
