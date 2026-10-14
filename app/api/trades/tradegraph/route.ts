import { NextRequest, NextResponse } from 'next/server';
import { legacyPrivyFrom, requireCompanyAccess } from '@/lib/auth/api-auth';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { issueCustomerInvite, customerPushSubs } from '@/lib/trades/customer-auth';
import { magicLink } from '@/lib/trades/customer-session';
import { sendTradeEmail, sendTradePush, tradeStatusEmail } from '@/lib/trades/notify';
import {
  TradeSchemaMissingError,
  loadTradeStore,
  saveTradeStore,
} from '@/lib/trades/tradegraph-db';
import {
  acceptQuote,
  addJobUpdate,
  customerAppPath,
  emptyTradeStore,
  invoiceJob,
  newId,
  recordPayment,
  requestToQuote,
  seedDemoTradegraph,
  shouldSeedDemoAccount,
  summariseTradegraph,
  type ComplianceCert,
  type ComplianceKind,
  type MaterialOrder,
  type QuoteLine,
  type ScheduleSlot,
  type TradeCustomer,
  type TradeQuote,
  type TradegraphStore,
} from '@/lib/trades/tradegraph';

export const runtime = 'nodejs';

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function jsonStore(store: TradegraphStore, extra?: Record<string, unknown>) {
  return NextResponse.json({
    success: true,
    store,
    summary: summariseTradegraph(store, todayIso()),
    ...extra,
  });
}

async function companyLooksDemo(companyId: number): Promise<boolean> {
  try {
    const supabase = getSupabaseServer();
    const found = await supabase
      .from('profiles')
      .select('trading_name, metadata')
      .eq('id', companyId)
      .maybeSingle();
    if (found.error || !found.data) {
      return shouldSeedDemoAccount({ companyId });
    }
    const row = found.data as { trading_name?: string; metadata?: Record<string, unknown> };
    return shouldSeedDemoAccount({
      companyId,
      tradingName: row.trading_name,
      metadata: row.metadata || null,
    });
  } catch {
    return shouldSeedDemoAccount({ companyId });
  }
}

async function loadBook(companyId: number): Promise<TradegraphStore> {
  const existing = await loadTradeStore(companyId);
  if (existing) return existing;
  const now = new Date().toISOString();
  if (await companyLooksDemo(companyId)) {
    const demo = seedDemoTradegraph(now, `tg_demo_${companyId}`);
    await saveTradeStore(companyId, demo);
    return demo;
  }
  const blank = emptyTradeStore(now, newId('tg'));
  blank.settings.brand_name = 'TradeAdvisor®';
  await saveTradeStore(companyId, blank);
  return blank;
}

async function notifyCustomer(
  request: NextRequest,
  store: TradegraphStore,
  customerId: string,
  title: string,
  body: string
) {
  const customer = store.customers.find((row) => row.id === customerId);
  if (!customer) return;
  const origin = request.nextUrl.origin;
  const url = `${origin}${customerAppPath(store.settings.public_token)}`;
  const mail = tradeStatusEmail({
    brand: store.settings.brand_name || 'TradeAdvisor®',
    customerName: customer.name,
    title,
    body,
    url,
  });
  try {
    await sendTradeEmail({ to: customer.email, ...mail });
    const subs = await customerPushSubs(customerId);
    await sendTradePush(subs, { title: mail.subject, body, url, tag: 'tradegraph' });
  } catch {
    /* A missing mailer or push key must not fail the saved job, invoice, or payment. */
  }
}

