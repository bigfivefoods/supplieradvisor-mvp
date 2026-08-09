/** @type {import('next').NextConfig} */
const nextConfig = {
  // Keep PDF extractors out of the Turbopack/webpack bundle so their
  // CJS/worker layout resolves correctly on the server.
  serverExternalPackages: ['unpdf', 'pdf-parse', 'pdfkit', 'xlsx'],
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
      {
        // Paystack Apple Pay: domain verification file must be application/text
        // https://paystack.com/docs/payments/apple-pay/
        source: '/.well-known/apple-developer-merchantid-domain-association',
        headers: [
          { key: 'Content-Type', value: 'application/text' },
          { key: 'Cache-Control', value: 'public, max-age=3600' },
        ],
      },
    ];
  },
  async redirects() {
    // Public company directory retired — permanent redirect to home
    return [
      {
        source: '/directory',
        destination: '/',
        permanent: true,
      },
      {
        source: '/directory/:path*',
        destination: '/',
        permanent: true,
      },
    ];
  },
};

module.exports = nextConfig;
