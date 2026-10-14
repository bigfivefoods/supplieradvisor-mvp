import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { clientIp, rateLimit } from '@/lib/security/rate-limit';
import {
  customerAuthFailure,
  customerFromSession,
  issueCustomerInvite,
  openCustomerSession,
  respondToOtpRequest,
  TRADE_INVITE_GENERIC,
} from '@/lib/trades/customer-auth';
import {
  TRADE_SESSION_COOKIE,
  sessionCookieOptions,
} from '@/lib/trades/customer-session';
import { notifyTradesperson, sendTradeEmail, tradeStatusEmail } from '@/lib/trades/notify';
import { applyTradeOp, customerPack, type TradeOp } from '@/lib/trades/desk';
import { portalFromRows } from '@/lib/trades/tradegraph';
import { seedHarbourBook } from '@/lib/trades/harbour-seed';
import {
  TradeSchemaMissingError,
  isMissingTradeSchema,
  loadTradeBook,
  saveTradeStore,
  workspaceByToken,
} from '@/lib/trades/tradegraph-db';

export const runtime = 'nodejs';

const GENERIC = TRADE_INVITE_GENERIC;
const VERIFY_IP_LIMIT = 20;
const VERIFY_IP_WINDOW_MS = 60_000;

export async function GET(request: NextRequest) {
  try {
    const token = String(request.nextUrl.searchParams.get('token') || '');
    if (token === 'demo') {
      const demo = seedHarbourBook(new Date().toISOString()).store;
      return NextResponse.json({
        brand: demo.settings.brand_name,
        trade: demo.settings.trade,
        city: demo.settings.city,
        phone: demo.settings.phone,
      });
    }
    const found = await workspaceByToken(token);
    if (!found) return NextResponse.json({ error: 'This trade book was not found' }, { status: 404 });
    return NextResponse.json({
      brand: found.store.settings.brand_name,
      trade: found.store.settings.trade,
      city: found.store.settings.city,
      phone: found.store.settings.phone,
    });
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const action = String(body.action || '');
    const publicToken = String(body.token || '');

    if (action === 'request_otp' || action === 'verify_otp' || action === 'magic') {
      if (action === 'verify_otp') {
        const limited = rateLimit({
          key: `trade-verify-otp:${clientIp(request)}:${publicToken}`,
          limit: VERIFY_IP_LIMIT,
          windowMs: VERIFY_IP_WINDOW_MS,
        });
        if (!limited.ok) {
          return NextResponse.json(customerAuthFailure(429), { status: 429 });
        }
        if (!String(body.email || '').trim()) {
          return NextResponse.json(customerAuthFailure(401), { status: 401 });
        }
      }
      const found = await workspaceByToken(publicToken);
      if (!found) return NextResponse.json(GENERIC);
      if (action === 'request_otp') {
        const email = String(body.email || '').trim().toLowerCase();
        const customer = found.store.customers.find((row) => row.email.toLowerCase() === email);
        await respondToOtpRequest({
          companyId: found.companyId,
          email,
          hasCustomer: Boolean(customer),
          send: async () => {
            if (!customer) return;
            const issued = await issueCustomerInvite({
              companyId: found.companyId,
              customerId: customer.id,
              email,
            });
            const url = `${request.nextUrl.origin}/customer/tradegraph/${encodeURIComponent(publicToken)}?magic=${encodeURIComponent(issued.magic)}`;
            const mail = tradeStatusEmail({
              brand: found.store.settings.brand_name || 'TradeAdvisor®',
              customerName: customer.name,
              title: 'Sign-in code',
              body: `Your code is ${issued.otp}. It expires in 15 minutes. You can also open the link.`,
              url,
            });
            await sendTradeEmail({ to: email, ...mail });
          },
        });
        return NextResponse.json(GENERIC);
      }
      const opened = await openCustomerSession({
        companyId: found.companyId,
        email: action === 'verify_otp' ? String(body.email || '') : undefined,
        otp: action === 'verify_otp' ? String(body.code || '') : undefined,
        magic: action === 'magic' ? String(body.magic || '') : undefined,
      });
      if (!opened.ok) {
        return NextResponse.json(customerAuthFailure(opened.status), { status: opened.status });
      }
      const response = NextResponse.json({ ok: true, customerId: opened.customerId });
      response.cookies.set(TRADE_SESSION_COOKIE, opened.token, sessionCookieOptions());
      return response;
    }

    const session =
      request.cookies.get(TRADE_SESSION_COOKIE)?.value ||
      String(body.session || '');
    if (action === 'portal' || action === 'client_op') {
      const who = await customerFromSession(session);
      const found = await workspaceByToken(publicToken);
      if (!who || !found || who.companyId !== found.companyId) {
        return NextResponse.json({ error: 'Sign in to open your jobs' }, { status: 401 });
      }
      const loaded = await loadTradeBook(found.companyId);
      if (!loaded) return NextResponse.json({ error: 'This trade book was not found' }, { status: 404 });
      if (action === 'portal') {
        return NextResponse.json({ pack: customerPack(loaded, who.customerId) });
      }
      const op = body.op as TradeOp;
      const allowed =
        (op?.type === 'sign_quote' ||
          op?.type === 'approve_vo' ||
          op?.type === 'decline_vo' ||
          op?.type === 'book_slot' ||
          op?.type === 'message' ||
          op?.type === 'add_review' ||
          op?.type === 'request_job') &&
        ('customer_id' in op ? op.customer_id === who.customerId : true);
      if (!allowed) {
        return NextResponse.json({ error: 'That action is not available here' }, { status: 400 });
      }
      if (op.type === 'sign_quote' || op.type === 'approve_vo' || op.type === 'decline_vo') {
        const pack = customerPack(loaded, who.customerId);
        const owns =
          op.type === 'sign_quote'
            ? pack.quotes.some((row) => row.id === op.quote_id)
            : pack.variations.some((row) => row.id === op.vo_id);
        if (!owns) return NextResponse.json({ error: 'That record is not on your account' }, { status: 403 });
      }
      const scoped =
        op.type === 'message'
          ? { ...op, from: 'customer' as const, customer_id: who.customerId }
          : op.type === 'book_slot' || op.type === 'add_review' || op.type === 'request_job'
            ? { ...op, customer_id: who.customerId }
            : op;
      const result = applyTradeOp(loaded, scoped, new Date().toISOString());
      await saveTradeStore(found.companyId, result.book.store, result.book.desk);
      return NextResponse.json({ ok: true, pack: customerPack(result.book, who.customerId), notices: result.notices });
    }
    if (!session) {
      return NextResponse.json({ error: 'Sign in to open your jobs' }, { status: 401 });
    }
    const supabase = getSupabaseServer();
    const called = await supabase.rpc('trade_portal_call', {
      p_token: session,
      p_action: action === 'request_job' ? 'request' : action === 'push_subscribe' ? 'push' : 'home',
      p_payload: {
        description: body.description,
        address: body.address,
        preferred_dates: body.preferred_dates,
        photo_urls: body.photo_urls,
        endpoint: body.endpoint,
        p256dh: body.p256dh,
        auth: body.auth,
      },
    });
    if (isMissingTradeSchema(called.error)) throw new TradeSchemaMissingError();
    if (called.error) {
      const message = called.error.message || 'Could not open the customer app';
      const status = /invalid_session/i.test(message) ? 401 : 400;
      return NextResponse.json({ error: message }, { status });
    }
    if (action === 'home' || action === '') {
      const portal = portalFromRows(called.data as never);
      return NextResponse.json({ portal });
    }
    if (action === 'request_job') {
      const description = String(body.description || '').replace(/\s+/g, ' ').trim().slice(0, 240);
      await notifyDesk(
        request,
        publicToken,
        'New job request',
        description
          ? `A customer asked for work: ${description}`
          : 'A customer sent a new job request.'
      );
    }
    return NextResponse.json({ ok: true, result: called.data });
  } catch (error) {
    return fail(error);
  }
}

async function notifyDesk(request: NextRequest, publicToken: string, title: string, body: string) {
  try {
    const found = await workspaceByToken(publicToken);
    if (!found) return;
    await notifyTradesperson({
      companyId: found.companyId,
      email: found.store.settings.notify_email,
      brand: found.store.settings.brand_name || 'TradeAdvisor®',
      title,
      body,
      url: `${request.nextUrl.origin}/dashboard/tradegraph/jobs`,
    });
  } catch {
    /* A missing mailer or push key must not fail the customer's request. */
  }
}

function fail(error: unknown) {
  if (error instanceof TradeSchemaMissingError) {
    return NextResponse.json(
      { error: error.message, migration: '20261014_tradegraph.sql' },
      { status: 503 }
    );
  }
  const message = error instanceof Error ? error.message : 'Request failed';
  return NextResponse.json({ error: message }, { status: 500 });
}
