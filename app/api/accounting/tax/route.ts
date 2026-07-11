import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { assertAccountingAccess } from '@/lib/accounting/access';
import { parseCompanyId, round2 } from '@/lib/accounting/server';
import { DEFAULT_TAX_RATES } from '@/lib/accounting/coa';
import {
  computeVatAmount,
  resolveVatCategory,
  suggestVatCode,
  type VatCategory,
  type VatRateLike,
} from '@/lib/accounting/vat';
import { requireCompanyAccess, legacyPrivyFrom, requireVerifiedUser } from '@/lib/auth/api-auth';

function rateMap(rates: VatRateLike[]) {
  const m = new Map<string, VatRateLike>();
  for (const r of rates) {
    if (r.code) m.set(String(r.code).toUpperCase(), r);
  }
  return m;
}

function findRate(
  map: Map<string, VatRateLike>,
  code: string | null | undefined,
  fallbackRate?: number | null
): VatRateLike | null {
  if (code && map.has(String(code).toUpperCase())) {
    return map.get(String(code).toUpperCase())!;
  }
  // fall back to default standard
  for (const r of map.values()) {
    if (r.is_default) return r;
  }
  if (fallbackRate != null) {
    return { code: 'CUSTOM', rate: Number(fallbackRate), category: Number(fallbackRate) > 0 ? 'standard' : 'exempt' };
  }
  return null;
}

