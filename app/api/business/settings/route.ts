import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { logActivity } from '@/lib/customers/access';
import {
  assertCompanyPermission,
  getCompanyMembership,
} from '@/lib/business/access';
import { DEFAULT_SETTINGS, type CompanySettings } from '@/lib/business/types';
import {
  requireCompanyAccess,
  legacyPrivyFrom,
  ROLES_OWNER_OR_FINANCE,
} from '@/lib/auth/api-auth';
import { normalizeFyStartMonth } from '@/lib/accounting/fiscal';
import { applyCompanyFiscalYearToLedger } from '@/lib/accounting/fiscal-year-sync';

/**
 * GET ?companyId=&privyUserId=
 */
export async function GET(request: NextRequest) {
  try {
    const companyId = Number(request.nextUrl.searchParams.get('companyId'));
    const privyUserId = request.nextUrl.searchParams.get('privyUserId');
    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }

    const _gate = await requireCompanyAccess(request, companyId, { legacyPrivyUserId: legacyPrivyFrom(request) });
    if (!_gate.ok) return _gate.response;

    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from('profiles')
      .select('id, trading_name, timezone, primary_currency, is_buyer, is_discoverable, settings')
      .eq('id', companyId)
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ error: 'Company not found' }, { status: 404 });

    const settings = mergeSettings(data);
    return NextResponse.json({
      success: true,
      trading_name: data.trading_name,
      settings,
    });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}

