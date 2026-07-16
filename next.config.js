/** @type {import('next').NextConfig} */
const nextConfig = {
  // Keep PDF extractors out of the Turbopack/webpack bundle so their
  // CJS/worker layout resolves correctly on the server.
  serverExternalPackages: ['unpdf', 'pdf-parse', 'pdfkit'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'onkklullmgrdqoertngp.supabase.co',
      },
    ],
  },
  async headers() {
    return [
      {
        // Service worker must not be long-cached or scoped incorrectly
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' },
          { key: 'Content-Type', value: 'application/javascript; charset=utf-8' },
        ],
      },
      {
        source: '/manifest.webmanifest',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' },
          {
            key: 'Content-Type',
            value: 'application/manifest+json; charset=utf-8',
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
