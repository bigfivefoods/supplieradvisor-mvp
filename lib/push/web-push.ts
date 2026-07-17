/**
 * Server-side Web Push helpers (VAPID).
 * Env:
 *   NEXT_PUBLIC_VAPID_PUBLIC_KEY
 *   VAPID_PRIVATE_KEY
 *   VAPID_SUBJECT  (e.g. mailto:ops@supplieradvisor.com)
 */

import { getSupabaseServer } from '@/lib/supabase/server-client';

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
};

export function isWebPushConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY &&
      process.env.VAPID_PRIVATE_KEY
  );
}

export function getVapidPublicKey(): string | null {
  return process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || null;
}

type SubRow = {
  id: number;
  endpoint: string;
  p256dh: string;
  auth: string;
  privy_user_id?: string | null;
  profile_id?: number | null;
};

async function loadWebPush() {
  // Dynamic import so builds without the package still typecheck if removed
  const webpush = await import('web-push');
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject =
    process.env.VAPID_SUBJECT || 'mailto:ops@supplieradvisor.com';
  if (!publicKey || !privateKey) return null;
  webpush.setVapidDetails(subject, publicKey, privateKey);
  return webpush;
}

async function sendToSubscription(
  webpush: Awaited<ReturnType<typeof loadWebPush>>,
  row: SubRow,
  payload: PushPayload
): Promise<'ok' | 'gone' | 'error'> {
  if (!webpush) return 'error';
  try {
    await webpush.sendNotification(
      {
        endpoint: row.endpoint,
        keys: { p256dh: row.p256dh, auth: row.auth },
      },
      JSON.stringify(payload),
      { TTL: 60 * 60 * 12, urgency: 'normal' }
    );
    return 'ok';
  } catch (e: unknown) {
    const status =
      e && typeof e === 'object' && 'statusCode' in e
        ? Number((e as { statusCode?: number }).statusCode)
        : 0;
    if (status === 404 || status === 410) return 'gone';
    console.warn('[web-push] send failed', status || e);
    return 'error';
  }
}

async function pruneGone(ids: number[]) {
  if (!ids.length) return;
  try {
    const supabase = getSupabaseServer();
    await supabase.from('push_subscriptions').delete().in('id', ids);
  } catch {
    /* ignore */
  }
}

/** Push to all subscriptions for a company (profile_id). */
export async function pushToCompany(
  profileId: number,
  payload: PushPayload,
  opts?: { topic?: string }
): Promise<{ sent: number; pruned: number }> {
  if (!isWebPushConfigured() || !Number.isFinite(profileId)) {
    return { sent: 0, pruned: 0 };
  }
  const webpush = await loadWebPush();
  if (!webpush) return { sent: 0, pruned: 0 };

  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth, privy_user_id, profile_id, topics')
    .eq('profile_id', profileId)
    .limit(200);

  if (error || !data?.length) {
    if (error && !/does not exist|schema cache/i.test(error.message)) {
      console.warn('[web-push] list company', error.message);
    }
    return { sent: 0, pruned: 0 };
  }

  const topic = opts?.topic;
  const rows = (data as (SubRow & { topics?: string[] | null })[]).filter(
    (r) => {
      if (!topic) return true;
      const topics = r.topics || ['po', 'deals'];
      return topics.includes(topic) || topics.includes('all');
    }
  );

  let sent = 0;
  const gone: number[] = [];
  await Promise.all(
    rows.map(async (row) => {
      const r = await sendToSubscription(webpush, row, payload);
      if (r === 'ok') sent += 1;
      if (r === 'gone') gone.push(row.id);
    })
  );
  await pruneGone(gone);
  return { sent, pruned: gone.length };
}

/** Push to a specific Privy user (all their device endpoints). */
export async function pushToUser(
  privyUserId: string,
  payload: PushPayload,
  opts?: { profileId?: number | null; topic?: string }
): Promise<{ sent: number; pruned: number }> {
  if (!isWebPushConfigured() || !privyUserId) {
    return { sent: 0, pruned: 0 };
  }
  const webpush = await loadWebPush();
  if (!webpush) return { sent: 0, pruned: 0 };

  const supabase = getSupabaseServer();
  let q = supabase
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth, privy_user_id, profile_id, topics')
    .eq('privy_user_id', privyUserId)
    .limit(50);
  if (opts?.profileId && Number.isFinite(opts.profileId)) {
    q = q.eq('profile_id', opts.profileId);
  }
  const { data, error } = await q;
  if (error || !data?.length) {
    if (error && !/does not exist|schema cache/i.test(error.message)) {
      console.warn('[web-push] list user', error.message);
    }
    return { sent: 0, pruned: 0 };
  }

  const topic = opts?.topic;
  const rows = (data as (SubRow & { topics?: string[] | null })[]).filter(
    (r) => {
      if (!topic) return true;
      const topics = r.topics || ['po', 'deals'];
      return topics.includes(topic) || topics.includes('all');
    }
  );

  let sent = 0;
  const gone: number[] = [];
  await Promise.all(
    rows.map(async (row) => {
      const r = await sendToSubscription(webpush, row, payload);
      if (r === 'ok') sent += 1;
      if (r === 'gone') gone.push(row.id);
    })
  );
  await pruneGone(gone);
  return { sent, pruned: gone.length };
}

