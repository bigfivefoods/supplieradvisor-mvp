import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  requireCompanyAccess,
  legacyPrivyFrom,
} from '@/lib/auth/api-auth';
import { findConnectionBetween } from '@/lib/connections/sync';
import { isAgreementEffective } from '@/lib/pricing/types';
import { priceForCurrency } from '@/lib/inventory/priceForCurrency';
import type { ProductRecord } from '@/lib/inventory/types';
import {
  BUYER_INVENTORY_PRODUCT_COLUMNS,
  mapBuyerProductsToPoCatalogue,
  poCatalogueSourceRank,
  type BuyerInventoryProductRow,
  type PoCatalogueItem,
} from '@/lib/suppliers/buyer-inventory-catalogue';

/**
 * Unified catalogue for raising a PO against a supplier in the SRM book.
 *
 * GET ?companyId=&supplierId=   (preferred — SRM book row id)
 * GET ?companyId=&sellerProfileId=
 *
 * Sources (merged for the buyer):
 *  1) Active pricing-agreement lines (imported / negotiated catalogue)
 *  2) Supplier inventory products (finished goods, services, etc.)
 *  3) Buyer’s own purchasable inventory — always when `supplierId` (book row)
 *     is present, including book-only / pending-invite suppliers so a PO can
 *     go out before they accept.
 *
 * Requires company membership + SRM book row or accepted network connection.
 */
export type SupplierCatalogueItem = PoCatalogueItem;

async function loadBuyerInventoryItems(
  supabase: ReturnType<typeof getSupabaseServer>,
  companyId: number,
  currencyPref: string,
  excludeProductIds?: Iterable<number>
): Promise<PoCatalogueItem[]> {
  const { data: products, error } = await supabase
    .from('products')
    .select(BUYER_INVENTORY_PRODUCT_COLUMNS)
    .eq('profile_id', companyId)
    .order('name')
    .limit(500);

  if (error) {
    if (!/relation|does not exist|column/i.test(error.message)) {
      console.warn('catalogue buyer inventory', error.message);
    }
    return [];
  }

  return mapBuyerProductsToPoCatalogue(
    (products || []) as BuyerInventoryProductRow[],
    currencyPref,
    { excludeProductIds }
  );
}

