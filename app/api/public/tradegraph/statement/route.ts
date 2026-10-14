import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { TRADE_SESSION_COOKIE } from '@/lib/trades/customer-session';
import { buildStatementPdf } from '@/lib/trades/statement-pdf';
import { portalFromRows } from '@/lib/trades/tradegraph';
import { isMissingTradeSchema, TradeSchemaMissingError } from '@/lib/trades/tradegraph-db';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const session = request.cookies.get(TRADE_SESSION_COOKIE)?.value || '';
    if (!session) {
      return NextResponse.json({ error: 'Sign in to download your statement' }, { status: 401 });
    }
    const supabase = getSupabaseServer();
    const called = await supabase.rpc('trade_portal_call', {
      p_token: session,
      p_action: 'home',
      p_payload: {},
    });
    if (isMissingTradeSchema(called.error)) throw new TradeSchemaMissingError();
    if (called.error) {
      return NextResponse.json({ error: 'Sign in to download your statement' }, { status: 401 });
    }
    const portal = portalFromRows(called.data as never);
    const pdf = await buildStatementPdf(portal);
    const filename = `statement-${portal.customer.name.replace(/[^\w]+/g, '-').toLowerCase() || 'customer'}.pdf`;
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (error) {
    if (error instanceof TradeSchemaMissingError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    return NextResponse.json({ error: 'Could not build the statement' }, { status: 500 });
  }
}