export async function notifyPoAcceptedPush(params: {
  buyerProfileId: number;
  supplierName?: string | null;
  poId: number;
}) {
  try {
    await pushToCompany(
      params.buyerProfileId,
      {
        title: 'PO accepted',
        body: params.supplierName
          ? `${params.supplierName} accepted PO #${params.poId}`
          : `Your supplier accepted PO #${params.poId}`,
        url: `/dashboard/suppliers/po`,
        tag: `po-accepted-${params.poId}`,
      },
      { topic: 'po' }
    );
  } catch (e) {
    console.warn('notifyPoAcceptedPush', e);
  }
}

/** Buyer raised / sent a PO → alert supplier company devices. */
export async function notifyInboundPoPush(params: {
  supplierProfileId: number;
  buyerName?: string | null;
  poId: number;
  totalAmount?: number | null;
  currency?: string | null;
}) {
  try {
    const amount =
      params.totalAmount != null && Number.isFinite(Number(params.totalAmount))
        ? ` · ${params.currency || 'ZAR'} ${Number(params.totalAmount).toLocaleString('en-ZA')}`
        : '';
    await pushToCompany(
      params.supplierProfileId,
      {
        title: 'New purchase order',
        body: params.buyerName
          ? `${params.buyerName} sent PO #${params.poId}${amount}`
          : `Inbound PO #${params.poId}${amount}`,
        url: `/dashboard/customers/orders`,
        tag: `po-inbound-${params.poId}`,
      },
      { topic: 'po' }
    );
  } catch (e) {
    console.warn('notifyInboundPoPush', e);
  }
}

/** Seller raised invoice from buyer PO → alert buyer devices. */
export async function notifyPoInvoicedPush(params: {
  buyerProfileId: number;
  supplierName?: string | null;
  poId: number;
  invoiceId?: number | null;
  invoiceNumber?: string | null;
}) {
  try {
    const inv =
      params.invoiceNumber ||
      (params.invoiceId ? `#${params.invoiceId}` : 'invoice');
    const url =
      params.invoiceId && params.invoiceId > 0
        ? `/dashboard/buyer/documents?invoiceId=${params.invoiceId}`
        : '/dashboard/buyer/documents';
    await pushToCompany(
      params.buyerProfileId,
      {
        title: 'PO invoiced',
        body: params.supplierName
          ? `${params.supplierName} raised ${inv} for PO #${params.poId}`
          : `Supplier raised ${inv} for PO #${params.poId}`,
        url,
        tag: `po-invoiced-${params.poId}`,
      },
      { topic: 'po' }
    );
  } catch (e) {
    console.warn('notifyPoInvoicedPush', e);
  }
}

/** Supplier marked fulfilment shipped / ready → alert buyer. */
export async function notifyPoFulfilmentPush(params: {
  buyerProfileId: number;
  supplierName?: string | null;
  poId: number;
  fulfilmentStatus: string;
}) {
  try {
    const st = String(params.fulfilmentStatus || '').toLowerCase();
    const title =
      st === 'shipped'
        ? 'PO shipped'
        : st === 'ready'
          ? 'PO ready'
          : 'PO fulfilment update';
    const verb =
      st === 'shipped'
        ? 'shipped'
        : st === 'ready'
          ? 'marked ready for collection'
          : `updated fulfilment (${st})`;
    await pushToCompany(
      params.buyerProfileId,
      {
        title,
        body: params.supplierName
          ? `${params.supplierName} ${verb} PO #${params.poId}`
          : `Supplier ${verb} PO #${params.poId}`,
        url: `/dashboard/suppliers/po`,
        tag: `po-fulfilment-${params.poId}-${st}`,
      },
      { topic: 'po' }
    );
  } catch (e) {
    console.warn('notifyPoFulfilmentPush', e);
  }
}

export async function notifyDealStagePush(params: {
  profileId: number;
  salesRepUserId?: string | null;
  dealName: string;
  fromStage: string;
  toStage: string;
  opportunityId: number;
}) {
  try {
    const label = (s: string) => s.replace(/_/g, ' ');
    const payload: PushPayload = {
      title: 'Deal stage update',
      body: `${params.dealName}: ${label(params.fromStage)} → ${label(params.toStage)}`,
      url: `/sales/pipeline`,
      tag: `deal-stage-${params.opportunityId}`,
    };
    if (params.salesRepUserId) {
      await pushToUser(params.salesRepUserId, payload, {
        profileId: params.profileId,
        topic: 'deals',
      });
    } else {
      await pushToCompany(params.profileId, payload, { topic: 'deals' });
    }
  } catch (e) {
    console.warn('notifyDealStagePush', e);
  }
}
