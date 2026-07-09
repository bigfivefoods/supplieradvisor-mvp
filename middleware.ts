import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Edge middleware.
 *
 * Auth is enforced client-side via Privy (see components/AuthGate.tsx) because
 * Privy sessions are primarily browser-based unless cookie auth is fully configured.
 * This middleware is reserved for security headers and future server-side checks.
 */
export function middleware(_request: NextRequest) {
  const response = NextResponse.next();
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  return response;
}

export const config = {
  matcher: ['/dashboard/:path*', '/api/:path*'],
};
