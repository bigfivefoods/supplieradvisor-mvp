import { NextRequest, NextResponse } from 'next/server';
import { legacyPrivyFrom, requireCompanyPermission } from '@/lib/auth/api-auth';
import { canAccess } from '@/lib/business/permissions';
import { rateLimit } from '@/lib/http/rate-limit';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { isVerifyNowConfigured, resolveMode } from '@/lib/verifynow/client';
import {
  DIRECT_VAT_CHECK,
  SUPPLIER_BUNDLE_NOTE,
  VAT_CHECK_NOTE,
  VERIFYNOW_FIELD_PRODUCTS,
  isAsyncBusinessBank,
  readFieldChecks,
  readPublicTrust,
  supplierBundlePrice,
  type FieldCheckId,
} from '@/lib/verifynow/company-checks';
import { fulfillPaidFieldCheck } from '@/lib/verifynow/run-paid-field-check';
import {
  customerPriceFor,
  formatCustomerZar,
  bundleListZar,
  type PricedCheck,
} from '@/lib/verifynow/prices';

const CHECKS = new Set<FieldCheckId>([
  'cipc_company_match',
  'cipc_director_search',
  'said_verification',
  'bank_account',
  'aml_pep',
  'supplier_bundle',
]);

type ProfileRow = Record<string, unknown>;

function text(row: ProfileRow, key: string): string {
  const value = row[key];
  return value == null ? '' : String(value).trim();
}

function pricedRow(check: PricedCheck, asyncBank: boolean) {
  const price = customerPriceFor(check, asyncBank);
  return {
    customerZar: price.zar,
    customerCents: price.cents,
    customerPriceLabel: formatCustomerZar(price.zar),
    vatInclusive: true as const,
  };
}

function productList(asyncBank: boolean) {
  const bank = asyncBank
    ? VERIFYNOW_FIELD_PRODUCTS.business_bank_account
    : VERIFYNOW_FIELD_PRODUCTS.bank_account;
  const bundle = supplierBundlePrice(asyncBank);
  const bundlePrice = pricedRow('supplier_bundle', asyncBank);
  return {
    directVatCheck: DIRECT_VAT_CHECK,
    vatNote: VAT_CHECK_NOTE,
    supplierBundleNote: SUPPLIER_BUNDLE_NOTE,
    pricesVatInclusive: true,
    supplierBundle: {
      availableAsSingleApi: false,
      credits: bundle.credits,
      priceExclVatZar: bundle.priceExclVatZar,
      priceLabel: bundlePrice.customerPriceLabel,
      listZar: bundleListZar(asyncBank),
      ...bundlePrice,
    },
    catalogue: [
      VERIFYNOW_FIELD_PRODUCTS.cipc_company_match,
      VERIFYNOW_FIELD_PRODUCTS.cipc_director_search,
      VERIFYNOW_FIELD_PRODUCTS.said_verification,
      bank,
      VERIFYNOW_FIELD_PRODUCTS.aml_pep,
    ].map((product) => {
      const check = (
        product.id === 'business_bank_account' ? 'bank_account' : product.id
      ) as PricedCheck;
      const price = pricedRow(check, product.id === 'business_bank_account' || product.id === 'bank_account' ? asyncBank : false);
      return {
        ...product,
        priceLabel: price.customerPriceLabel,
        ...price,
      };
    }),
  };
}

async function loadProfile(companyId: number): Promise<ProfileRow | null> {
  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', companyId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as ProfileRow) || null;
}

export async function GET(request: NextRequest) {
  try {
    const companyId = Number(request.nextUrl.searchParams.get('companyId'));
    if (!Number.isFinite(companyId) || companyId <= 0) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }
    const gate = await requireCompanyPermission(request, companyId, 'verification', 'view', {
      legacyPrivyUserId: legacyPrivyFrom(request),
    });
    if (!gate.ok) return gate.response;

    const profile = await loadProfile(companyId);
    if (!profile) return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    const asyncBank = isAsyncBusinessBank(text(profile, 'bank_name'), text(profile, 'branch_code'));
    return NextResponse.json({
      configured: isVerifyNowConfigured(),
      mode: resolveMode(),
      canRun: canAccess(gate.role, 'verification', 'admin'),
      checks: readFieldChecks(profile.metadata),
      publicTrust: readPublicTrust(profile.metadata),
      asyncBank,
      ...productList(asyncBank),
      disabledReason: isVerifyNowConfigured()
        ? null
        : 'VERIFYNOW_API_KEY is not configured on this server, so checks stay off.',
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Could not load checks' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return NextResponse.json({ error: 'JSON body required' }, { status: 400 });
    const companyId = Number(body.companyId);
    const check = String(body.check || '') as FieldCheckId;
    if (!CHECKS.has(check)) {
      return NextResponse.json({ error: 'Unknown check' }, { status: 400 });
    }
    const gate = await requireCompanyPermission(request, companyId, 'verification', 'admin', {
      legacyPrivyUserId: legacyPrivyFrom(request, body),
    });
    if (!gate.ok) return gate.response;
    if (!isVerifyNowConfigured()) {
      return NextResponse.json(
        {
          configured: false,
          error: 'VERIFYNOW_API_KEY is not configured on the server',
        },
        { status: 503 }
      );
    }

    const limited = rateLimit(`verifynow-fields:${companyId}`, {
      limit: 12,
      windowMs: 10 * 60 * 1000,
    });
    if (!limited.ok) {
      return NextResponse.json(
        { error: 'Too many verification attempts. Wait before trying again.' },
        { status: 429, headers: { 'Retry-After': String(limited.retryAfterSec) } }
      );
    }

    const action = body.action === 'refund' || body.action === 'refresh' ? body.action : 'run';
    const purpose = String(body.purpose || '').trim();
    if (action === 'run' && body.consent !== true) {
      return NextResponse.json(
        { error: 'POPIA consent is required before this check runs.' },
        { status: 400 }
      );
    }
    if (action === 'run' && purpose.length < 10) {
      return NextResponse.json(
        { error: 'Add the purpose for this check before it runs.' },
        { status: 400 }
      );
    }

    const result = await fulfillPaidFieldCheck({
      companyId,
      check,
      action,
      paystackReference: String(body.paystackReference || body.reference || ''),
      purpose,
      consent: body.consent === true,
      userId: gate.userId,
    });
    return NextResponse.json(result.body, { status: result.httpStatus });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Verification failed' },
      { status: 500 }
    );
  }
}
