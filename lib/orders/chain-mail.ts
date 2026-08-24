/**
 * Order-chain mail: the hub (e.g. Big Five Foods) is the only voice
 * the customer and the manufacturer hear. Never name the other party.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { portalPublicUrl } from '@/lib/portals/trade-portal';
import { safeFilterEmails } from '@/lib/security/email-filter';
import { resolveCompanyEmails } from '@/lib/billing/company-emails';

export type ChainHubBrand = {
  name: string;
  logoUrl: string | null;
};

export type ChainPartyMail = {
  emails: string[];
  portalUrl: string | null;
};

export {
  chainPoSubject,
  chainProductionSubject,
} from './chain-mail-copy';

export async function loadChainHubBrand(
  supabase: SupabaseClient,
  companyId: number
): Promise<ChainHubBrand> {
  const { data } = await supabase
    .from('profiles')
    .select('trading_name, legal_name, logo_url')
    .eq('id', companyId)
    .maybeSingle();
  const name = String(
    data?.trading_name || data?.legal_name || 'Your trading partner'
  ).trim();
  const logo = data?.logo_url != null ? String(data.logo_url).trim() : '';
  return { name: name || 'Your trading partner', logoUrl: logo || null };
}

export async function loadSupplierChainMail(
  supabase: SupabaseClient,
  opts: {
    hubCompanyId: number;
    srmSupplierId?: number | null;
    supplierProfileId?: number | null;
  }
): Promise<ChainPartyMail> {
  const emails: Array<string | null | undefined> = [];
  let portalUrl: string | null = null;
  const srmId = Number(opts.srmSupplierId);
  if (Number.isFinite(srmId) && srmId > 0) {
    let srmHit = await supabase
      .from('srm_suppliers')
      .select('email, invited_email, linked_profile_id')
      .eq('id', srmId)
      .eq('profile_id', opts.hubCompanyId)
      .maybeSingle();
    if (srmHit.error) {
      srmHit = await supabase
        .from('srm_suppliers')
        .select('email, linked_profile_id')
        .eq('id', srmId)
        .eq('profile_id', opts.hubCompanyId)
        .maybeSingle();
    }
    const srm = srmHit.data;
    emails.push(srm?.email, (srm as { invited_email?: string | null } | null)?.invited_email);
    const viewers = await loadPortalViewers(supabase, {
      hubCompanyId: opts.hubCompanyId,
      supplierId: srmId,
    });
    emails.push(...viewers.emails);
    portalUrl = viewers.portalUrl;
  }
  const linked = Number(opts.supplierProfileId);
  if (Number.isFinite(linked) && linked > 0) {
    const company = await resolveCompanyEmails(linked, {
      roleAllowlist: ['owner', 'admin', 'ops', 'operations', 'sales'],
      limit: 8,
    });
    emails.push(...company.emails);
  }
  return { emails: safeFilterEmails(emails), portalUrl };
}

export async function loadCustomerChainMail(
  supabase: SupabaseClient,
  opts: {
    hubCompanyId: number;
    customerId: number;
  }
): Promise<ChainPartyMail> {
  const emails: Array<string | null | undefined> = [];
  const customerId = Number(opts.customerId);
  if (!Number.isFinite(customerId) || customerId <= 0) {
    return { emails: [], portalUrl: null };
  }
  let custHit = await supabase
    .from('customers')
    .select('email, invited_email, linked_profile_id')
    .eq('id', customerId)
    .eq('profile_id', opts.hubCompanyId)
    .maybeSingle();
  if (custHit.error) {
    custHit = await supabase
      .from('customers')
      .select('email, linked_profile_id')
      .eq('id', customerId)
      .eq('profile_id', opts.hubCompanyId)
      .maybeSingle();
  }
  const cust = custHit.data;
  emails.push(
    cust?.email,
    (cust as { invited_email?: string | null } | null)?.invited_email
  );
  const viewers = await loadPortalViewers(supabase, {
    hubCompanyId: opts.hubCompanyId,
    customerId,
  });
  emails.push(...viewers.emails);
  const linked = Number(cust?.linked_profile_id);
  if (Number.isFinite(linked) && linked > 0) {
    const company = await resolveCompanyEmails(linked, {
      roleAllowlist: ['owner', 'admin', 'ops', 'operations', 'sales', 'finance'],
      limit: 8,
    });
    emails.push(...company.emails);
  }
  return { emails: safeFilterEmails(emails), portalUrl: viewers.portalUrl };
}

async function loadPortalViewers(
  supabase: SupabaseClient,
  opts: {
    hubCompanyId: number;
    customerId?: number;
    supplierId?: number;
  }
): Promise<ChainPartyMail> {
  let q = supabase
    .from('trade_portal_viewers')
    .select('email, token')
    .eq('profile_id', opts.hubCompanyId)
    .eq('status', 'active')
    .limit(20);
  if (opts.customerId != null) q = q.eq('customer_id', opts.customerId);
  if (opts.supplierId != null) q = q.eq('supplier_id', opts.supplierId);
  const { data } = await q;
  const emails = (data || []).map((v) =>
    v.email != null ? String(v.email) : null
  );
  const token = (data || []).find((v) => String(v.token || '').length >= 12);
  return {
    emails: safeFilterEmails(emails),
    portalUrl: token?.token ? portalPublicUrl(String(token.token)) : null,
  };
}
