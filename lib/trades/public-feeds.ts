/**
 * TradeAdvisor® public quote PDF and calendar feeds.
 * Sample Harbour tokens stay open. A real book never answers from the public token alone.
 */
import { NextResponse } from 'next/server';
import { newSecret } from './customer-session';

export const PRIVATE_NO_STORE = 'private, no-store';

export function isSampleTradeToken(token: string): boolean {
  return token === 'demo' || token === 'tg_harbour';
}

/** 32 bytes → 64 hex chars (256 bits). The column requires at least 128 bits. */
export function newIcsToken(): string {
  return newSecret(32);
}

export function closedFeed(status: 401 | 404 | 500): NextResponse {
  return new NextResponse(null, {
    status,
    headers: { 'Cache-Control': PRIVATE_NO_STORE },
  });
}
