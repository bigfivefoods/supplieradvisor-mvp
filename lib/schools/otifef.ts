/**
 * NSNP SP OTIFEF (On-Time · In-Full · Error-Free) from deliveries + POs + GRNs.
 */

export type OtifefSlice = {
  on_time_pct: number | null;
  in_full_pct: number | null;
  error_free_pct: number | null;
  /** Composite OTIFEF 0–100 */
  otifef_pct: number | null;
  deliveries: number;
  on_time_ok: number;
  on_time_known: number;
  in_full_ok: number;
  in_full_known: number;
  error_free_ok: number;
  error_free_known: number;
};

export type DeliveryLike = {
  otif?: boolean | null;
  expected_date?: string | null;
  delivered_at?: string | null;
  received_at?: string | null;
  status?: string | null;
  compliance_ok?: boolean | null;
  has_pod?: boolean | null;
  pod_photo_url?: string | null;
  lines?: unknown;
  ordered_qty?: number | null;
  delivered_qty?: number | null;
};

/**
 * On-time: otif flag, or delivered/received date ≤ expected_date.
 * In-full: delivered_qty ≥ ordered_qty when both known, else assume full if received.
 * Error-free: compliance_ok !== false (on-catalogue / no quality reject).
 */
export function computeOtifefFromDeliveries(
  deliveries: DeliveryLike[]
): OtifefSlice {
  let on_time_ok = 0;
  let on_time_known = 0;
  let in_full_ok = 0;
  let in_full_known = 0;
  let error_free_ok = 0;
  let error_free_known = 0;

  for (const d of deliveries) {
    // On-time
    if (d.otif === true || d.otif === false) {
      on_time_known += 1;
      if (d.otif) on_time_ok += 1;
    } else if (d.expected_date) {
      const exp = String(d.expected_date).slice(0, 10);
      const day = String(d.delivered_at || d.received_at || '')
        .slice(0, 10);
      if (day && exp) {
        on_time_known += 1;
        if (day <= exp) on_time_ok += 1;
      }
    }

    // In-full
    const oq = d.ordered_qty != null ? Number(d.ordered_qty) : null;
    const dq = d.delivered_qty != null ? Number(d.delivered_qty) : null;
    if (oq != null && dq != null && oq > 0) {
      in_full_known += 1;
      if (dq + 1e-6 >= oq * 0.98) in_full_ok += 1;
    } else if (
      ['received', 'delivered', 'closed', 'complete'].includes(
        String(d.status || '').toLowerCase()
      )
    ) {
      in_full_known += 1;
      in_full_ok += 1;
    }

    // Error-free (catalogue / no reject)
    if (d.compliance_ok === true || d.compliance_ok === false) {
      error_free_known += 1;
      if (d.compliance_ok) error_free_ok += 1;
    } else {
      // Default treat unknown received as error-free unless flagged
      error_free_known += 1;
      error_free_ok += 1;
    }
  }

  const pct = (ok: number, known: number) =>
    known > 0 ? Math.round((ok / known) * 1000) / 10 : null;

  const on_time_pct = pct(on_time_ok, on_time_known);
  const in_full_pct = pct(in_full_ok, in_full_known);
  const error_free_pct = pct(error_free_ok, error_free_known);

  const parts = [on_time_pct, in_full_pct, error_free_pct].filter(
    (x): x is number => x != null
  );
  const otifef_pct =
    parts.length > 0
      ? Math.round((parts.reduce((a, b) => a + b, 0) / parts.length) * 10) / 10
      : null;

  return {
    on_time_pct,
    in_full_pct,
    error_free_pct,
    otifef_pct,
    deliveries: deliveries.length,
    on_time_ok,
    on_time_known,
    in_full_ok,
    in_full_known,
    error_free_ok,
    error_free_known,
  };
}

export function otifefLabel(pct: number | null): string {
  if (pct == null) return 'No data';
  if (pct >= 95) return 'Excellent';
  if (pct >= 85) return 'Good';
  if (pct >= 70) return 'Fair';
  return 'Needs improvement';
}
