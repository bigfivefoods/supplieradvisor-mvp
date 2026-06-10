import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith('/dashboard')) {
    // Privy session check (simple cookie-based for now – can be enhanced with Privy server SDK)
    const privyToken = request.cookies.get('privy-token') || request.cookies.get('privy-session');
    if (!privyToken) {
      return NextResponse.redirect(new URL('/onboarding', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*']
};