/**
 * PATCH body: { companyId, privyUserId, trading_name?, settings: partial CompanySettings }
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const companyId = Number(body.companyId);
    const settingsWrite = await assertCompanyPermission(
      body.privyUserId,
      companyId,
      'settings',
      'write'
    );
    const membership = await getCompanyMembership(body.privyUserId, companyId);
    const canSetFy =
      membership.ok && ROLES_OWNER_OR_FINANCE.includes(membership.role);

    const supabase = getSupabaseServer();
    const { data: existing, error: loadErr } = await supabase
      .from('profiles')
      .select('id, trading_name, timezone, primary_currency, is_buyer, is_discoverable, settings')
      .eq('id', companyId)
      .maybeSingle();

    if (loadErr) return NextResponse.json({ error: loadErr.message }, { status: 500 });
    if (!existing) return NextResponse.json({ error: 'Company not found' }, { status: 404 });

    const current = mergeSettings(existing);
    const incoming = pickSettings((body.settings || {}) as Partial<CompanySettings>);
    const fyIncoming = incoming.fiscalYearStartMonth;
    const fyChanged =
      fyIncoming !== undefined &&
      normalizeFyStartMonth(Number(fyIncoming)) !==
        normalizeFyStartMonth(current.fiscalYearStartMonth);
    if (fyChanged && !canSetFy) {
      return NextResponse.json(
        {
          error:
            'Only the owner or finance lead can change the financial year.',
        },
        { status: 403 }
      );
    }
    const incomingKeys = Object.keys(incoming);
    const onlyFy =
      incomingKeys.length === 1 &&
      incomingKeys[0] === 'fiscalYearStartMonth' &&
      (body.trading_name == null || body.trading_name === '');
    if (!settingsWrite.ok) {
      if (!(fyChanged && canSetFy && onlyFy)) {
        return NextResponse.json(
          { error: settingsWrite.error },
          { status: settingsWrite.status }
        );
      }
    }
    const next: CompanySettings = settingsWrite.ok
      ? {
          ...current,
          ...incoming,
          fiscalYearStartMonth: fyChanged
            ? normalizeFyStartMonth(Number(fyIncoming))
            : current.fiscalYearStartMonth,
        }
      : {
          ...current,
          fiscalYearStartMonth: normalizeFyStartMonth(Number(fyIncoming)),
        };

    // Keep top-level columns in sync for discover / money surfaces
    const updates: Record<string, unknown> = {
      settings: {
        ...((existing.settings && typeof existing.settings === 'object'
          ? existing.settings
          : {}) as object),
        timezone: next.timezone,
        primary_currency: next.primary_currency,
        emailNotifications: next.emailNotifications,
        projectUpdates: next.projectUpdates,
        teamInvites: next.teamInvites,
        marketingEmails: next.marketingEmails,
        poAlerts: next.poAlerts,
        riadAlerts: next.riadAlerts,
        weeklyDigest: next.weeklyDigest,
        open_to_trade: next.open_to_trade,
        autoEmailOnFromPo: next.autoEmailOnFromPo,
        defaultPaymentTerms: next.defaultPaymentTerms,
        fiscalYearStartMonth: next.fiscalYearStartMonth,
        preferred_srm_supplier_id: next.preferred_srm_supplier_id,
      },
      timezone: next.timezone,
      primary_currency: next.primary_currency,
      is_buyer: next.is_buyer,
      is_discoverable: next.is_discoverable,
      updated_at: new Date().toISOString(),
    };

    if (body.trading_name != null && String(body.trading_name).trim()) {
      updates.trading_name = String(body.trading_name).trim();
    }

    let { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', companyId)
      .select('id, trading_name, timezone, primary_currency, is_buyer, is_discoverable, settings')
      .single();

    if (error && /column|schema cache/i.test(error.message || '')) {
      const minimal = {
        trading_name: updates.trading_name ?? existing.trading_name,
        settings: updates.settings,
        updated_at: updates.updated_at,
      };
      const retry = await supabase
        .from('profiles')
        .update(minimal)
        .eq('id', companyId)
        .select('id, trading_name, settings')
        .single();
      data = retry.data as typeof data;
      error = retry.error;
    }

    if (error) {
      return NextResponse.json(
        { error: error.message, hint: 'Run 20260709_business_workspace.sql' },
        { status: 500 }
      );
    }

    if (fyChanged) {
      await applyCompanyFiscalYearToLedger(
        companyId,
        next.fiscalYearStartMonth
      );
    }

    await logActivity({
      profile_id: companyId,
      actor_user_id: membership.ok
        ? membership.userId
        : settingsWrite.ok
          ? settingsWrite.userId
          : String(body.privyUserId || ''),
      action: 'business.settings_updated',
      entity_type: 'profiles',
      entity_id: String(companyId),
      summary: 'Company settings updated',
    });

    return NextResponse.json({
      success: true,
      trading_name: data?.trading_name,
      settings: mergeSettings(data || existing),
    });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}

function mergeSettings(row: {
  timezone?: string | null;
  primary_currency?: string | null;
  is_buyer?: boolean | null;
  is_discoverable?: boolean | null;
  settings?: unknown;
}): CompanySettings {
  const s =
    row.settings && typeof row.settings === 'object' && !Array.isArray(row.settings)
      ? (row.settings as Record<string, unknown>)
      : {};
  return {
    timezone: String(s.timezone || row.timezone || DEFAULT_SETTINGS.timezone),
    primary_currency: String(
      s.primary_currency || row.primary_currency || DEFAULT_SETTINGS.primary_currency
    ),
    emailNotifications: bool(s.emailNotifications, DEFAULT_SETTINGS.emailNotifications),
    projectUpdates: bool(s.projectUpdates, DEFAULT_SETTINGS.projectUpdates),
    teamInvites: bool(s.teamInvites, DEFAULT_SETTINGS.teamInvites),
    marketingEmails: bool(s.marketingEmails, DEFAULT_SETTINGS.marketingEmails),
    poAlerts: bool(s.poAlerts, DEFAULT_SETTINGS.poAlerts),
    riadAlerts: bool(s.riadAlerts, DEFAULT_SETTINGS.riadAlerts),
    weeklyDigest: bool(s.weeklyDigest, DEFAULT_SETTINGS.weeklyDigest),
    is_discoverable:
      row.is_discoverable != null
        ? Boolean(row.is_discoverable)
        : bool(s.is_discoverable, DEFAULT_SETTINGS.is_discoverable),
    is_buyer:
      row.is_buyer != null ? Boolean(row.is_buyer) : bool(s.is_buyer, DEFAULT_SETTINGS.is_buyer),
    open_to_trade: bool(s.open_to_trade, DEFAULT_SETTINGS.open_to_trade),
    autoEmailOnFromPo: bool(s.autoEmailOnFromPo, DEFAULT_SETTINGS.autoEmailOnFromPo),
    defaultPaymentTerms: String(
      s.defaultPaymentTerms || DEFAULT_SETTINGS.defaultPaymentTerms
    ),
    paymentTermsOptions: Array.isArray(s.paymentTermsOptions)
      ? (s.paymentTermsOptions as unknown[])
          .map((x) => String(x).trim())
          .filter(Boolean)
      : [...DEFAULT_SETTINGS.paymentTermsOptions],
    fiscalYearStartMonth: Number(
      s.fiscalYearStartMonth ?? DEFAULT_SETTINGS.fiscalYearStartMonth
    ),
    preferred_srm_supplier_id: (() => {
      const n = Number(
        s.preferred_srm_supplier_id ?? s.defaultManufacturerSrmId
      );
      return Number.isFinite(n) && n > 0 ? n : null;
    })(),
  };
}

function pickSettings(incoming: Partial<CompanySettings>): Partial<CompanySettings> {
  const out: Partial<CompanySettings> = {};
  const keys: (keyof CompanySettings)[] = [
    'timezone',
    'primary_currency',
    'emailNotifications',
    'projectUpdates',
    'teamInvites',
    'marketingEmails',
    'poAlerts',
    'riadAlerts',
    'weeklyDigest',
    'is_discoverable',
    'is_buyer',
    'open_to_trade',
    'autoEmailOnFromPo',
    'defaultPaymentTerms',
    'fiscalYearStartMonth',
    'preferred_srm_supplier_id',
  ];
  for (const k of keys) {
    if (incoming[k] !== undefined) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (out as any)[k] = incoming[k];
    }
  }
  return out;
}

function bool(v: unknown, fallback: boolean) {
  if (v === undefined || v === null) return fallback;
  return Boolean(v);
}
