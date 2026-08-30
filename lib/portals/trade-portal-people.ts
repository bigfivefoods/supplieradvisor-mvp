/**
 * People on a guest customer/supplier portal.
 * Desk and the guest themselves can add named people on the same CRM account.
 */
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { isSafeFilterEmail } from '@/lib/security/email-filter';
import { isMissingRelation } from '@/lib/business/company-data';
import { sendTradePortalAccessEmail } from '@/lib/portals/trade-portal-email';
import { hostDisplayName } from '@/lib/portals/portal-actor';
import {
  ensureTradePortal,
  mapViewer,
  migrationHint,
  newPortalToken,
  portalPublicUrl,
  type PortalPersonPublic,
  type TradePortalKind,
  type TradePortalViewer,
} from '@/lib/portals/trade-portal';

export const MAX_PORTAL_PEOPLE = 25;

function asObject(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  return {};
}

export function publicPeopleView(
  people: TradePortalViewer[],
  youId: number
): PortalPersonPublic[] {
  return people
    .filter((p) => p.status === 'active')
    .map((p) => ({
      id: p.id,
      name: p.name,
      email: p.email,
      job_title: p.job_title,
      last_seen_at: p.last_seen_at,
      you: p.id === youId,
      side: 'guest' as const,
    }));
}

export function portalPersonKey(p: {
  side?: 'host' | 'guest';
  id: number;
}): string {
  return `${p.side === 'host' ? 'host' : 'guest'}:${p.id}`;
}

export function parsePortalPersonKey(
  raw: unknown
): { side: 'host' | 'guest'; id: number } | null {
  const m = /^(host|guest):(\d+)$/.exec(String(raw || '').trim());
  if (!m) return null;
  const id = Number(m[2]);
  if (!Number.isFinite(id) || id <= 0) return null;
  return { side: m[1] as 'host' | 'guest', id };
}

export function mergePortalPeople(
  host: PortalPersonPublic[],
  guests: PortalPersonPublic[]
): PortalPersonPublic[] {
  const hostEmails = new Set(
    host
      .map((p) => String(p.email || '').toLowerCase())
      .filter((e) => e.includes('@'))
  );
  const guestsOut = guests.filter((g) => {
    const e = String(g.email || '').toLowerCase();
    return !e.includes('@') || !hostEmails.has(e);
  });
  return [...host, ...guestsOut];
}

