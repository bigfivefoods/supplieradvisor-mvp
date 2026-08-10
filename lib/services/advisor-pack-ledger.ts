/**
 * Session / care pack ledger for FitAdvisor + clinic Advisors.
 * Issue packs, consume on attendance, expiry warnings.
 *
 * Tracks entitlements only — does not process payment. Packs are sold and
 * paid for outside SupplierAdvisor; SA records remaining sessions.
 */

export type AdvisorPackLedgerEntry = {
  id: string;
  person_id: string;
  /** Optional: staff who delivers (PT coach / clinician) */
  provider_id?: string | null;
  label?: string;
  sessions_total: number;
  sessions_used: number;
  purchased_at: string;
  expires_at?: string | null;
  price_zar?: number | null;
  status?: 'active' | 'exhausted' | 'expired' | 'cancelled';
  notes?: string;
  /** Booking ids that consumed a session */
  consumption_log?: Array<{
    booking_id: string;
    at: string;
    sessions: number;
  }>;
  created_at: string;
};

export function packRemaining(p: AdvisorPackLedgerEntry): number {
  return Math.max(0, (p.sessions_total || 0) - (p.sessions_used || 0));
}

export function isPackUsable(
  p: AdvisorPackLedgerEntry,
  now = new Date()
): boolean {
  if (p.status === 'cancelled' || p.status === 'exhausted') return false;
  if (packRemaining(p) <= 0) return false;
  if (p.expires_at) {
    const exp = new Date(p.expires_at);
    if (!Number.isNaN(exp.getTime()) && exp.getTime() < now.getTime()) {
      return false;
    }
  }
  return p.status !== 'expired';
}

export function refreshPackStatus(
  p: AdvisorPackLedgerEntry,
  now = new Date()
): AdvisorPackLedgerEntry {
  if (p.status === 'cancelled') return p;
  if (p.expires_at) {
    const exp = new Date(p.expires_at);
    if (!Number.isNaN(exp.getTime()) && exp.getTime() < now.getTime()) {
      return { ...p, status: 'expired' };
    }
  }
  if (packRemaining(p) <= 0) return { ...p, status: 'exhausted' };
  return { ...p, status: 'active' };
}

/** Prefer earliest-expiring active pack for person */
export function pickPackToConsume(
  packs: AdvisorPackLedgerEntry[],
  personId: string,
  providerId?: string | null,
  now = new Date()
): AdvisorPackLedgerEntry | null {
  const candidates = packs
    .filter((p) => p.person_id === personId)
    .map((p) => refreshPackStatus(p, now))
    .filter((p) => isPackUsable(p, now));
  if (!candidates.length) return null;
  // Prefer matching provider when set (PT with assigned coach)
  const withProvider = providerId
    ? candidates.filter((p) => !p.provider_id || p.provider_id === providerId)
    : candidates;
  const pool = withProvider.length ? withProvider : candidates;
  pool.sort((a, b) => {
    const ae = a.expires_at || '9999';
    const be = b.expires_at || '9999';
    return ae.localeCompare(be);
  });
  return pool[0] || null;
}

export function consumePackSession(
  packs: AdvisorPackLedgerEntry[],
  opts: {
    personId: string;
    bookingId: string;
    providerId?: string | null;
    sessions?: number;
    now?: string;
  }
): {
  packs: AdvisorPackLedgerEntry[];
  consumed: AdvisorPackLedgerEntry | null;
  remaining: number;
} {
  const nowIso = opts.now || new Date().toISOString();
  const now = new Date(nowIso);
  const n = Math.max(1, Number(opts.sessions) || 1);
  // Idempotent: already logged this booking
  for (const p of packs) {
    if (
      p.consumption_log?.some((c) => c.booking_id === opts.bookingId)
    ) {
      return {
        packs,
        consumed: p,
        remaining: packRemaining(p),
      };
    }
  }
  const pick = pickPackToConsume(
    packs,
    opts.personId,
    opts.providerId,
    now
  );
  if (!pick) {
    return { packs, consumed: null, remaining: 0 };
  }
  const next = packs.map((p) => {
    if (p.id !== pick.id) return p;
    const used = (p.sessions_used || 0) + n;
    const updated: AdvisorPackLedgerEntry = refreshPackStatus(
      {
        ...p,
        sessions_used: used,
        consumption_log: [
          ...(p.consumption_log || []),
          { booking_id: opts.bookingId, at: nowIso, sessions: n },
        ],
      },
      now
    );
    return updated;
  });
  const consumed = next.find((p) => p.id === pick.id) || null;
  return {
    packs: next,
    consumed,
    remaining: consumed ? packRemaining(consumed) : 0,
  };
}