export async function GET(request: NextRequest) {
  try {
    const companyId = parseCompanyId(request.nextUrl.searchParams.get('companyId'));
    const privyUserId = request.nextUrl.searchParams.get('privyUserId');
    const from = request.nextUrl.searchParams.get('from');
    const to = request.nextUrl.searchParams.get('to');
    const includeUnclassified = request.nextUrl.searchParams.get('includeUnclassified') !== '0';

    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }

    const _gate = await requireCompanyAccess(request, companyId, { legacyPrivyUserId: legacyPrivyFrom(request) });
    if (!_gate.ok) return _gate.response;

    const supabase = getSupabaseServer();
    const { data: ratesRaw, error } = await supabase
      .from('tax_rates')
      .select('*')
      .eq('profile_id', companyId)
      .order('rate', { ascending: false });

    if (error) {
      return NextResponse.json({
        success: true,
        rates: [],
        summary: null,
        returnBox: null,
        warning: error.message,
        hint: 'Run supabase/migrations/20260710_accounting_module.sql and 20260711_vat_tax_categories.sql',
      });
    }

    const rates = (ratesRaw || []).map((r) => ({
      ...r,
      category: resolveVatCategory(r),
    }));
    const map = rateMap(rates);

    // ── Invoices (output AR / input AP) ────────────────────────────────────
    let invQ = supabase
      .from('invoices')
      .select(
        'id, direction, status, tax_amount, tax_rate, tax_code, subtotal, total_amount, issue_date, invoice_number, counterparty_name'
      )
      .eq('profile_id', companyId)
      .not('status', 'in', '("void","cancelled","draft")');
    if (from) invQ = invQ.gte('issue_date', from);
    if (to) invQ = invQ.lte('issue_date', to);
    const { data: invoices } = await invQ.limit(2000);

    // ── Bank transactions with tax classification ─────────────────────────
    let bankQ = supabase
      .from('bank_transactions')
      .select(
        'id, txn_date, description, amount, tax_code, tax_amount, tax_inclusive, allocation_status, counterparty_name, gl_account_id, category'
      )
      .eq('profile_id', companyId);
    if (from) bankQ = bankQ.gte('txn_date', from);
    if (to) bankQ = bankQ.lte('txn_date', to);
    const { data: bankTxns } = await bankQ.order('txn_date', { ascending: false }).limit(2000);

    let outputVat = 0;
    let inputVat = 0;
    let outputNet = 0;
    let inputNet = 0;
    let exemptTurnover = 0;
    let zeroRatedTurnover = 0;
    let outOfScope = 0;

    const byCode: Record<
      string,
      {
        code: string;
        name: string;
        category: VatCategory;
        rate: number;
        outputVat: number;
        inputVat: number;
        outputNet: number;
        inputNet: number;
        count: number;
      }
    > = {};

    const ensureCode = (code: string, rateLike: VatRateLike | null) => {
      const key = code.toUpperCase();
      if (!byCode[key]) {
        const cat = resolveVatCategory(rateLike);
        byCode[key] = {
          code: key,
          name: String(rateLike?.name || key),
          category: cat,
          rate: Number(rateLike?.rate || 0),
          outputVat: 0,
          inputVat: 0,
          outputNet: 0,
          inputNet: 0,
          count: 0,
        };
      }
      return byCode[key];
    };

    const invoiceLines: Array<Record<string, unknown>> = [];

    for (const inv of invoices || []) {
      const tax = Number(inv.tax_amount || 0);
      const total = Number(inv.total_amount || 0);
      const sub = Number(inv.subtotal || 0) || round2(total - tax);
      const rateLike =
        findRate(map, inv.tax_code, inv.tax_rate) ||
        ({
          code: inv.tax_code || (tax > 0 ? 'VAT15' : 'EXEMPT'),
          rate: inv.tax_rate ?? (tax > 0 && sub > 0 ? (tax / sub) * 100 : 0),
        } as VatRateLike);
      const cat = resolveVatCategory(rateLike);
      const code = String(rateLike?.code || 'UNCLASSIFIED').toUpperCase();
      const bucket = ensureCode(code, rateLike);

      if (inv.direction === 'receivable') {
        // Sales → output VAT
        if (cat === 'standard') {
          outputVat += tax;
          outputNet += sub;
          bucket.outputVat += tax;
          bucket.outputNet += sub;
        } else if (cat === 'zero_rated') {
          zeroRatedTurnover += total || sub;
          bucket.outputNet += sub || total;
        } else if (cat === 'exempt') {
          exemptTurnover += total || sub;
        } else {
          outOfScope += total || sub;
        }
        bucket.count += 1;
      } else if (inv.direction === 'payable') {
        // Purchases → input VAT (if recoverable)
        const recoverable = rateLike?.is_recoverable !== false && cat === 'standard';
        if (recoverable) {
          inputVat += tax;
          inputNet += sub;
          bucket.inputVat += tax;
          bucket.inputNet += sub;
        } else if (cat === 'zero_rated') {
          bucket.inputNet += sub || total;
        } else if (cat === 'exempt') {
          exemptTurnover += 0; // purchase exempt — not turnover
        }
        bucket.count += 1;
      }

      invoiceLines.push({
        id: inv.id,
        source: 'invoice',
        direction: inv.direction,
        date: inv.issue_date,
        ref: inv.invoice_number,
        counterparty: inv.counterparty_name,
        net: sub,
        vat: tax,
        gross: total,
        tax_code: code,
        category: cat,
        side: inv.direction === 'receivable' ? 'output' : 'input',
      });
    }

    const bankLines: Array<Record<string, unknown>> = [];
    const unclassified: Array<Record<string, unknown>> = [];

    for (const t of bankTxns || []) {
      const amount = Number(t.amount || 0);
      const code = t.tax_code ? String(t.tax_code).toUpperCase() : null;
      const abs = Math.abs(amount);
      const isInflow = amount > 0;

      if (!code) {
        if (includeUnclassified) {
          const suggestion = suggestVatCode(t.description, amount);
          unclassified.push({
            id: t.id,
            txn_date: t.txn_date,
            description: t.description,
            amount,
            suggested_code: suggestion.code,
            suggested_reason: suggestion.reason,
            allocation_status: t.allocation_status,
          });
        }
        continue;
      }

      const rateLike = findRate(map, code);
      const cat = resolveVatCategory(rateLike);
      const ratePct = Number(rateLike?.rate || 0);
      const taxInclusive = t.tax_inclusive !== false;
      let vat = Number(t.tax_amount || 0);
      let net = abs;

      if (cat === 'standard' && ratePct > 0) {
        const calc = computeVatAmount({
          amount: abs,
          ratePct,
          category: cat,
          taxInclusive,
        });
        // Prefer stored tax_amount if set; else recompute
        if (!vat || vat <= 0) vat = calc.vat;
        net = calc.net;
      } else {
        vat = 0;
        net = abs;
      }

      const bucket = ensureCode(code, rateLike);
      bucket.count += 1;

      // Outflow = purchase (input), inflow = sale-like (output)
      if (isInflow) {
        if (cat === 'standard') {
          outputVat += vat;
          outputNet += net;
          bucket.outputVat += vat;
          bucket.outputNet += net;
        } else if (cat === 'zero_rated') {
          zeroRatedTurnover += abs;
          bucket.outputNet += abs;
        } else if (cat === 'exempt') {
          exemptTurnover += abs;
        } else {
          outOfScope += abs;
        }
      } else {
        if (cat === 'standard' && rateLike?.is_recoverable !== false) {
          inputVat += vat;
          inputNet += net;
          bucket.inputVat += vat;
          bucket.inputNet += net;
        } else if (cat === 'zero_rated') {
          bucket.inputNet += abs;
        } else if (cat === 'out_of_scope') {
          outOfScope += abs;
        }
      }

      bankLines.push({
        id: t.id,
        source: 'bank',
        direction: isInflow ? 'inflow' : 'outflow',
        date: t.txn_date,
        ref: t.description,
        counterparty: t.counterparty_name,
        net,
        vat,
        gross: abs,
        tax_code: code,
        category: cat,
        tax_inclusive: taxInclusive,
        side: isInflow ? 'output' : 'input',
      });
    }

    outputVat = round2(outputVat);
    inputVat = round2(inputVat);
    const netVat = round2(outputVat - inputVat);

    for (const b of Object.values(byCode)) {
      b.outputVat = round2(b.outputVat);
      b.inputVat = round2(b.inputVat);
      b.outputNet = round2(b.outputNet);
      b.inputNet = round2(b.inputNet);
    }

    return NextResponse.json({
      success: true,
      rates,
      period: { from, to },
      summary: {
        outputVat,
        inputVat,
        netVat,
        invoiceCount: (invoices || []).length,
        bankClassified: bankLines.length,
        bankUnclassified: unclassified.length,
        outputNet: round2(outputNet),
        inputNet: round2(inputNet),
        exemptTurnover: round2(exemptTurnover),
        zeroRatedTurnover: round2(zeroRatedTurnover),
        outOfScope: round2(outOfScope),
      },
      returnBox: {
        /** VAT on sales (output) */
        outputVat,
        /** VAT on purchases (input / reclaimable) */
        inputVat,
        /** Positive = payable to SARS; negative = refundable */
        netVat,
        payableToSars: netVat > 0 ? netVat : 0,
        refundDue: netVat < 0 ? Math.abs(netVat) : 0,
        standardRatedSales: round2(outputNet),
        standardRatedPurchases: round2(inputNet),
        zeroRatedSupplies: round2(zeroRatedTurnover),
        exemptSupplies: round2(exemptTurnover),
        outOfScope: round2(outOfScope),
      },
      byCode: Object.values(byCode).sort((a, b) => b.outputVat + b.inputVat - (a.outputVat + a.inputVat)),
      invoiceLines: invoiceLines.slice(0, 200),
      bankLines: bankLines.slice(0, 200),
      unclassified: unclassified.slice(0, 100),
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const companyId = parseCompanyId(body.companyId);
    const privyUserId = body.privyUserId as string | undefined;

    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }

    const _gate = await requireCompanyAccess(request, companyId, { legacyPrivyUserId: legacyPrivyFrom(request) });
    if (!_gate.ok) return _gate.response;

    const supabase = getSupabaseServer();

    // ── Seed ZA VAT codes ─────────────────────────────────────────────────
    if (body.seed) {
      const { data: existing } = await supabase
        .from('tax_rates')
        .select('id, code')
        .eq('profile_id', companyId);
      const have = new Set((existing || []).map((r) => String(r.code).toUpperCase()));
      const toInsert = DEFAULT_TAX_RATES.filter((t) => !have.has(t.code.toUpperCase())).map(
        (t) => ({
          profile_id: companyId,
          code: t.code,
          name: t.name,
          rate: t.rate,
          tax_type: t.tax_type,
          is_default: t.is_default,
          is_recoverable: t.is_recoverable !== false,
          country: t.country,
          category: t.category || 'standard',
          status: 'active',
          metadata: { category: t.category },
        })
      );
      if (!toInsert.length) {
        return NextResponse.json({
          success: true,
          seeded: 0,
          message: 'VAT codes already present',
        });
      }
      const { data, error } = await supabase.from('tax_rates').insert(toInsert).select('id');
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ success: true, seeded: data?.length || 0 });
    }

    // ── Classify one or many bank transactions ────────────────────────────
    if (body.action === 'classify_bank' || body.classifyBank) {
      const ids: Array<string | number> = Array.isArray(body.ids)
        ? body.ids
        : body.id != null
          ? [body.id]
          : [];
      if (!ids.length) {
        return NextResponse.json({ error: 'ids required' }, { status: 400 });
      }

      const taxCode = String(body.tax_code || body.taxCode || '').trim().toUpperCase();
      if (!taxCode) {
        return NextResponse.json({ error: 'tax_code required' }, { status: 400 });
      }

      const { data: rates } = await supabase
        .from('tax_rates')
        .select('*')
        .eq('profile_id', companyId);
      const map = rateMap(rates || []);
      const rateLike = findRate(map, taxCode);
      if (!rateLike && !['VAT15', 'VAT0', 'EXEMPT', 'OUT'].includes(taxCode)) {
        // allow free-text codes with explicit rate
      }
      const cat = resolveVatCategory(rateLike || { code: taxCode, rate: body.rate });
      const ratePct =
        body.rate != null
          ? Number(body.rate)
          : Number(rateLike?.rate || (taxCode === 'VAT15' ? 15 : 0));
      const taxInclusive = body.tax_inclusive !== false && body.taxInclusive !== false;

      const { data: rows, error: fetchErr } = await supabase
        .from('bank_transactions')
        .select('id, amount, tax_amount')
        .eq('profile_id', companyId)
        .in('id', ids);

      if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 400 });

      let updated = 0;
      for (const row of rows || []) {
        const abs = Math.abs(Number(row.amount || 0));
        const calc = computeVatAmount({
          amount: abs,
          ratePct,
          category: cat,
          taxInclusive,
        });
        const tax_amount =
          body.tax_amount != null ? Number(body.tax_amount) : calc.vat;

        const patch: Record<string, unknown> = {
          tax_code: taxCode,
          tax_amount,
          updated_at: new Date().toISOString(),
        };
        // tax_inclusive may not exist on older DBs — try, ignore failure via second attempt
        patch.tax_inclusive = taxInclusive;

        let { error } = await supabase
          .from('bank_transactions')
          .update(patch)
          .eq('id', row.id)
          .eq('profile_id', companyId);

        if (error && String(error.message || '').includes('tax_inclusive')) {
          delete patch.tax_inclusive;
          const retry = await supabase
            .from('bank_transactions')
            .update(patch)
            .eq('id', row.id)
            .eq('profile_id', companyId);
          error = retry.error;
        }
        if (!error) updated += 1;
      }

      return NextResponse.json({
        success: true,
        updated,
        tax_code: taxCode,
        category: cat,
        rate: ratePct,
        tax_inclusive: taxInclusive,
      });
    }

    // ── Auto-suggest + classify all unclassified in period ────────────────
    if (body.action === 'auto_classify') {
      const from = body.from as string | undefined;
      const to = body.to as string | undefined;
      let q = supabase
        .from('bank_transactions')
        .select('id, amount, description, tax_code')
        .eq('profile_id', companyId)
        .or('tax_code.is.null,tax_code.eq.');
      if (from) q = q.gte('txn_date', from);
      if (to) q = q.lte('txn_date', to);
      const { data: rows, error } = await q.limit(500);
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });

      const { data: rates } = await supabase
        .from('tax_rates')
        .select('*')
        .eq('profile_id', companyId);
      const map = rateMap(rates || []);

      let updated = 0;
      const results: Array<Record<string, unknown>> = [];
      for (const row of rows || []) {
        if (row.tax_code) continue;
        const suggestion = suggestVatCode(row.description, Number(row.amount || 0));
        const rateLike = findRate(map, suggestion.code) || {
          code: suggestion.code,
          rate: suggestion.code === 'VAT15' ? 15 : 0,
          category:
            suggestion.code === 'VAT15'
              ? 'standard'
              : suggestion.code === 'VAT0'
                ? 'zero_rated'
                : suggestion.code === 'OUT'
                  ? 'out_of_scope'
                  : 'exempt',
        };
        const cat = resolveVatCategory(rateLike);
        const ratePct = Number(rateLike.rate || 0);
        const calc = computeVatAmount({
          amount: Math.abs(Number(row.amount || 0)),
          ratePct,
          category: cat,
          taxInclusive: true,
        });
        const patch = {
          tax_code: suggestion.code,
          tax_amount: calc.vat,
          tax_inclusive: true,
          updated_at: new Date().toISOString(),
        };
        let { error: upErr } = await supabase
          .from('bank_transactions')
          .update(patch)
          .eq('id', row.id)
          .eq('profile_id', companyId);
        if (upErr && String(upErr.message || '').includes('tax_inclusive')) {
          const { tax_inclusive: _ti, ...rest } = patch;
          const retry = await supabase
            .from('bank_transactions')
            .update(rest)
            .eq('id', row.id)
            .eq('profile_id', companyId);
          upErr = retry.error;
        }
        if (!upErr) {
          updated += 1;
          results.push({
            id: row.id,
            tax_code: suggestion.code,
            tax_amount: calc.vat,
            reason: suggestion.reason,
          });
        }
      }

      return NextResponse.json({ success: true, updated, results: results.slice(0, 50) });
    }

    // ── Preview VAT split (UI helper) ─────────────────────────────────────
    if (body.action === 'preview') {
      const amount = Number(body.amount || 0);
      const ratePct = Number(body.rate ?? 15);
      const category = (body.category || 'standard') as VatCategory;
      const taxInclusive = body.tax_inclusive !== false;
      const calc = computeVatAmount({ amount, ratePct, category, taxInclusive });
      return NextResponse.json({ success: true, ...calc });
    }

    // ── Create tax rate ───────────────────────────────────────────────────
    if (!body.code || !body.name || body.rate == null) {
      return NextResponse.json(
        { error: 'code, name, and rate required (or pass seed/classify action)' },
        { status: 400 }
      );
    }

    if (body.is_default) {
      await supabase
        .from('tax_rates')
        .update({ is_default: false })
        .eq('profile_id', companyId);
    }

    const category =
      body.category ||
      resolveVatCategory({
        code: body.code,
        name: body.name,
        rate: Number(body.rate),
      });

    const insertPayload: Record<string, unknown> = {
      profile_id: companyId,
      code: String(body.code).trim(),
      name: String(body.name).trim(),
      rate: Number(body.rate),
      country: body.country || 'ZA',
      tax_type: body.tax_type || 'vat',
      is_default: !!body.is_default,
      is_recoverable: body.is_recoverable !== false,
      gl_account_id: body.gl_account_id || null,
      status: 'active',
      effective_from: body.effective_from || null,
      effective_to: body.effective_to || null,
      category,
      metadata: { category, ...(body.metadata || {}) },
    };

    let { data, error } = await supabase
      .from('tax_rates')
      .insert(insertPayload)
      .select('*')
      .single();

    if (error && String(error.message || '').includes('category')) {
      delete insertPayload.category;
      const retry = await supabase.from('tax_rates').insert(insertPayload).select('*').single();
      data = retry.data;
      error = retry.error;
    }

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ success: true, rate: data });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const companyId = parseCompanyId(body.companyId);
    const id = Number(body.id);
    const privyUserId = body.privyUserId as string | undefined;

    if (!Number.isFinite(companyId) || !Number.isFinite(id)) {
      return NextResponse.json({ error: 'companyId and id required' }, { status: 400 });
    }
    const _gate = await requireCompanyAccess(request, companyId, { legacyPrivyUserId: privyUserId || legacyPrivyFrom(request) });
    if (!_gate.ok) return _gate.response;

    const supabase = getSupabaseServer();
    if (body.is_default) {
      await supabase
        .from('tax_rates')
        .update({ is_default: false })
        .eq('profile_id', companyId);
    }

    const allowed = [
      'code',
      'name',
      'rate',
      'country',
      'tax_type',
      'is_default',
      'is_recoverable',
      'gl_account_id',
      'status',
      'effective_from',
      'effective_to',
      'category',
    ];
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    for (const k of allowed) {
      if (body[k] !== undefined) patch[k] = body[k];
    }
    if (body.category) {
      patch.metadata = { category: body.category };
    }

    let { data, error } = await supabase
      .from('tax_rates')
      .update(patch)
      .eq('id', id)
      .eq('profile_id', companyId)
      .select('*')
      .single();

    if (error && String(error.message || '').includes('category')) {
      delete patch.category;
      const retry = await supabase
        .from('tax_rates')
        .update(patch)
        .eq('id', id)
        .eq('profile_id', companyId)
        .select('*')
        .single();
      data = retry.data;
      error = retry.error;
    }

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ success: true, rate: data });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
