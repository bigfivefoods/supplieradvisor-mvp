import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { isPublicApiPath } from '@/lib/auth/public-paths';

/**
 * Edge middleware — security headers + coarse API gate.
 *
 * Full JWT verification runs in Node route handlers (lib/auth/verify-privy.ts)
 * because Privy JWKS verification is more reliable in the Node runtime.
 * Here we only reject clearly unauthenticated API calls in production when
 * AUTH_STRICT is not disabled, so anonymous scanners get 401 early.
 *
 * Public prefixes (health, fx, webhooks, public listings) are allowed through.
 */
export function middleware(request: NextRequest) {
  const response = NextResponse.next();
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(self)'
  );

  const { pathname } = request.nextUrl;

  // Coarse API gate: production requires some credential signal
  if (pathname.startsWith('/api/')) {
    if (isPublicApiPath(pathname)) {
      return response;
    }
    // SAM lightweight health (GET only) — used by messenger badge
    if (pathname === '/api/sam/chat' && request.method === 'GET') {
      return response;
    }
    // Cron / provider webhooks use their own secrets (Paystack path is /webhook singular)
    if (
      pathname.includes('/cron') ||
      pathname.includes('/webhook') ||
      request.headers.get('x-cron-secret')
    ) {
      return response;
    }

    const strictEnv = process.env.AUTH_STRICT;
    const strict =
      strictEnv === undefined || strictEnv === ''
        ? process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production'
        : !['0', 'false', 'no', 'off'].includes(String(strictEnv).toLowerCase());

    if (strict) {
      const auth = request.headers.get('authorization') || '';
      const cookie = request.headers.get('cookie') || '';
      const hasBearer = /^Bearer\s+\S{20,}/i.test(auth);
      const hasPrivyCookie = /(?:^|;\s*)privy-token=/.test(cookie);
      if (!hasBearer && !hasPrivyCookie) {
        return NextResponse.json(
          {
            error:
              'Authentication required. Send Authorization: Bearer <Privy access token>.',
            code: 'UNAUTHORIZED',
          },
          { status: 401 }
        );
      }
    }
  }

  return response;
}

export const config = {
  matcher: ['/dashboard/:path*', '/api/:path*', '/sales/:path*', '/contractor/:path*'],
};