export function issuePack(opts: {
  id?: string;
  personId: string;
  providerId?: string | null;
  label?: string;
  sessionsTotal: number;
  priceZar?: number | null;
  expiresAt?: string | null;
  notes?: string;
  now?: string;
}): AdvisorPackLedgerEntry {
  const now = opts.now || new Date().toISOString();
  return {
    id:
      opts.id ||
      `pack_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    person_id: opts.personId,
    provider_id: opts.providerId ?? null,
    label: opts.label || 'Session pack',
    sessions_total: Math.max(1, Number(opts.sessionsTotal) || 1),
    sessions_used: 0,
    purchased_at: now,
    expires_at: opts.expiresAt ?? null,
    price_zar: opts.priceZar ?? null,
    status: 'active',
    notes: opts.notes,
    consumption_log: [],
    created_at: now,
  };
}

/** Packs expiring within N days with remaining sessions */
export function packExpiryWarnings(
  packs: AdvisorPackLedgerEntry[],
  withinDays = 14
): Array<AdvisorPackLedgerEntry & { days_left: number; remaining: number }> {
  const now = Date.now();
  const out: Array<
    AdvisorPackLedgerEntry & { days_left: number; remaining: number }
  > = [];
  for (const p of packs) {
    const rem = packRemaining(p);
    if (rem <= 0 || !p.expires_at || p.status === 'cancelled') continue;
    const exp = new Date(p.expires_at).getTime();
    if (Number.isNaN(exp)) continue;
    const days = Math.ceil((exp - now) / 86400000);
    if (days >= 0 && days <= withinDays) {
      out.push({ ...p, days_left: days, remaining: rem });
    }
  }
  return out.sort((a, b) => a.days_left - b.days_left);
}

/** Convert Fit PT pack shape ↔ ledger (in-place compatible fields) */
export function fitPtPackToLedger(p: {
  id: string;
  client_id: string;
  coach_id?: string | null;
  sessions_total: number;
  sessions_used: number;
  purchased_at: string;
  expires_at?: string | null;
  price_zar?: number | null;
  notes?: string;
  created_at: string;
  consumption_log?: AdvisorPackLedgerEntry['consumption_log'];
  status?: AdvisorPackLedgerEntry['status'];
  label?: string;
}): AdvisorPackLedgerEntry {
  return {
    id: p.id,
    person_id: p.client_id,
    provider_id: p.coach_id ?? null,
    label: p.label || 'PT pack',
    sessions_total: p.sessions_total,
    sessions_used: p.sessions_used,
    purchased_at: p.purchased_at,
    expires_at: p.expires_at,
    price_zar: p.price_zar,
    status: p.status || 'active',
    notes: p.notes,
    consumption_log: p.consumption_log || [],
    created_at: p.created_at,
  };
}

export function ledgerToFitPtPack(p: AdvisorPackLedgerEntry): {
  id: string;
  client_id: string;
  coach_id?: string | null;
  sessions_total: number;
  sessions_used: number;
  purchased_at: string;
  expires_at?: string | null;
  price_zar?: number | null;
  notes?: string;
  created_at: string;
  consumption_log?: AdvisorPackLedgerEntry['consumption_log'];
  status?: AdvisorPackLedgerEntry['status'];
  label?: string;
} {
  return {
    id: p.id,
    client_id: p.person_id,
    coach_id: p.provider_id,
    sessions_total: p.sessions_total,
    sessions_used: p.sessions_used,
    purchased_at: p.purchased_at,
    expires_at: p.expires_at,
    price_zar: p.price_zar,
    notes: p.notes,
    created_at: p.created_at,
    consumption_log: p.consumption_log,
    status: p.status,
    label: p.label,
  };
}
