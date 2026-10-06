/** @type {import('next').NextConfig} */
const cspReportOnlyValue =
  "default-src 'self'; script-src 'self' 'unsafe-inline' https:; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; connect-src 'self' https: wss:; frame-src https:; base-uri 'self'; form-action 'self'; object-src 'none'";

const nonEmbedSecurityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
  { key: 'Content-Security-Policy-Report-Only', value: cspReportOnlyValue },
];

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
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            // Google / Apple / Privy OAuth popups must keep window.opener
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin-allow-popups',
          },
        ],
      },
      {
        source: '/',
        headers: nonEmbedSecurityHeaders,
      },
      {
        source: '/((?!embed(?:/|$)).+)',
        headers: nonEmbedSecurityHeaders,
      },
      {
        source: '/embed/:path*',
        headers: [{ key: 'Content-Security-Policy', value: "frame-ancestors *" }],
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
        source: '/industries/staffing-recruitment',
        destination: '/industries/hire-rental',
        permanent: true,
      },
      {
        source: '/directory/:path*',
        destination: '/',
        permanent: true,
      },
    ];
  },
  async rewrites() {
    return {
      beforeFiles: [
        {
          source: '/sitemap.xml',
          destination: '/sitemap-index.xml',
        },
      ],
    };
  },
};

module.exports = nextConfig;
