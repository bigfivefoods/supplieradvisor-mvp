import { NextRequest, NextResponse } from 'next/server';
import { HARBOUR_NOW } from '@/lib/trades/desk';
import { seedHarbourBook } from '@/lib/trades/harbour-seed';
import { buildQuotePdf } from '@/lib/trades/quote-pdf';
import { loadTradeBook, workspaceByToken } from '@/lib/trades/tradegraph-db';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const token = String(request.nextUrl.searchParams.get('token') || '');
  const quoteId = String(request.nextUrl.searchParams.get('quote') || '');
  let book = token === 'demo' || token === 'tg_harbour' ? seedHarbourBook(HARBOUR_NOW) : null;
  if (!book && token) {
    const found = await workspaceByToken(token);
    if (found) book = await loadTradeBook(found.companyId);
  }
  const quote = book?.store.quotes.find((row) => row.id === quoteId) || book?.store.quotes.find((row) => row.status !== 'draft');
  const customer = quote ? book?.store.customers.find((row) => row.id === quote.customer_id) : null;
  if (!book || !quote || !customer || quote.status === 'draft') {
    return NextResponse.json({ error: 'That quote is not available' }, { status: 404 });
  }
  const pdf = await buildQuotePdf({ settings: book.store.settings, customer, quote });
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${quote.number}.pdf"`,
    },
  });
}
