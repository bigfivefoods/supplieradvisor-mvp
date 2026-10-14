import { NextRequest, NextResponse } from 'next/server';
import { customerFromSession } from '@/lib/trades/customer-auth';
import { TRADE_SESSION_COOKIE } from '@/lib/trades/customer-session';
import { buildTradeIcs, customerPack, HARBOUR_NOW, type Book } from '@/lib/trades/desk';
import { seedHarbourBook } from '@/lib/trades/harbour-seed';
import { closedFeed, isSampleTradeToken, PRIVATE_NO_STORE } from '@/lib/trades/public-feeds';
import { companyIdByPublicToken, loadTradeBook, workspaceByIcsToken } from '@/lib/trades/tradegraph-db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export type IcsDeps = {
  workspaceByToken: (token: string) => Promise<{ companyId: number } | null>;
  workspaceByIcsToken: (icsToken: string) => Promise<{ companyId: number } | null>;
  loadTradeBook: (companyId: number) => Promise<Book | null>;
  customerFromSession: (
    token: string
  ) => Promise<{ companyId: number; customerId: string } | null>;
};

function defaultDeps(): IcsDeps {
  return {
    workspaceByToken: async (token) => {
      const companyId = await companyIdByPublicToken(token);
      return companyId ? { companyId } : null;
    },
    workspaceByIcsToken,
    loadTradeBook,
    customerFromSession,
  };
}

function icsResponse(body: string, privateFeed: boolean): NextResponse {
  const headers: Record<string, string> = {
    'Content-Type': 'text/calendar; charset=utf-8',
    'Content-Disposition': 'attachment; filename="tradeadvisor.ics"',
  };
  if (privateFeed) headers['Cache-Control'] = PRIVATE_NO_STORE;
  return new NextResponse(body, { headers });
}

function sampleIcs(): NextResponse {
  return icsResponse(buildTradeIcs(seedHarbourBook(HARBOUR_NOW)), false);
}

export async function handleTradeIcs(
  request: NextRequest,
  deps: IcsDeps = defaultDeps()
): Promise<NextResponse> {
  const token = String(request.nextUrl.searchParams.get('token') || '');
  const icsToken = String(
    request.nextUrl.searchParams.get('ics') || request.nextUrl.searchParams.get('ics_token') || ''
  );
  if (isSampleTradeToken(token)) return sampleIcs();
  try {
    if (icsToken) {
      const owner = await deps.workspaceByIcsToken(icsToken);
      if (!owner) return closedFeed(404);
      if (token) {
        const found = await deps.workspaceByToken(token);
        if (!found || found.companyId !== owner.companyId) return closedFeed(404);
      }
      const book = await deps.loadTradeBook(owner.companyId);
      if (!book) return closedFeed(404);
      return icsResponse(buildTradeIcs(book), true);
    }
    if (!token) return closedFeed(404);
    const found = await deps.workspaceByToken(token);
    if (!found) return closedFeed(404);
    const session = request.cookies.get(TRADE_SESSION_COOKIE)?.value || '';
    const who = session ? await deps.customerFromSession(session) : null;
    if (!who || who.companyId !== found.companyId) return closedFeed(404);
    const book = await deps.loadTradeBook(found.companyId);
    if (!book) return closedFeed(404);
    let schedule: Book['store']['schedule'];
    try {
      schedule = customerPack(book, who.customerId).schedule;
    } catch {
      return closedFeed(404);
    }
    return icsResponse(buildTradeIcs({ ...book, store: { ...book.store, schedule } }), true);
  } catch {
    return closedFeed(500);
  }
}

export function GET(request: NextRequest) {
  return handleTradeIcs(request);
}
