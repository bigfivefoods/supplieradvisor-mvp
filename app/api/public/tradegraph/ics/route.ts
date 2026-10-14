import { NextRequest, NextResponse } from 'next/server';
import { HARBOUR_NOW, buildTradeIcs } from '@/lib/trades/desk';
import { seedHarbourBook } from '@/lib/trades/harbour-seed';
import { loadTradeBook, workspaceByToken } from '@/lib/trades/tradegraph-db';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const token = String(request.nextUrl.searchParams.get('token') || '');
  let book = token === 'demo' || token === 'tg_harbour' ? seedHarbourBook(HARBOUR_NOW) : null;
  if (!book && token) {
    const found = await workspaceByToken(token);
    if (found) book = await loadTradeBook(found.companyId);
  }
  if (!book) {
    return NextResponse.json({ error: 'This trade book was not found' }, { status: 404 });
  }
  const ics = buildTradeIcs(book);
  return new NextResponse(ics, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'attachment; filename="tradeadvisor.ics"',
    },
  });
}
