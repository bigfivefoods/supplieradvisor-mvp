/** @type {import('next').NextConfig} */
const nextConfig = {
  // Keep PDF extractors out of the Turbopack/webpack bundle so their
  // CJS/worker layout resolves correctly on the server.
  serverExternalPackages: [
    'unpdf',
    'pdf-parse',
    'pdfkit',
    'xlsx',
    'sharp',
    'undici',
  ],
  experimental: {
    optimizePackageImports: ['lucide-react', 'framer-motion'],
  },
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
        // Allow Payment Request API (Apple Pay) site-wide on HTTPS
        source: '/:path*',
        headers: [
          {
            key: 'Permissions-Policy',
            value:
              'camera=(), microphone=(), geolocation=(self), payment=(self), identity-credentials-get=*, publickey-credentials-get=(self), otp-credentials=(self)',
          },
          {
            // Google / Apple / Privy OAuth popups must keep window.opener
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin-allow-popups',
          },
        ],
      },
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
        source: '/api/public/advisor-pwa/manifest',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=60, stale-while-revalidate=600' },
          {
            key: 'Content-Type',
            value: 'application/manifest+json; charset=utf-8',
          },
        ],
      },
      {
        source: '/api/public/advisor-pwa/icon',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=300, stale-while-revalidate=3600' },
          { key: 'Content-Type', value: 'image/png' },
        ],
      },
      {
        source: '/api/public/advisor-pwa/og',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=60, stale-while-revalidate=600' },
          { key: 'Content-Type', value: 'image/png' },
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
