/**
 * Substitution protocol — approved alternate products on stock-out.
 * Stored on school_profiles.metadata.substitutions and/or agency catalogue metadata.
 */

export type SubstitutionRule = {
  id: string;
  /** Primary product that is out */
  from_product_id: number;
  from_name?: string;
  /** Approved alternate */
  to_product_id: number;
  to_name?: string;
  to_brand?: string | null;
  /** Same category range required */
  category?: string | null;
  reason?: string | null;
  active: boolean;
  created_at?: string;
};

export function listSubstitutions(
  meta: Record<string, unknown> | null | undefined
): SubstitutionRule[] {
  if (!meta || typeof meta !== 'object') return [];
  const raw = meta.substitutions;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((r) => {
      if (!r || typeof r !== 'object') return null;
      const o = r as Record<string, unknown>;
      const from = Number(o.from_product_id);
      const to = Number(o.to_product_id);
      if (!Number.isFinite(from) || !Number.isFinite(to)) return null;
      return {
        id: String(o.id || `${from}-${to}`),
        from_product_id: from,
        from_name: o.from_name != null ? String(o.from_name) : undefined,
        to_product_id: to,
        to_name: o.to_name != null ? String(o.to_name) : undefined,
        to_brand: o.to_brand != null ? String(o.to_brand) : null,
        category: o.category != null ? String(o.category) : null,
        reason: o.reason != null ? String(o.reason) : null,
        active: o.active !== false,
        created_at: o.created_at != null ? String(o.created_at) : undefined,
      } as SubstitutionRule;
    })
    .filter(Boolean) as SubstitutionRule[];
}

export function upsertSubstitution(
  meta: Record<string, unknown>,
  rule: Omit<SubstitutionRule, 'id' | 'created_at'> & { id?: string }
): Record<string, unknown> {
  const list = listSubstitutions(meta);
  const id =
    rule.id ||
    `sub-${rule.from_product_id}-${rule.to_product_id}-${Date.now().toString(36)}`;
  const next: SubstitutionRule = {
    id,
    from_product_id: rule.from_product_id,
    from_name: rule.from_name,
    to_product_id: rule.to_product_id,
    to_name: rule.to_name,
    to_brand: rule.to_brand ?? null,
    category: rule.category ?? null,
    reason: rule.reason ?? null,
    active: rule.active !== false,
    created_at: new Date().toISOString(),
  };
  const filtered = list.filter(
    (r) =>
      !(
        r.from_product_id === next.from_product_id &&
        r.to_product_id === next.to_product_id
      )
  );
  filtered.push(next);
  return { ...meta, substitutions: filtered };
}

export function removeSubstitution(
  meta: Record<string, unknown>,
  id: string
): Record<string, unknown> {
  const list = listSubstitutions(meta).filter((r) => r.id !== id);
  return { ...meta, substitutions: list };
}

/** Resolve effective product if primary is stocked out and a sub exists */
export function resolveSubstitution(
  primaryProductId: number,
  stockQty: number,
  rules: SubstitutionRule[]
): { product_id: number; substituted: boolean; rule?: SubstitutionRule } {
  if (stockQty > 0) {
    return { product_id: primaryProductId, substituted: false };
  }
  const rule = rules.find(
    (r) => r.active && r.from_product_id === primaryProductId
  );
  if (rule) {
    return {
      product_id: rule.to_product_id,
      substituted: true,
      rule,
    };
  }
  return { product_id: primaryProductId, substituted: false };
}
