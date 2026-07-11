/**
 * QA hold helpers — block ship / warn receive when lots have open|failed inspections.
 */
import { getSupabaseServer } from '@/lib/supabase/server-client';

export type LotHold = {
  lot_number: string;
  inspection_id: number;
  status: string;
  inspection_type?: string | null;
};

/**
 * Return open/failed inspections for the given lot numbers (company-scoped).
 * Empty if quality_inspections table missing.
 */
export async function findLotHolds(
  companyId: number,
  lotNumbers: (string | null | undefined)[]
): Promise<LotHold[]> {
  const lots = [
    ...new Set(
      lotNumbers
        .map((l) => (l != null ? String(l).trim() : ''))
        .filter((l) => l.length > 0)
    ),
  ];
  if (!lots.length || !Number.isFinite(companyId)) return [];

  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from('quality_inspections')
    .select('id, lot_number, status, inspection_type')
    .eq('profile_id', companyId)
    .in('status', ['open', 'failed'])
    .in('lot_number', lots)
    .limit(100);

  if (error) {
    // Table missing or RLS — fail open for ops continuity, log-ish
    if (/does not exist|schema cache/i.test(error.message)) return [];
    console.warn('findLotHolds:', error.message);
    return [];
  }

  return (data || [])
    .filter((r) => r.lot_number)
    .map((r) => ({
      lot_number: String(r.lot_number),
      inspection_id: Number(r.id),
      status: String(r.status),
      inspection_type: r.inspection_type,
    }));
}

/** True if any of the lots are on QA hold */
export async function hasQaHold(
  companyId: number,
  lotNumbers: (string | null | undefined)[]
): Promise<{ blocked: boolean; holds: LotHold[] }> {
  const holds = await findLotHolds(companyId, lotNumbers);
  return { blocked: holds.length > 0, holds };
}

export function qaHoldErrorPayload(holds: LotHold[]) {
  const lots = [...new Set(holds.map((h) => h.lot_number))];
  return {
    error: `QA hold: lot(s) ${lots.join(', ')} have open or failed inspections. Clear Quality → Inspections before shipping.`,
    code: 'QA_HOLD',
    holds,
    lots,
    resolve_href: '/dashboard/quality/inspections',
  };
}
