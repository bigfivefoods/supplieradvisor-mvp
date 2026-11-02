/** @type {import('next').NextConfig} */
const cspReportAbsoluteEndpoint = 'https://www.supplieradvisor.com/api/csp-report';
const cspReportGroup = 'csp-endpoint';
const cspReportToValue = `{"group":"${cspReportGroup}","max_age":10886400,"endpoints":[{"url":"${cspReportAbsoluteEndpoint}"}]}`;
const cspReportingEndpointsValue = `${cspReportGroup}="${cspReportAbsoluteEndpoint}"`;
const localePrefixes = ['fr', 'ar', 'pt', 'sw', 'zu'];
const translatedPaths = ['/', '/pricing'];
const translatedPathPattern = translatedPaths
  .map((path) => path.replace(/^\//, ''))
  .map((path) => (path ? `${path}/?$` : '$'))
  .join('|');

// The enforced CSP is set in middleware so a nonce and build-time script
// hashes can be attached per request. A second policy here would be ANDed
// with that header and would block the nonce'd scripts.
const nonEmbedSecurityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Report-To', value: cspReportToValue },
  { key: 'Reporting-Endpoints', value: cspReportingEndpointsValue },
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
    // Next 16.4 typechecks with `tsc` by default, which includes *.test.ts.
    // The previous checker skipped those files. Several unit tests (including
    // lib/fitness) already fail that stricter pass, and CI typechecks app code
    // separately via tsconfig.typecheck.json.
    useTypeScriptCli: false,
  },
  images: {
    // Hero sources are 1280px wide. Drop the 3840 slot so a 2x desktop
    // does not ask the optimizer for an upscaled frame.
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048],
    formats: ['image/webp'],
    // 75 keeps the hero. 60 is the below-fold customer-app frame.
    qualities: [60, 75],
    minimumCacheTTL: 60 * 60 * 24 * 30,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'onkklullmgrdqoertngp.supabase.co',
      },
    ],
  },
  async headers() {
    const longLived = [
      { key: 'Cache-Control', value: 'public, max-age=86400, stale-while-revalidate=604800' },
    ];
    const brandAssets = [
      '/marketing/:path*',
      '/sa-logo.png',
      '/sa-logo.jpg',
      '/sa-logo-tick.png',
      '/sa-updated-logo.jpg',
      '/sa-icon-192.png',
      '/sa-icon-512.png',
      '/apple-icon.png',
      '/og-image.png',
      '/favicon.ico',
      '/favicon-16x16.png',
      '/favicon-32x32.png',
    ];
    return [
      ...brandAssets.map((source) => ({ source, headers: longLived })),
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
        // Embed routes must stay framable on partner domains.
        // frame-ancestors * is set on the middleware CSP, not here.
        source: '/embed/:path*',
        headers: [
          { key: 'Report-To', value: cspReportToValue },
          { key: 'Reporting-Endpoints', value: cspReportingEndpointsValue },
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
        source: `/:locale(${localePrefixes.join('|')})/:path((?!${translatedPathPattern}).*)`,
        destination: '/:path',
        permanent: false,
      },
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
