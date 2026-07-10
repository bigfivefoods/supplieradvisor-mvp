import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { assertCompanyMember, logActivity } from '@/lib/customers/access';
import { hashProductIdentity } from '@/lib/inventory/hash';
import { normalizeProductPrices, productQrPayload } from '@/lib/inventory/types';
import { lookupListPrice } from '@/lib/pricing/access';
import { findConnectionBetween } from '@/lib/connections/sync';

/**
 * POST — import a product into the buyer's catalogue from a connected seller
 * (or from a pricing agreement line). Copies specs so sales companies up the
 * chain keep manufacturer datasheets while setting their own sell price.
 *
 * Body: {
 *   companyId, privyUserId,
 *   sellerProfileId,
 *   sellerProductId? | agreementLineId?,
 *   sell_price?, cost_price?,  // defaults: cost = list price, sell = suggested resale or markup
 *   sku?, name?
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const companyId = Number(body.companyId);
    const sellerProfileId = Number(body.sellerProfileId || body.seller_profile_id);

    if (!Number.isFinite(companyId) || !Number.isFinite(sellerProfileId)) {
      return NextResponse.json(
        { error: 'companyId and sellerProfileId required' },
        { status: 400 }
      );
    }
    if (companyId === sellerProfileId) {
      return NextResponse.json(
        { error: 'Cannot import from your own company' },
        { status: 400 }
      );
    }

    const mem = await assertCompanyMember(body.privyUserId, companyId);
    if (!mem.ok) {
      return NextResponse.json({ error: mem.error }, { status: mem.status });
    }

    const edge = await findConnectionBetween(companyId, sellerProfileId);
    if (!edge || String(edge.status) !== 'accepted') {
      return NextResponse.json(
        { error: 'Connect with the seller company before importing products' },
        { status: 403 }
      );
    }

    const supabase = getSupabaseServer();
    const now = new Date().toISOString();

    let sourceProduct: Record<string, unknown> | null = null;
    let agreementId: number | null = null;
    let agreementLineId: number | null = null;
    let listPrice: number | null = null;
    let suggestedResale: number | null = null;
    let currency = 'ZAR';
    let specsUrl: string | null = null;
    let specsName: string | null = null;
    let imageUrl: string | null = null;
    let productName = '';
    let sku: string | null = null;
    let uom = 'unit';
    let category = 'General';
    let productType = 'finished_good';
    let shortDescription: string | null = null;

    if (body.agreementLineId) {
      const { data: line } = await supabase
        .from('pricing_agreement_lines')
        .select('*, pricing_agreements!inner(*)')
        .eq('id', Number(body.agreementLineId))
        .maybeSingle();

      // Fallback without join if FK name differs
      let lineRow = line;
      if (!lineRow) {
        const { data: plain } = await supabase
          .from('pricing_agreement_lines')
          .select('*')
          .eq('id', Number(body.agreementLineId))
          .maybeSingle();
        lineRow = plain;
      }
      if (!lineRow) {
        return NextResponse.json({ error: 'Agreement line not found' }, { status: 404 });
      }

      const { data: agreement } = await supabase
        .from('pricing_agreements')
        .select('*')
        .eq('id', Number(lineRow.agreement_id))
        .maybeSingle();

      if (
        !agreement ||
        Number(agreement.buyer_profile_id) !== companyId ||
        Number(agreement.seller_profile_id) !== sellerProfileId
      ) {
        return NextResponse.json(
          { error: 'Agreement line does not belong to this buyer/seller pair' },
          { status: 403 }
        );
      }
      if (String(agreement.status) !== 'active') {
        return NextResponse.json(
          { error: 'Pricing agreement is not active' },
          { status: 400 }
        );
      }

      agreementId = Number(agreement.id);
      agreementLineId = Number(lineRow.id);
      listPrice = Number(lineRow.list_price || 0);
      suggestedResale =
        lineRow.suggested_resale_price != null
          ? Number(lineRow.suggested_resale_price)
          : null;
      currency = String(lineRow.currency || agreement.currency || 'ZAR');
      productName = String(lineRow.product_name);
      sku = lineRow.sku || null;
      uom = lineRow.uom || 'unit';
      specsUrl = lineRow.specs_sheet_url || null;
      specsName = lineRow.specs_sheet_name || null;
      imageUrl = lineRow.primary_image_url || null;

      if (lineRow.seller_product_id) {
        const { data: prod } = await supabase
          .from('products')
          .select('*')
          .eq('id', Number(lineRow.seller_product_id))
          .eq('profile_id', sellerProfileId)
          .maybeSingle();
        if (prod) {
          sourceProduct = prod;
          if (!specsUrl) {
            specsUrl = prod.specs_sheet_url || null;
            specsName = prod.specs_sheet_name || null;
          }
          if (!imageUrl) imageUrl = prod.primary_image_url || null;
          category = prod.category || category;
          productType = prod.product_type || productType;
          shortDescription = prod.short_description || null;
          if (!sku) sku = prod.sku || null;
        }
      }
    } else if (body.sellerProductId || body.seller_product_id) {
      const sellerProductId = Number(body.sellerProductId || body.seller_product_id);
      const { data: prod, error: pErr } = await supabase
        .from('products')
        .select('*')
        .eq('id', sellerProductId)
        .eq('profile_id', sellerProfileId)
        .maybeSingle();
      if (pErr || !prod) {
        return NextResponse.json({ error: 'Seller product not found' }, { status: 404 });
      }
      sourceProduct = prod;
      productName = String(prod.name);
      sku = prod.sku || null;
      uom = prod.uom || 'unit';
      category = prod.category || 'General';
      productType = prod.product_type || 'finished_good';
      shortDescription = prod.short_description || null;
      specsUrl = prod.specs_sheet_url || null;
      specsName = prod.specs_sheet_name || null;
      imageUrl = prod.primary_image_url || null;
      currency = prod.base_currency || 'ZAR';

      const hit = await lookupListPrice({
        sellerProfileId,
        buyerProfileId: companyId,
        sellerProductId,
        sku,
      });
      if (hit) {
        listPrice = hit.list_price;
        suggestedResale = hit.suggested_resale_price ?? null;
        currency = hit.currency;
        agreementId = hit.agreement_id;
        agreementLineId = hit.line_id;
        if (!specsUrl) {
          specsUrl = hit.specs_sheet_url || null;
          specsName = hit.specs_sheet_name || null;
        }
      } else if (prod.sell_price != null) {
        listPrice = Number(prod.sell_price);
      }
    } else {
      return NextResponse.json(
        { error: 'sellerProductId or agreementLineId required' },
        { status: 400 }
      );
    }

    if (body.name) productName = String(body.name).trim();
    if (body.sku) sku = String(body.sku).trim();

    // Avoid duplicate import of same upstream product
    if (sourceProduct?.id) {
      const { data: existing } = await supabase
        .from('products')
        .select('id, name')
        .eq('profile_id', companyId)
        .eq('source_product_id', Number(sourceProduct.id))
        .maybeSingle();
      if (existing) {
        return NextResponse.json({
          success: true,
          alreadyImported: true,
          product: existing,
          message: 'Product already in your catalogue from this upstream source',
        });
      }
    }

    const cost =
      body.cost_price != null
        ? Number(body.cost_price)
        : listPrice != null
          ? listPrice
          : 0;
    const sell =
      body.sell_price != null
        ? Number(body.sell_price)
        : suggestedResale != null
          ? suggestedResale
          : cost > 0
            ? Math.round(cost * 1.25 * 100) / 100 // default 25% margin for on-sell
            : 0;

    const priceRows = normalizeProductPrices([
      {
        currency,
        cost_price: cost,
        sell_price: sell,
      },
    ]);

    const publicId = randomUUID();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    const qrPayload = productQrPayload(publicId, appUrl);
    const onchainHash = hashProductIdentity({
      profileId: companyId,
      publicId,
      sku,
      name: productName,
      uom,
    });

    const payload: Record<string, unknown> = {
      profile_id: companyId,
      name: productName,
      sku,
      category,
      product_type: productType,
      uom,
      base_currency: currency,
      sell_price: sell,
      cost_price: cost,
      prices: priceRows,
      short_description: shortDescription,
      status: 'active',
      primary_image_url: imageUrl,
      // Local specs copy — buyer can replace with their own sales sheet later
      specs_sheet_url: specsUrl,
      specs_sheet_name: specsName,
      upstream_specs_sheet_url: specsUrl,
      upstream_specs_sheet_name: specsName,
      source_profile_id: sellerProfileId,
      source_product_id: sourceProduct?.id ? Number(sourceProduct.id) : null,
      source_agreement_id: agreementId,
      source_agreement_line_id: agreementLineId,
      is_sellable: true,
      is_purchasable: true,
      public_id: publicId,
      qr_payload: qrPayload,
      onchain_status: 'hashed',
      onchain_hash: onchainHash,
      onchain_chain: 'base-sepolia',
      metadata: {
        imported_from_network: true,
        seller_profile_id: sellerProfileId,
        list_price_at_import: listPrice,
        imported_at: now,
      },
      updated_at: now,
    };

    let { data: created, error: cErr } = await supabase
      .from('products')
      .insert(payload)
      .select('*')
      .single();

    // Soft retry without pedigree columns if migration not applied
    if (cErr && /column|schema cache|does not exist/i.test(cErr.message)) {
      const minimal = {
        profile_id: companyId,
        name: productName,
        sku,
        category,
        uom,
        sell_price: sell,
        cost_price: cost,
        short_description: shortDescription,
        status: 'active',
        primary_image_url: imageUrl,
        specs_sheet_url: specsUrl,
        specs_sheet_name: specsName,
      };
      const retry = await supabase.from('products').insert(minimal).select('*').single();
      created = retry.data;
      cErr = retry.error;
    }

    if (cErr || !created) {
      return NextResponse.json(
        {
          error: cErr?.message || 'Import failed',
          hint: 'Run 20260710_pricing_agreements.sql + inventory migrations',
        },
        { status: 500 }
      );
    }

    await logActivity({
      profile_id: companyId,
      actor_user_id: mem.userId,
      action: 'product.import_from_network',
      entity_type: 'products',
      entity_id: String(created.id),
      summary: `Imported ${productName} from seller #${sellerProfileId}`,
      metadata: {
        sellerProfileId,
        sourceProductId: sourceProduct?.id,
        agreementId,
        cost,
        sell,
      },
    });

    return NextResponse.json({
      success: true,
      product: created,
      pricing: {
        list_price: listPrice,
        cost_price: cost,
        sell_price: sell,
        currency,
        suggested_resale_price: suggestedResale,
        agreement_id: agreementId,
      },
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