export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const companyId = Number(sp.get('companyId'));
    const srmId = sp.get('supplierId') ? Number(sp.get('supplierId')) : null;
    let sellerProfileId = sp.get('sellerProfileId')
      ? Number(sp.get('sellerProfileId'))
      : null;

    if (!Number.isFinite(companyId) || companyId <= 0) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }

    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request),
    });
    if (!gate.ok) return gate.response;

    const supabase = getSupabaseServer();
    let supplierName: string | null = null;
    let srmRow: {
      id: number;
      trading_name?: string | null;
      linked_profile_id?: number | null;
      invite_status?: string | null;
      status?: string | null;
    } | null = null;

    if (srmId && Number.isFinite(srmId)) {
      const { data } = await supabase
        .from('srm_suppliers')
        .select('id, trading_name, linked_profile_id, invite_status, status')
        .eq('profile_id', companyId)
        .eq('id', srmId)
        .maybeSingle();
      if (!data) {
        return NextResponse.json(
          { error: 'Supplier not found in your book' },
          { status: 404 }
        );
      }
      srmRow = data;
      supplierName = data.trading_name || null;
      if (data.linked_profile_id) {
        sellerProfileId = Number(data.linked_profile_id);
      }
    }

    const currencyPref = (sp.get('currency') || 'ZAR').toUpperCase();

    if (!sellerProfileId || !Number.isFinite(sellerProfileId)) {
      const buyerItems = srmRow
        ? await loadBuyerInventoryItems(supabase, companyId, currencyPref)
        : [];
      return NextResponse.json({
        success: true,
        sellerProfileId: null,
        sellerName: supplierName,
        items: buyerItems,
        agreementCount: 0,
        inventoryCount: 0,
        buyerInventoryCount: buyerItems.length,
        catalogueSource: buyerItems.length ? 'buyer_inventory' : 'empty',
        inviteStatus: srmRow?.invite_status ?? null,
        warning: buyerItems.length
          ? undefined
          : srmRow
            ? 'This supplier has not accepted yet. Pick from your inventory (Inventory → Products) or use free-text lines. Invite still unlocks their catalogue and escrow.'
            : 'Supplier is not linked to a platform company yet. Invite/connect them, or use free-text lines.',
        hint: srmRow
          ? 'Book-only POs use your inventory catalogue until the supplier accepts.'
          : 'linked_profile_id required on the SRM book row',
      });
    }

    // Self-readiness (own catalogue empty banner) — skip PO-against-self rule
    const readinessOnly = sp.get('readinessOnly') === '1';
    if (sellerProfileId === companyId) {
      if (readinessOnly) {
        const { computeCatalogueReadiness } = await import(
          '@/lib/suppliers/catalogue-readiness'
        );
        const readiness = await computeCatalogueReadiness(companyId);
        return NextResponse.json({
          success: true,
          sellerProfileId: companyId,
          items: [],
          readiness,
          self: true,
        });
      }
      return NextResponse.json(
        { error: 'Cannot raise a PO against your own company' },
        { status: 400 }
      );
    }

    // Access: accepted network edge OR present in our SRM book as linked supplier
    const edge = await findConnectionBetween(companyId, sellerProfileId);
    const edgeOk =
      edge &&
      String(edge.status) === 'accepted' &&
      !(
        edge.metadata &&
        typeof edge.metadata === 'object' &&
        !Array.isArray(edge.metadata) &&
        ((edge.metadata as Record<string, unknown>).suspended === true ||
          (edge.metadata as Record<string, unknown>).suspended === 'true')
      );

    if (!edgeOk && !srmRow) {
      // sellerProfileId path without srm — require connection
      if (!edge || String(edge.status) !== 'accepted') {
        return NextResponse.json(
          {
            error:
              'No accepted connection with this supplier. Connect in Network first.',
            code: 'NOT_CONNECTED',
          },
          { status: 403 }
        );
      }
    }

    // Seller display name
    if (!supplierName) {
      const { data: prof } = await supabase
        .from('profiles')
        .select('trading_name')
        .eq('id', sellerProfileId)
        .maybeSingle();
      supplierName = prof?.trading_name || null;
    }

    const items: SupplierCatalogueItem[] = [];
    const agreementProductIds = new Set<number>();

    // ── 1) Pricing agreements (negotiated / imported catalogue) ──
    const { data: agreements, error: agrErr } = await supabase
      .from('pricing_agreements')
      .select('*')
      .eq('buyer_profile_id', companyId)
      .eq('seller_profile_id', sellerProfileId)
      .eq('status', 'active')
      .order('updated_at', { ascending: false });

    if (agrErr && !/relation|does not exist/i.test(agrErr.message)) {
      console.warn('catalogue agreements', agrErr.message);
    }

    const activeAgreements = (agreements || []).filter((a) =>
      isAgreementEffective({
        status: a.status,
        effective_from: a.effective_from,
        effective_to: a.effective_to,
      })
    );

    if (activeAgreements.length) {
      const agreementIds = activeAgreements.map((a) => Number(a.id));
      const agreementMap = Object.fromEntries(
        activeAgreements.map((a) => [Number(a.id), a])
      );
      const { data: lines } = await supabase
        .from('pricing_agreement_lines')
        .select('*')
        .in('agreement_id', agreementIds)
        .order('sort_order', { ascending: true });

      for (const l of lines || []) {
        const a = agreementMap[Number(l.agreement_id)];
        const sellerProductId =
          l.seller_product_id != null && Number.isFinite(Number(l.seller_product_id))
            ? Number(l.seller_product_id)
            : null;
        if (sellerProductId) agreementProductIds.add(sellerProductId);
        const name = String(
          l.product_name || l.name || l.sku || 'Agreement line'
        ).trim();
        if (!name) continue;
        items.push({
          key: `agreement:${l.id}`,
          source: 'agreement',
          seller_product_id: sellerProductId,
          product_name: name,
          sku: l.sku ? String(l.sku) : null,
          product_type: l.product_type
            ? String(l.product_type)
            : 'finished_good',
          uom: l.uom ? String(l.uom) : 'ea',
          unit_price: Number(l.list_price ?? l.unit_price ?? 0) || 0,
          currency: String(l.currency || a?.currency || currencyPref).toUpperCase(),
          agreement_id: a ? Number(a.id) : null,
          agreement_line_id: Number(l.id),
          agreement_title: a?.title || a?.agreement_number || null,
          primary_image_url: l.primary_image_url || null,
          short_description: l.notes || l.short_description || null,
        });
      }
    }

    // ── 2) Supplier inventory (sellable finished goods / services / …) ──
    const { data: products, error: prodErr } = await supabase
      .from('products')
      .select(
        'id, name, sku, product_type, uom, status, is_sellable, sell_price, cost_price, base_currency, prices, primary_image_url, short_description, category, public_id, onchain_hash, onchain_status, onchain_tx_hash, onchain_chain'
      )
      .eq('profile_id', sellerProfileId)
      .order('name');

    if (prodErr) {
      // Soft — agreements alone may still populate the picker
      if (!/relation|does not exist/i.test(prodErr.message)) {
        console.warn('catalogue products', prodErr.message);
      }
    }

    let inventoryCount = 0;
    for (const raw of products || []) {
      const p = raw as ProductRecord & {
        is_sellable?: boolean | null;
        status?: string | null;
      };
      const st = String(p.status || 'active').toLowerCase();
      if (st === 'archived' || st === 'inactive' || st === 'deleted') continue;
      if (p.is_sellable === false) continue;

      const type = String(p.product_type || 'finished_good').toLowerCase();
      // PO-facing catalogue: sellable goods & services (not internal WIP-only types)
      if (type === 'wip' || type === 'work_in_progress') continue;

      // Skip inventory rows already covered by an agreement line (prefer list price)
      if (agreementProductIds.has(Number(p.id))) continue;

      const priced = priceForCurrency(p, currencyPref);
      // Seller list: prefer their sell price (what they charge)
      const unit =
        Number(priced.unit_price) > 0
          ? Number(priced.unit_price)
          : Number(priced.cost_price) || 0;

      const prod = p as ProductRecord & {
        public_id?: string | null;
        onchain_hash?: string | null;
        onchain_status?: string | null;
        onchain_tx_hash?: string | null;
        onchain_chain?: string | null;
      };
      items.push({
        key: `inventory:${p.id}`,
        source: 'inventory',
        seller_product_id: Number(p.id),
        product_name: String(p.name || 'Product'),
        sku: p.sku ? String(p.sku) : null,
        product_type: type,
        uom: p.uom ? String(p.uom) : 'ea',
        unit_price: unit,
        currency: String(priced.currency || currencyPref).toUpperCase(),
        agreement_id: null,
        agreement_line_id: null,
        agreement_title: null,
        primary_image_url: p.primary_image_url || null,
        short_description: p.short_description || null,
        public_id: prod.public_id ? String(prod.public_id) : null,
        onchain_hash: prod.onchain_hash ? String(prod.onchain_hash) : null,
        onchain_status: prod.onchain_status ? String(prod.onchain_status) : null,
        onchain_tx_hash: prod.onchain_tx_hash
          ? String(prod.onchain_tx_hash)
          : null,
        onchain_chain: prod.onchain_chain ? String(prod.onchain_chain) : null,
      });
      inventoryCount += 1;
    }

    // Enrich agreement lines with passport fields from product ids
    const needPassport = [
      ...new Set(
        items
          .filter((i) => i.seller_product_id && !i.public_id)
          .map((i) => Number(i.seller_product_id))
          .filter((n) => Number.isFinite(n) && n > 0)
      ),
    ];
    if (needPassport.length) {
      const { data: passports } = await supabase
        .from('products')
        .select(
          'id, public_id, onchain_hash, onchain_status, onchain_tx_hash, onchain_chain, primary_image_url'
        )
        .in('id', needPassport);
      const byId = new Map(
        (passports || []).map((row) => [Number(row.id), row])
      );
      for (const item of items) {
        if (!item.seller_product_id || item.public_id) continue;
        const row = byId.get(Number(item.seller_product_id));
        if (!row) continue;
        item.public_id = row.public_id ? String(row.public_id) : null;
        item.onchain_hash = row.onchain_hash ? String(row.onchain_hash) : null;
        item.onchain_status = row.onchain_status
          ? String(row.onchain_status)
          : null;
        item.onchain_tx_hash = row.onchain_tx_hash
          ? String(row.onchain_tx_hash)
          : null;
        item.onchain_chain = row.onchain_chain
          ? String(row.onchain_chain)
          : null;
        if (!item.primary_image_url && row.primary_image_url) {
          item.primary_image_url = String(row.primary_image_url);
        }
      }
    }

    // Buyer’s own purchasable SKUs — book-only fallback and always on SRM POs
    let buyerInventoryCount = 0;
    if (srmRow) {
      const exclude = items
        .map((i) => Number(i.seller_product_id))
        .filter((n) => Number.isFinite(n) && n > 0);
      const buyerItems = await loadBuyerInventoryItems(
        supabase,
        companyId,
        currencyPref,
        exclude
      );
      buyerInventoryCount = buyerItems.length;
      items.push(...buyerItems);
    }

    if (srmRow) {
      try {
        const { lookupAcceptedMap } = await import('@/lib/commercial/db');
        const accepted = await lookupAcceptedMap({
          profileId: companyId,
          partyKind: 'supplier',
          supplierId: Number(srmRow.id),
        });
        for (const item of items) {
          const pid = Number(item.seller_product_id);
          if (Object.prototype.hasOwnProperty.call(accepted, pid)) {
            item.unit_price = accepted[pid];
          }
        }
      } catch {
        /* optional until SQL paste */
      }
    }

    // Stable sort: agreements, supplier inventory, buyer inventory, then type/name
    items.sort((a, b) => {
      const ra = poCatalogueSourceRank(a.source);
      const rb = poCatalogueSourceRank(b.source);
      if (ra !== rb) return ra - rb;
      const ta = a.product_type || '';
      const tb = b.product_type || '';
      if (ta !== tb) return ta.localeCompare(tb);
      return a.product_name.localeCompare(b.product_name);
    });

    const empty = items.length === 0;
    const nudge = sp.get('nudge') === '1';

    // Soft-notify supplier once when buyer hits empty catalogue (client rate-limits)
    // First-class tracking: activity_log catalogue.nudge + email
    if (empty && nudge && sellerProfileId) {
      void (async () => {
        try {
          const { data: buyerProf } = await supabase
            .from('profiles')
            .select('trading_name')
            .eq('id', companyId)
            .maybeSingle();
          const buyerName = buyerProf?.trading_name || null;

          await supabase.from('activity_log').insert({
            profile_id: sellerProfileId,
            actor_user_id: 'system:catalogue-nudge',
            action: 'catalogue.nudge',
            entity_type: 'catalogue',
            entity_id: String(companyId),
            summary: `Buyer ${buyerName || `#${companyId}`} hit empty catalogue — publish finished goods`,
            metadata: {
              buyerProfileId: companyId,
              buyerName,
              sellerProfileId,
              source: 'po_picker',
            },
          });

          const { notifyPublishCatalogue } = await import(
            '@/lib/notifications/email-alerts'
          );
          await notifyPublishCatalogue({
            supplierProfileId: sellerProfileId,
            buyerProfileId: companyId,
            buyerName,
          });
        } catch (e) {
          console.warn('catalogue nudge soft-fail', e);
        }
      })();
    }

    const { computeCatalogueReadiness } = await import(
      '@/lib/suppliers/catalogue-readiness'
    );
    const readiness = await computeCatalogueReadiness(sellerProfileId, {
      buyerProfileId: companyId,
    });

    return NextResponse.json({
      success: true,
      sellerProfileId,
      sellerName: supplierName,
      connection: edgeOk
        ? { ok: true, status: 'accepted' }
        : edge
          ? { ok: false, status: String(edge.status) }
          : { ok: false, status: srmRow ? 'srm_book' : 'none' },
      items,
      agreementCount: items.filter((i) => i.source === 'agreement').length,
      inventoryCount,
      buyerInventoryCount,
      catalogueSource:
        items.some(
          (i) => i.source === 'agreement' || i.source === 'inventory'
        ) && items.some((i) => i.source === 'buyer_inventory')
          ? 'mixed'
          : items.some((i) => i.source === 'buyer_inventory')
            ? 'buyer_inventory'
            : items.length
              ? 'supplier'
              : 'empty',
      readiness,
      warning:
        empty
          ? srmRow
            ? 'No supplier catalogue and no purchasable products in your inventory. Use free-text lines, add SKUs under Inventory, or ask them to publish.'
            : 'No sellable catalogue from this supplier yet. Use free-text lines, or ask them to publish inventory / share a price list.'
          : undefined,
      nudged: empty && nudge,
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
