/**
 * Enforced Content-Security-Policy for SupplierAdvisor® documents.
 * script-src uses a per-request nonce and build-time script hashes.
 * It does not include 'unsafe-inline'. style-src still allows inline
 * styles because the public pages and Privy set style attributes.
 */

export const CSP_SCRIPT_HOSTS = [
  'https://va.vercel-scripts.com',
  'https://maps.googleapis.com',
  'https://maps.gstatic.com',
  'https://js.paystack.co',
  'https://applepay.cdn-apple.com',
  'https://pay.google.com',
  'https://auth.privy.io',
  'https://*.privy.io',
  'https://*.privy.systems',
  'https://*.walletconnect.com',
  'https://*.walletconnect.org',
  'https://challenges.cloudflare.com',
] as const;

export const CSP_FRAME_HOSTS = [
  'https://auth.privy.io',
  'https://*.privy.io',
  'https://*.privy.systems',
  'https://verify.walletconnect.com',
  'https://verify.walletconnect.org',
  'https://*.walletconnect.com',
  'https://*.walletconnect.org',
  'https://checkout.paystack.com',
  'https://pay.google.com',
  'https://www.youtube.com',
  'https://www.youtube-nocookie.com',
  'https://player.vimeo.com',
  'https://maps.googleapis.com',
  'https://maps.google.com',
] as const;

const NONCE_TOKEN = /^[A-Za-z0-9+/_-]+={0,2}$/;
const HASH_SOURCE = /^'sha256-[A-Za-z0-9+/]+=*'$/;

export function isEmbedDocumentPath(pathname: string): boolean {
  return pathname === '/embed' || pathname.startsWith('/embed/');
}

export function buildContentSecurityPolicy(options: {
  nonce: string;
  scriptHashes?: readonly string[];
  embed: boolean;
  dev?: boolean;
}): string {
  const nonce = String(options.nonce || '').trim();
  if (!NONCE_TOKEN.test(nonce)) {
    throw new Error('CSP nonce must be a single token');
  }

  const hashes = Array.from(
    new Set(
      (options.scriptHashes || []).filter(
        (hash): hash is string => typeof hash === 'string' && HASH_SOURCE.test(hash)
      )
    )
  );

  const scriptSrc = [
    "'self'",
    `'nonce-${nonce}'`,
    ...hashes,
    ...(options.dev ? ["'unsafe-eval'"] : []),
    ...CSP_SCRIPT_HOSTS,
  ];
  if (scriptSrc.some((token) => token.includes('unsafe-inline'))) {
    throw new Error("script-src must not include 'unsafe-inline'");
  }

  return [
    "default-src 'self'",
    `script-src ${scriptSrc.join(' ')}`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' data: https://fonts.gstatic.com https://fonts.walletconnect.com https://fonts.reown.com https://applepay.cdn-apple.com",
    "img-src 'self' data: blob: https:",
    "connect-src 'self' https: wss:",
    `frame-src ${CSP_FRAME_HOSTS.join(' ')}`,
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    'report-uri /api/csp-report',
    'report-to csp-endpoint',
    options.embed ? 'frame-ancestors *' : "frame-ancestors 'none'",
    'upgrade-insecure-requests',
  ].join('; ');
}