function roleLabel(role: unknown): string | null {
  const r = String(role || '').trim().replace(/[_-]+/g, ' ');
  if (!r) return null;
  return r.replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Active host-company team (Craig / Big Five Foods), for assign + RIAD. */
export async function listHostTeam(
  companyId: number
): Promise<PortalPersonPublic[]> {
  if (!Number.isFinite(companyId) || companyId <= 0) return [];
  const supabase = getSupabaseServer();
  let rows: Array<Record<string, unknown>> = [];
  const full = await supabase
    .from('business_users')
    .select('id, name, email, role, status')
    .eq('profile_id', companyId)
    .eq('status', 'active')
    .limit(40);
  if (full.error) {
    const soft = await supabase
      .from('business_users')
      .select('id, email, role, status')
      .eq('profile_id', companyId)
      .eq('status', 'active')
      .limit(40);
    if (soft.error) return [];
    rows = (soft.data || []) as Array<Record<string, unknown>>;
  } else {
    rows = (full.data || []) as Array<Record<string, unknown>>;
  }
  if (!rows.length) return [];

  let contactName: string | null = null;
  let companyName: string | null = null;
  const { data: prof } = await supabase
    .from('profiles')
    .select('trading_name, legal_name, contact_name')
    .eq('id', companyId)
    .maybeSingle();
  if (prof) {
    contactName = prof.contact_name != null ? String(prof.contact_name) : null;
    companyName =
      String(prof.trading_name || prof.legal_name || '').trim() || null;
  }

  const out: PortalPersonPublic[] = [];
  for (const row of rows) {
    const id = Number(row.id);
    if (!Number.isFinite(id) || id <= 0) continue;
    const role = String(row.role || '').toLowerCase();
    const email = String(row.email || '').trim() || null;
    const name = hostDisplayName({
      memberName: row.name != null ? String(row.name) : null,
      memberEmail: email,
      contactName: role === 'owner' || role === 'admin' ? contactName : null,
      companyName,
    });
    out.push({
      id,
      name,
      email: email && email.includes('@') ? email : null,
      job_title: roleLabel(row.role),
      last_seen_at: null,
      you: false,
      side: 'host',
    });
  }
  out.sort((a, b) => a.name.localeCompare(b.name));
  return out;
}

export async function listAccountPeople(opts: {
  companyId: number;
  portalId: number;
  customerId?: number | null;
  supplierId?: number | null;
}): Promise<
  | { ok: true; people: TradePortalViewer[] }
  | { ok: false; error: string; missingTable?: boolean }
> {
  const supabase = getSupabaseServer();
  let q = supabase
    .from('trade_portal_viewers')
    .select('*')
    .eq('profile_id', opts.companyId)
    .eq('portal_id', opts.portalId)
    .order('created_at', { ascending: true })
    .limit(80);
  if (opts.customerId && opts.customerId > 0) {
    q = q.eq('customer_id', opts.customerId);
  } else if (opts.supplierId && opts.supplierId > 0) {
    q = q.eq('supplier_id', opts.supplierId);
  } else {
    return { ok: true, people: [] };
  }
  const { data, error } = await q;
  if (error) {
    return {
      ok: false,
      error: isMissingRelation(error) ? migrationHint() : error.message,
      missingTable: isMissingRelation(error),
    };
  }
  return { ok: true, people: (data || []).map((r) => mapViewer(asObject(r))) };
}

export async function inviteTradePortalPerson(opts: {
  companyId: number;
  kind: TradePortalKind;
  name: string;
  email?: string | null;
  phone?: string | null;
  job_title?: string | null;
  customerId?: number | null;
  supplierId?: number | null;
  sendEmail?: boolean;
}): Promise<
  | {
      ok: true;
      viewer: TradePortalViewer;
      url: string;
      emailSent: boolean;
      warning?: string;
      existing?: boolean;
    }
  | { ok: false; error: string; status: number }
> {
  const name = String(opts.name || '').trim().slice(0, 120);
  if (!name) {
    return { ok: false, error: 'Name is required', status: 400 };
  }
  const customerId =
    opts.kind === 'customer' && Number(opts.customerId) > 0
      ? Number(opts.customerId)
      : null;
  const supplierId =
    opts.kind === 'supplier' && Number(opts.supplierId) > 0
      ? Number(opts.supplierId)
      : null;
  if (opts.kind === 'customer' && !customerId) {
    return { ok: false, error: 'Pick a customer on your books', status: 400 };
  }
  if (opts.kind === 'supplier' && !supplierId) {
    return { ok: false, error: 'Pick a supplier on your books', status: 400 };
  }
  if (opts.kind === 'supplier' && supplierId) {
    const { assertSupplierPortalParty } = await import(
      '@/lib/portals/assert-supplier-portal-party'
    );
    const gate = await assertSupplierPortalParty(opts.companyId, supplierId);
    if (!gate.ok) {
      return { ok: false, error: gate.error, status: gate.status };
    }
  }
  if (opts.kind === 'customer' && customerId) {
    const { assertCustomerPortalParty } = await import(
      '@/lib/portals/assert-supplier-portal-party'
    );
    const gate = await assertCustomerPortalParty(opts.companyId, customerId);
    if (!gate.ok) {
      return { ok: false, error: gate.error, status: gate.status };
    }
  }

  const rawEmail = String(opts.email || '').trim().toLowerCase();
  const email = rawEmail.includes('@') ? rawEmail : '';
  if (email && !isSafeFilterEmail(email)) {
    return { ok: false, error: 'That email is not valid', status: 400 };
  }

  const ensured = await ensureTradePortal({
    companyId: opts.companyId,
    kind: opts.kind,
  });
  if (!ensured.ok) {
    return {
      ok: false,
      error: ensured.error,
      status: ensured.missingTable ? 503 : 500,
    };
  }

  const listed = await listAccountPeople({
    companyId: opts.companyId,
    portalId: ensured.portal.id,
    customerId,
    supplierId,
  });
  if (!listed.ok) {
    return {
      ok: false,
      error: listed.error,
      status: listed.missingTable ? 503 : 500,
    };
  }
  const active = listed.people.filter((p) => p.status === 'active');
  if (email) {
    const same = active.find(
      (p) => String(p.email || '').toLowerCase() === email
    );
    if (same) {
      return {
        ok: true,
        viewer: same,
        url: portalPublicUrl(same.token),
        emailSent: false,
        existing: true,
        warning: 'This person already has access',
      };
    }
  }
  if (active.length >= MAX_PORTAL_PEOPLE) {
    return {
      ok: false,
      error: `This account already has ${MAX_PORTAL_PEOPLE} people on the portal`,
      status: 400,
    };
  }

  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from('trade_portal_viewers')
    .insert({
      portal_id: ensured.portal.id,
      profile_id: opts.companyId,
      name,
      email: email || null,
      phone: String(opts.phone || '').trim().slice(0, 40) || null,
      job_title: String(opts.job_title || '').trim().slice(0, 80) || null,
      token: newPortalToken('viewer'),
      customer_id: customerId,
      supplier_id: supplierId,
      status: 'active',
    })
    .select('*')
    .single();
  if (error) {
    return { ok: false, error: error.message, status: 500 };
  }
  const viewer = mapViewer(asObject(data));
  const url = portalPublicUrl(viewer.token);
  let emailSent = false;
  let warning: string | undefined;
  if (email && opts.sendEmail !== false) {
    const { data: host } = await supabase
      .from('profiles')
      .select('trading_name, legal_name, logo_url')
      .eq('id', opts.companyId)
      .maybeSingle();
    const mailed = await sendTradePortalAccessEmail({
      to: email,
      guestName: name,
      hostName:
        String(host?.trading_name || host?.legal_name || '').trim() ||
        'SupplierAdvisor company',
      kind: opts.kind,
      portalUrl: url,
      logoUrl: host?.logo_url ? String(host.logo_url) : null,
    });
    emailSent = mailed.sent;
    warning = mailed.warning;
  }
  return { ok: true, viewer, url, emailSent, warning };
}

export async function issueAccountPortal(opts: {
  companyId: number;
  kind: TradePortalKind;
  customerId?: number | null;
  supplierId?: number | null;
}): Promise<
  | {
      ok: true;
      viewer: TradePortalViewer;
      url: string;
      emailSent: boolean;
      warning?: string;
      existing?: boolean;
    }
  | { ok: false; error: string; status: number }
> {
  const supabase = getSupabaseServer();
  let name = '';
  let email: string | null = null;
  let phone: string | null = null;
  let job: string | null = null;
  if (opts.kind === 'customer') {
    const id = Number(opts.customerId);
    if (!(id > 0)) {
      return { ok: false, error: 'Pick a customer on your books', status: 400 };
    }
    const { assertCustomerPortalParty } = await import(
      '@/lib/portals/assert-supplier-portal-party'
    );
    const gate = await assertCustomerPortalParty(opts.companyId, id);
    if (!gate.ok) {
      return { ok: false, error: gate.error, status: gate.status };
    }
    const { data, error } = await supabase
      .from('customers')
      .select('id, trading_name, contact_name, email, phone, job_title')
      .eq('id', id)
      .eq('profile_id', opts.companyId)
      .maybeSingle();
    if (error || !data) {
      return {
        ok: false,
        error: error?.message || 'Customer not found',
        status: 404,
      };
    }
    name = String(data.contact_name || data.trading_name || 'Customer').trim();
    email = data.email ? String(data.email) : null;
    phone = data.phone ? String(data.phone) : null;
    job = data.job_title ? String(data.job_title) : null;
  } else {
    const id = Number(opts.supplierId);
    if (!(id > 0)) {
      return { ok: false, error: 'Pick a supplier on your books', status: 400 };
    }
    const { assertSupplierPortalParty } = await import(
      '@/lib/portals/assert-supplier-portal-party'
    );
    const gate = await assertSupplierPortalParty(opts.companyId, id);
    if (!gate.ok) {
      return { ok: false, error: gate.error, status: gate.status };
    }
    const { data, error } = await supabase
      .from('srm_suppliers')
      .select('id, trading_name, contact_name, email, phone')
      .eq('id', id)
      .eq('profile_id', opts.companyId)
      .maybeSingle();
    if (error || !data) {
      return {
        ok: false,
        error: error?.message || 'Supplier not found',
        status: 404,
      };
    }
    name = String(data.contact_name || data.trading_name || 'Supplier').trim();
    email = data.email ? String(data.email) : null;
    phone = data.phone ? String(data.phone) : null;
  }

  const ensured = await ensureTradePortal({
    companyId: opts.companyId,
    kind: opts.kind,
  });
  if (!ensured.ok) {
    return {
      ok: false,
      error: ensured.error,
      status: ensured.missingTable ? 503 : 500,
    };
  }
  const listed = await listAccountPeople({
    companyId: opts.companyId,
    portalId: ensured.portal.id,
    customerId: opts.kind === 'customer' ? Number(opts.customerId) : null,
    supplierId: opts.kind === 'supplier' ? Number(opts.supplierId) : null,
  });
  if (listed.ok) {
    const existing = listed.people.find((p) => p.status === 'active');
    if (existing) {
      return {
        ok: true,
        viewer: existing,
        url: portalPublicUrl(existing.token),
        emailSent: false,
        existing: true,
      };
    }
  }

  return inviteTradePortalPerson({
    companyId: opts.companyId,
    kind: opts.kind,
    name,
    email,
    phone,
    job_title: job,
    customerId: opts.customerId,
    supplierId: opts.supplierId,
    sendEmail: Boolean(email),
  });
}
