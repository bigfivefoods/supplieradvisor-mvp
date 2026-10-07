/** @type {import('next').NextConfig} */
const cspReportEndpoint = '/api/csp-report';
const cspReportGroup = 'csp-endpoint';
const cspReportToValue = `{"group":"${cspReportGroup}","max_age":10886400,"endpoints":[{"url":"${cspReportEndpoint}"}]}`;

const cspScriptHosts = [
  'https://va.vercel-scripts.com',
  'https://maps.googleapis.com',
  'https://maps.gstatic.com',
  'https://js.paystack.co',
  'https://auth.privy.io',
  'https://*.privy.io',
  'https://*.privy.systems',
  'https://*.walletconnect.com',
  'https://*.walletconnect.org',
  'https://challenges.cloudflare.com',
];

const cspFrameHosts = [
  'https://auth.privy.io',
  'https://*.privy.io',
  'https://*.privy.systems',
  'https://verify.walletconnect.com',
  'https://verify.walletconnect.org',
  'https://*.walletconnect.com',
  'https://*.walletconnect.org',
  'https://checkout.paystack.com',
  'https://www.youtube.com',
  'https://www.youtube-nocookie.com',
  'https://player.vimeo.com',
  'https://maps.googleapis.com',
  'https://maps.google.com',
];

const cspReportOnlyConnectHosts = [
  "'self'",
  'https://onkklullmgrdqoertngp.supabase.co',
  'wss://onkklullmgrdqoertngp.supabase.co',
  'https://auth.privy.io',
  'https://*.privy.io',
  'https://*.privy.systems',
  'wss://*.privy.io',
  'wss://*.privy.systems',
  'https://*.walletconnect.com',
  'https://*.walletconnect.org',
  'https://relay.walletconnect.com',
  'https://relay.walletconnect.org',
  'wss://relay.walletconnect.com',
  'wss://relay.walletconnect.org',
  'https://maps.googleapis.com',
  'https://maps.gstatic.com',
  'https://js.paystack.co',
  'https://checkout.paystack.com',
  'https://va.vercel-scripts.com',
  'https://vitals.vercel-insights.com',
  'https://vitals.vercel-analytics.com',
  'https://challenges.cloudflare.com',
];

function buildCspValue({
  frameAncestors,
  connectSrc,
}) {
  return [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline' ${cspScriptHosts.join(' ')}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    `connect-src ${connectSrc.join(' ')}`,
    `frame-src ${cspFrameHosts.join(' ')}`,
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    `report-uri ${cspReportEndpoint}`,
    `report-to ${cspReportGroup}`,
    frameAncestors,
    'upgrade-insecure-requests',
  ].join('; ');
}

const enforcedNonEmbedCsp = buildCspValue({
  frameAncestors: "frame-ancestors 'none'",
  connectSrc: ["'self'", 'https:', 'wss:'],
});

const reportOnlyNonEmbedCsp = buildCspValue({
  frameAncestors: "frame-ancestors 'none'",
  connectSrc: cspReportOnlyConnectHosts,
});

const embedCsp = buildCspValue({
  // Brief 70/98: embed surfaces are intentionally open-framable by partner sites.
  // Risk accepted for public embeds: this is intentionally wider than fixed-origin framing.
  frameAncestors: "frame-ancestors *",
  connectSrc: ["'self'", 'https:', 'wss:'],
});

const nonEmbedSecurityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Report-To', value: cspReportToValue },
  { key: 'Content-Security-Policy', value: enforcedNonEmbedCsp },
  { key: 'Content-Security-Policy-Report-Only', value: reportOnlyNonEmbedCsp },
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
        // Embed routes must stay framable on partner domains.
        source: '/embed/:path*',
        headers: [
          { key: 'Report-To', value: cspReportToValue },
          { key: 'Content-Security-Policy', value: embedCsp },
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