export async function GET(request: NextRequest) {
  try {
    const companyId = Number(request.nextUrl.searchParams.get('companyId'));
    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request),
    });
    if (!gate.ok) return gate.response;
    const store = await loadBook(companyId);
    return jsonStore(store);
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const companyId = Number(body.companyId);
    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request),
    });
    if (!gate.ok) return gate.response;
    const action = String(body.action || '');
    const now = new Date().toISOString();
    let store = await loadBook(companyId);

    if (action === 'seed_demo') {
      store = seedDemoTradegraph(now, store.settings.public_token || `tg_demo_${companyId}`);
      await saveTradeStore(companyId, store);
      return jsonStore(store, { message: 'Sample Cape Town book loaded' });
    }

    if (action === 'save_settings') {
      const settings = (body.settings || {}) as Partial<TradegraphStore['settings']>;
      store = {
        ...store,
        updated_at: now,
        settings: {
          ...store.settings,
          brand_name: String(settings.brand_name ?? store.settings.brand_name),
          trade: (settings.trade || store.settings.trade) as TradegraphStore['settings']['trade'],
          phone: String(settings.phone ?? store.settings.phone),
          city: String(settings.city ?? store.settings.city),
          notify_email: String(settings.notify_email ?? store.settings.notify_email),
          vat_rate: Number(settings.vat_rate ?? store.settings.vat_rate) || store.settings.vat_rate,
        },
      };
      await saveTradeStore(companyId, store);
      return jsonStore(store);
    }

    if (action === 'save_customer') {
      const incoming = body.customer as Partial<TradeCustomer>;
      const id = String(incoming.id || newId('tc'));
      const customer: TradeCustomer = {
        id,
        name: String(incoming.name || '').trim(),
        email: String(incoming.email || '').trim().toLowerCase(),
        phone: String(incoming.phone || ''),
        address: String(incoming.address || ''),
        suburb: String(incoming.suburb || ''),
        city: String(incoming.city || ''),
      };
      if (!customer.name) {
        return NextResponse.json({ error: 'Customer name is required' }, { status: 400 });
      }
      const exists = store.customers.some((row) => row.id === id);
      store = {
        ...store,
        updated_at: now,
        customers: exists
          ? store.customers.map((row) => (row.id === id ? customer : row))
          : [...store.customers, customer],
      };
      await saveTradeStore(companyId, store);
      return jsonStore(store, { customer });
    }

    if (action === 'save_quote') {
      const incoming = body.quote as Partial<TradeQuote>;
      const id = String(incoming.id || newId('tq'));
      const lines = Array.isArray(incoming.lines) ? (incoming.lines as QuoteLine[]) : [];
      const quote: TradeQuote = {
        id,
        number: String(incoming.number || `Q-${1000 + store.quotes.length + 1}`),
        customer_id: String(incoming.customer_id || ''),
        status: (incoming.status as TradeQuote['status']) || 'draft',
        title: String(incoming.title || 'Quote'),
        lines: lines.map((line) => ({
          id: String(line.id || newId('tl')),
          description: String(line.description || ''),
          qty: Number(line.qty) || 0,
          unit_cents: Math.round(Number(line.unit_cents) || 0),
        })),
        source_request_id: incoming.source_request_id
          ? String(incoming.source_request_id)
          : null,
        created_at: String(incoming.created_at || now),
      };
      if (!store.customers.some((row) => row.id === quote.customer_id)) {
        return NextResponse.json({ error: 'Pick a customer' }, { status: 400 });
      }
      const exists = store.quotes.some((row) => row.id === id);
      store = {
        ...store,
        updated_at: now,
        quotes: exists
          ? store.quotes.map((row) => (row.id === id ? quote : row))
          : [...store.quotes, quote],
      };
      await saveTradeStore(companyId, store);
      return jsonStore(store);
    }

    if (action === 'accept_quote') {
      const quoteId = String(body.quoteId || '');
      const jobsBefore = store.jobs.length;
      store = acceptQuote(store, quoteId, now);
      await saveTradeStore(companyId, store);
      const job = store.jobs.find((row) => row.quote_id === quoteId);
      if (job && store.jobs.length > jobsBefore) {
        await notifyCustomer(
          request,
          store,
          job.customer_id,
          `${job.number} is scheduled`,
          `${job.title} is scheduled. You can follow it in your jobs.`
        );
      }
      return jsonStore(store);
    }

    if (action === 'add_update') {
      const jobId = String(body.jobId || '');
      const before = store.jobs.find((row) => row.id === jobId);
      store = addJobUpdate(
        store,
        jobId,
        {
          note: String(body.note || ''),
          progress_pct: Number(body.progress_pct) || 0,
          photo_url: body.photo_url ? String(body.photo_url) : null,
          shared: Boolean(body.shared),
        },
        now
      );
      await saveTradeStore(companyId, store);
      const job = store.jobs.find((row) => row.id === jobId);
      const statusChanged = Boolean(before && job && before.status !== job.status);
      if (job && (body.shared || statusChanged)) {
        await notifyCustomer(
          request,
          store,
          job.customer_id,
          statusChanged ? `${job.number} is ${jobStatusLabel(job.status)}` : `${job.number} updated`,
          statusChanged
            ? `${job.title} is ${jobStatusLabel(job.status)} (${job.progress_pct}% complete).`
            : String(body.note || `Progress is ${job.progress_pct}%.`)
        );
      }
      return jsonStore(store);
    }

    if (action === 'invoice_job') {
      const jobId = String(body.jobId || '');
      const invoicesBefore = store.invoices.length;
      store = invoiceJob(store, jobId, now);
      await saveTradeStore(companyId, store);
      const job = store.jobs.find((row) => row.id === jobId);
      const invoice = store.invoices.find((row) => row.job_id === jobId);
      if (job && invoice && store.invoices.length > invoicesBefore) {
        await notifyCustomer(
          request,
          store,
          job.customer_id,
          `Invoice ${invoice.number}`,
          `A new invoice for ${job.title} is on your statement.`
        );
      }
      return jsonStore(store);
    }

    if (action === 'record_payment') {
      const invoiceId = String(body.invoiceId || '');
      store = recordPayment(
        store,
        invoiceId,
        Number(body.amount_cents) || 0,
        String(body.method || 'EFT'),
        now
      );
      await saveTradeStore(companyId, store);
      const invoice = store.invoices.find((row) => row.id === invoiceId);
      if (invoice) {
        await notifyCustomer(
          request,
          store,
          invoice.customer_id,
          `Statement updated`,
          `A payment was recorded on ${invoice.number}. Your statement balance has changed.`
        );
      }
      return jsonStore(store);
    }

    if (action === 'quote_from_request') {
      store = requestToQuote(store, String(body.requestId || ''), now);
      await saveTradeStore(companyId, store);
      return jsonStore(store);
    }

    if (action === 'decline_request') {
      const requestId = String(body.requestId || '');
      store = {
        ...store,
        updated_at: now,
        requests: store.requests.map((row) =>
          row.id === requestId ? { ...row, status: 'declined' } : row
        ),
      };
      await saveTradeStore(companyId, store);
      return jsonStore(store);
    }

    if (action === 'save_material') {
      const incoming = body.order as Partial<MaterialOrder>;
      const id = String(incoming.id || newId('tm'));
      const order: MaterialOrder = {
        id,
        supplier_id:
          incoming.supplier_id == null || incoming.supplier_id === ('' as never)
            ? null
            : Number(incoming.supplier_id) || null,
        supplier_name: String(incoming.supplier_name || ''),
        job_id: incoming.job_id ? String(incoming.job_id) : null,
        status: (incoming.status as MaterialOrder['status']) || 'draft',
        created_at: String(incoming.created_at || now),
        lines: (incoming.lines || []).map((line) => ({
          id: String(line.id || newId('tl')),
          description: String(line.description || ''),
          qty: Number(line.qty) || 0,
          unit_cents: Math.round(Number(line.unit_cents) || 0),
        })),
      };
      const exists = store.materials.some((row) => row.id === id);
      store = {
        ...store,
        updated_at: now,
        materials: exists
          ? store.materials.map((row) => (row.id === id ? order : row))
          : [...store.materials, order],
      };
      await saveTradeStore(companyId, store);
      return jsonStore(store);
    }

    if (action === 'save_slot') {
      const incoming = body.slot as Partial<ScheduleSlot>;
      const id = String(incoming.id || newId('ts'));
      const slot: ScheduleSlot = {
        id,
        job_id: incoming.job_id ? String(incoming.job_id) : null,
        title: String(incoming.title || 'Job'),
        starts_at: String(incoming.starts_at || now),
        ends_at: String(incoming.ends_at || now),
        address: String(incoming.address || ''),
      };
      const exists = store.schedule.some((row) => row.id === id);
      store = {
        ...store,
        updated_at: now,
        schedule: exists
          ? store.schedule.map((row) => (row.id === id ? slot : row))
          : [...store.schedule, slot],
      };
      await saveTradeStore(companyId, store);
      return jsonStore(store);
    }

    if (action === 'delete_slot') {
      const id = String(body.slotId || '');
      store = {
        ...store,
        updated_at: now,
        schedule: store.schedule.filter((row) => row.id !== id),
      };
      await saveTradeStore(companyId, store);
      return jsonStore(store);
    }

    if (action === 'save_compliance') {
      const incoming = body.cert as Partial<ComplianceCert>;
      const id = String(incoming.id || newId('tx'));
      const cert: ComplianceCert = {
        id,
        kind: (incoming.kind || 'other') as ComplianceKind,
        number: String(incoming.number || ''),
        holder: String(incoming.holder || ''),
        expires_on: String(incoming.expires_on || todayIso()).slice(0, 10),
        job_id: incoming.job_id ? String(incoming.job_id) : null,
      };
      const exists = store.compliance.some((row) => row.id === id);
      store = {
        ...store,
        updated_at: now,
        compliance: exists
          ? store.compliance.map((row) => (row.id === id ? cert : row))
          : [...store.compliance, cert],
      };
      await saveTradeStore(companyId, store);
      return jsonStore(store);
    }

    if (action === 'delete_compliance') {
      const id = String(body.certId || '');
      store = {
        ...store,
        updated_at: now,
        compliance: store.compliance.filter((row) => row.id !== id),
      };
      await saveTradeStore(companyId, store);
      return jsonStore(store);
    }

    if (action === 'invite_customer') {
      const customerId = String(body.customerId || '');
      const customer = store.customers.find((row) => row.id === customerId);
      if (!customer?.email) {
        return NextResponse.json({ error: 'Add an email before inviting' }, { status: 400 });
      }
      const issued = await issueCustomerInvite({
        companyId,
        customerId,
        email: customer.email,
      });
      const url = magicLink(
        request.nextUrl.origin,
        store.settings.public_token,
        issued.magic
      );
      const mail = tradeStatusEmail({
        brand: store.settings.brand_name || 'TradeAdvisor®',
        customerName: customer.name,
        title: 'Your job app',
        body: `Open your jobs, statement and new requests. One-time code: ${issued.otp}. It expires in 15 minutes. Or use the link.`,
        url,
      });
      const email = await sendTradeEmail({ to: customer.email, ...mail });
      return jsonStore(store, {
        inviteUrl: url,
        email,
        otpHint: email === 'sent' ? undefined : issued.otp,
      });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return fail(error);
  }
}

function fail(error: unknown) {
  if (error instanceof TradeSchemaMissingError) {
    return NextResponse.json({ error: error.message, migration: '20261014_tradegraph.sql' }, { status: 503 });
  }
  const message = error instanceof Error ? error.message : 'TradeAdvisor® request failed';
  const status = /not found|required|too large|balance|no longer/i.test(message) ? 400 : 500;
  return NextResponse.json({ error: message }, { status });
}

function jobStatusLabel(status: string): string {
  if (status === 'in_progress') return 'in progress';
  if (status === 'scheduled') return 'scheduled';
  if (status === 'done') return 'done';
  if (status === 'invoiced') return 'invoiced';
  if (status === 'cancelled') return 'cancelled';
  return status.replace(/_/g, ' ');
}
