import { NextRequest, NextResponse } from 'next/server';
import { requireCompanyAccess } from '@/lib/auth/api-auth';
import { customerFromSession } from '@/lib/trades/customer-auth';
import { TRADE_SESSION_COOKIE } from '@/lib/trades/customer-session';
import { customerPack, HARBOUR_NOW, type Book } from '@/lib/trades/desk';
import { seedHarbourBook } from '@/lib/trades/harbour-seed';
import { closedFeed, isSampleTradeToken, PRIVATE_NO_STORE } from '@/lib/trades/public-feeds';
import { buildQuotePdf } from '@/lib/trades/quote-pdf';
import { companyIdByPublicToken, loadTradeBook } from '@/lib/trades/tradegraph-db';
import type { TradeCustomer, TradeQuote } from '@/lib/trades/tradegraph';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export type QuotePdfDeps = {
  workspaceByToken: (token: string) => Promise<{ companyId: number } | null>;
  loadTradeBook: (companyId: number) => Promise<Book | null>;
  customerFromSession: (
    token: string
  ) => Promise<{ companyId: number; customerId: string } | null>;
  deskMember: (request: NextRequest, companyId: number) => Promise<boolean>;
};

function defaultDeps(): QuotePdfDeps {
  return {
    workspaceByToken: async (token) => {
      const companyId = await companyIdByPublicToken(token);
      return companyId ? { companyId } : null;
    },
    loadTradeBook,
    customerFromSession,
    deskMember: async (request, companyId) => {
      const gate = await requireCompanyAccess(request, companyId);
      return gate.ok;
    },
  };
}

function sampleQuotePdf(quoteId: string): Promise<NextResponse> | NextResponse {
  const book = seedHarbourBook(HARBOUR_NOW);
  const quote =
    book.store.quotes.find((row) => row.id === quoteId) ||
    book.store.quotes.find((row) => row.status !== 'draft');
  const customer = quote ? book.store.customers.find((row) => row.id === quote.customer_id) : null;
  if (!quote || !customer || quote.status === 'draft') {
    return NextResponse.json({ error: 'That quote is not available' }, { status: 404 });
  }
  return pdfResponse(book, customer, quote, false);
}

async function pdfResponse(
  book: Book,
  customer: TradeCustomer,
  quote: TradeQuote,
  privateFeed: boolean
): Promise<NextResponse> {
  const pdf = await buildQuotePdf({ settings: book.store.settings, customer, quote });
  const headers: Record<string, string> = {
    'Content-Type': 'application/pdf',
    'Content-Disposition': `inline; filename="${quote.number}.pdf"`,
  };
  if (privateFeed) headers['Cache-Control'] = PRIVATE_NO_STORE;
  return new NextResponse(new Uint8Array(pdf), { headers });
}

export async function handleQuotePdf(
  request: NextRequest,
  deps: QuotePdfDeps = defaultDeps()
): Promise<NextResponse> {
  const token = String(request.nextUrl.searchParams.get('token') || '');
  const quoteId = String(request.nextUrl.searchParams.get('quote') || '');
  if (isSampleTradeToken(token)) return sampleQuotePdf(quoteId);
  try {
    if (!token) return closedFeed(404);
    const found = await deps.workspaceByToken(token);
    if (!found) return closedFeed(404);
    const session = request.cookies.get(TRADE_SESSION_COOKIE)?.value || '';
    const who = session ? await deps.customerFromSession(session) : null;
    const customerOk = Boolean(who && who.companyId === found.companyId);
    let desk = false;
    if (!customerOk) {
      desk = await deps.deskMember(request, found.companyId);
      if (!desk) return closedFeed(401);
    }
    const book = await deps.loadTradeBook(found.companyId);
    if (!book) return closedFeed(404);
    if (customerOk && who && quoteId) {
      try {
        const pack = customerPack(book, who.customerId);
        const quote = pack.quotes.find((row) => row.id === quoteId);
        const customer = quote
          ? book.store.customers.find((row) => row.id === quote.customer_id)
          : null;
        if (quote && customer && quote.status !== 'draft') {
          return pdfResponse(book, customer, quote, true);
        }
      } catch {
        /* A session whose customer is not on the book falls through to the desk check. */
      }
    }
    if (!desk) desk = await deps.deskMember(request, found.companyId);
    if (desk) {
      if (!quoteId) return closedFeed(404);
      const quote = book.store.quotes.find((row) => row.id === quoteId);
      const customer = quote
        ? book.store.customers.find((row) => row.id === quote.customer_id)
        : null;
      if (!quote || !customer) return closedFeed(404);
      return pdfResponse(book, customer, quote, true);
    }
    return closedFeed(404);
  } catch {
    return closedFeed(500);
  }
}

export function GET(request: NextRequest) {
  return handleQuotePdf(request);
}
