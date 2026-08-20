/**
 * Start a Paystack gym shop charge (membership or programme).
 * Settles via Advisor subaccount (1% admin). Apple Pay is a Paystack channel.
 */
import { initializePaystackTransaction } from '@/lib/billing/paystack-plans';
import { PAYSTACK_CHANNELS_DEFAULT } from '@/lib/billing/paystack-client';
import {
  advisorPaystackSplitFromMeta,
  advisorSplitMetadata,
  previewAdvisorPayoutSplit,
} from '@/lib/billing/advisor-payout';
import { getAppUrl } from '@/lib/resend';
import { newId, type FitgraphStore } from '@/lib/fitness/fitgraph';
import {
  parseGymSaleKind,
  resolveShopItem,
  upsertGymSale,
  type GymSale,
  type GymSaleKind,
  type GymShopItem,
} from '@/lib/fitness/gym-shop';
import {
  findGymInventoryItem,
  listGymInventoryShop,
} from '@/lib/fitness/gym-inventory-shop';

export { parseGymSaleKind };

export async function startGymShopCheckout(opts: {
  store: FitgraphStore;
  meta: Record<string, unknown>;
  companyId: number;
  token: string;
  kind: GymSaleKind;
  itemId: string;
  name: string;
  email: string;
  phone?: string | null;
  sessionId?: string | null;
  clientId?: string | null;
  /** Path after Paystack (no origin). Defaults to the public embed. */
  callbackPath?: string;
}): Promise<
  | {
      ok: true;
      store: FitgraphStore;
      authorizationUrl: string;
      accessCode: string;
      reference: string;
      amount_zar: number;
      item: GymShopItem;
    }
  | { ok: false; error: string; status: number }
> {
  const email = opts.email.trim().toLowerCase();
  const name = opts.name.trim();
  if (!email.includes('@')) {
    return { ok: false, error: 'Email is required to pay', status: 400 };
  }
  if (!name) {
    return { ok: false, error: 'Name is required', status: 400 };
  }
  let resolvedItem: { ok: true; item: GymShopItem } | { ok: false; error: string };
  if (opts.kind === 'product') {
    const inventory = await listGymInventoryShop(opts.companyId);
    const found = findGymInventoryItem(inventory, opts.itemId);
    resolvedItem = found
      ? {
          ok: true,
          item: {
            kind: 'product',
            id: found.id,
            name: found.name,
            description: found.description,
            price_zar: found.price_zar,
            billing: 'once',
            image_url: found.image_url,
            group: found.group,
          },
        }
      : { ok: false, error: 'That product is not for sale' };
  } else {
    resolvedItem = resolveShopItem(opts.store, opts.kind, opts.itemId);
  }
  if (!resolvedItem.ok) {
    return { ok: false, error: resolvedItem.error, status: 400 };
  }
  const split = advisorPaystackSplitFromMeta(opts.meta, 'member');
  if (!split.ok) {
    return { ok: false, error: split.error, status: 400 };
  }
  const amountZar = resolvedItem.item.price_zar;
  const saleId = newId('gsl');
  const reference = `gym-sale-${opts.companyId}-${Date.now().toString(36)}`;
  const preview = previewAdvisorPayoutSplit(amountZar);
  const rawCallback =
    opts.callbackPath ||
    `/embed/fitgraph/${encodeURIComponent(opts.token)}`;
  const withRef = rawCallback.includes('ref=')
    ? rawCallback
    : `${rawCallback}${rawCallback.includes('?') ? '&' : '?'}pay=1&ref=${encodeURIComponent(reference)}`;
  const callbackUrl = withRef.startsWith('http')
    ? withRef
    : `${getAppUrl()}${withRef.startsWith('/') ? '' : '/'}${withRef}`;
  const init = await initializePaystackTransaction({
    email,
    amountCents: Math.round(amountZar * 100),
    reference,
    callbackUrl,
    channels: [...PAYSTACK_CHANNELS_DEFAULT],
    subaccount: split.subaccount,
    bearer: split.bearer,
    metadata: {
      product: 'gym_sale',
      company_id: opts.companyId,
      sale_id: saleId,
      kind: opts.kind,
      plan_id: opts.kind === 'membership' ? opts.itemId : null,
      programme_id: opts.kind === 'programme' ? opts.itemId : null,
      product_id: opts.kind === 'product' ? opts.itemId : null,
      session_id: opts.sessionId || null,
      client_id: opts.clientId || null,
      ...advisorSplitMetadata(split),
      platform_fee_zar: preview.platform_fee_zar,
    },
  });
  if (!init.ok) {
    return { ok: false, error: init.error, status: 502 };
  }
  const sale: GymSale = {
    id: saleId,
    kind: opts.kind,
    plan_id: opts.kind === 'membership' ? opts.itemId : null,
    programme_id: opts.kind === 'programme' ? opts.itemId : null,
    product_id: opts.kind === 'product' ? opts.itemId : null,
    session_id: opts.sessionId || null,
    label: resolvedItem.item.name,
    amount_zar: amountZar,
    name,
    email,
    phone: opts.phone || null,
    client_id: opts.clientId || null,
    status: 'pending',
    paystack_ref: init.reference,
    created_at: new Date().toISOString(),
  };
  return {
    ok: true,
    store: upsertGymSale(opts.store, sale),
    authorizationUrl: init.authorizationUrl,
    accessCode: init.accessCode,
    reference: init.reference,
    amount_zar: amountZar,
    item: resolvedItem.item,
  };
}
