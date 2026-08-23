/**
 * Resolve a preferred manufacturer (supplier) for raise-linked-PO.
 * Priority:
 * 1. Explicit body args (handled by caller)
 * 2. sales_orders.metadata.preferred_supplier_*
 * 3. profiles.settings.defaultManufacturer / preferred_srm_supplier_id
 * 4. First active SRM supplier whose trading_name matches a keyword (optional)
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export type PreferredSupplier = {
  supplierProfileId: number | null;
  srmSupplierId: number | null;
  tradingName: string | null;
  source: 'so_metadata' | 'company_settings' | 'srm_first' | 'none';
};

export async function resolvePreferredSupplier(
  supabase: SupabaseClient,
  companyId: number,
  salesOrder?: Record<string, unknown> | null
): Promise<PreferredSupplier> {
  const empty: PreferredSupplier = {
    supplierProfileId: null,
    srmSupplierId: null,
    tradingName: null,
    source: 'none',
  };

  // 1. SO metadata
  const meta =
    salesOrder?.metadata &&
    typeof salesOrder.metadata === 'object' &&
    !Array.isArray(salesOrder.metadata)
      ? (salesOrder.metadata as Record<string, unknown>)
      : null;

  if (meta) {
    const srmId = Number(meta.preferred_srm_supplier_id || meta.srm_supplier_id);
    const profileId = Number(
      meta.preferred_supplier_profile_id || meta.supplier_profile_id
    );
    if (Number.isFinite(srmId) && srmId > 0) {
      const { data: srm } = await supabase
        .from('srm_suppliers')
        .select('id, linked_profile_id, trading_name, status')
        .eq('id', srmId)
        .eq('profile_id', companyId)
        .maybeSingle();
      if (srm && srm.status !== 'blocked') {
        return {
          supplierProfileId: srm.linked_profile_id
            ? Number(srm.linked_profile_id)
            : Number.isFinite(profileId) && profileId > 0
              ? profileId
              : null,
          srmSupplierId: Number(srm.id),
          tradingName: srm.trading_name || null,
          source: 'so_metadata',
        };
      }
    }
    if (Number.isFinite(profileId) && profileId > 0) {
      return {
        supplierProfileId: profileId,
        srmSupplierId: null,
        tradingName: meta.preferred_supplier_name
          ? String(meta.preferred_supplier_name)
          : null,
        source: 'so_metadata',
      };
    }
  }

  // 2. Company settings
  try {
    const { data: prof } = await supabase
      .from('profiles')
      .select('settings')
      .eq('id', companyId)
      .maybeSingle();
    const settings =
      prof?.settings && typeof prof.settings === 'object'
        ? (prof.settings as Record<string, unknown>)
        : {};
    const srmId = Number(
      settings.preferred_srm_supplier_id || settings.defaultManufacturerSrmId
    );
    const profileId = Number(
      settings.preferred_supplier_profile_id ||
        settings.defaultManufacturerProfileId
    );
    if (Number.isFinite(srmId) && srmId > 0) {
      const { data: srm } = await supabase
        .from('srm_suppliers')
        .select('id, linked_profile_id, trading_name, status')
        .eq('id', srmId)
        .eq('profile_id', companyId)
        .maybeSingle();
      if (srm && srm.status !== 'blocked') {
        return {
          supplierProfileId: srm.linked_profile_id
            ? Number(srm.linked_profile_id)
            : null,
          srmSupplierId: Number(srm.id),
          tradingName: srm.trading_name || null,
          source: 'company_settings',
        };
      }
    }
    if (Number.isFinite(profileId) && profileId > 0) {
      return {
        supplierProfileId: profileId,
        srmSupplierId: null,
        tradingName: null,
        source: 'company_settings',
      };
    }
  } catch {
    /* soft */
  }

  // 3. Soft: first active non-blocked SRM supplier (only if single active)
  try {
    const { data: book } = await supabase
      .from('srm_suppliers')
      .select('id, linked_profile_id, trading_name, status')
      .eq('profile_id', companyId)
      .neq('status', 'blocked')
      .order('trading_name', { ascending: true })
      .limit(5);
    const active = (book || []).filter(
      (s) => String(s.status || '').toLowerCase() !== 'blocked'
    );
    if (active.length === 1) {
      const s = active[0];
      return {
        supplierProfileId: s.linked_profile_id
          ? Number(s.linked_profile_id)
          : null,
        srmSupplierId: Number(s.id),
        tradingName: s.trading_name || null,
        source: 'srm_first',
      };
    }
  } catch {
    /* soft */
  }

  return empty;
}
