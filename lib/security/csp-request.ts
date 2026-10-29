import { buildContentSecurityPolicy, isEmbedDocumentPath } from '@/lib/security/csp-policy';
import { scriptHashesForPath } from '@/lib/security/csp-hash-map';
import { SERVICE_WORKER_BOOT_SCRIPT } from '@/lib/pwa/register-script';
import { THEME_BOOT_SCRIPT } from '@/lib/theme/theme';

/**
 * One enforced policy for this request.
 * Stable boot-script hashes cover the theme and service-worker tags, which
 * React 18 does not nonce. The build-time map covers cached Next.js inline
 * scripts. The nonce covers a dynamic render.
 * Do not add 'strict-dynamic': it would ignore 'self' and block the
 * parser-inserted Next.js chunks on cached pages.
 */
async function sha256Source(source: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(source));
  const bytes = new Uint8Array(digest);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return `'sha256-${btoa(binary)}'`;
}

/**
 * Playwright injects e2e/vendor/axe-core-4.10.2.min.js with addScriptTag.
 * The hash is those exact bytes (hex sha256 b511cd9dec01c76f4b2ad1723b66b6db37d4c2eb4ed199076e1829d9ee7b75e3).
 * A different file does not match.
 */
export const CSP_AXE_SCRIPT_HASH =
  "'sha256-tRHNnewBx29LKtFyO2a22zfUwutO0ZkHbhgp2e57deM='";

const stableInlineHashes = Promise.all([
  sha256Source(THEME_BOOT_SCRIPT),
  sha256Source(SERVICE_WORKER_BOOT_SCRIPT),
]);

export async function contentSecurityPolicyForRequest(
  pathname: string,
  nonce: string
): Promise<string> {
  const stable = await stableInlineHashes;
  return buildContentSecurityPolicy({
    nonce,
    embed: isEmbedDocumentPath(pathname),
    dev: process.env.NODE_ENV !== 'production',
    scriptHashes: [CSP_AXE_SCRIPT_HASH, ...stable, ...scriptHashesForPath(pathname)],
  });
}
