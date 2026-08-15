import {
  TILL_META_KEY,
  TILL_SESSION_CAP,
  TILL_TTL_MS,
  type TillLine,
  type TillModule,
  type TillSession,
  type TillSessionKind,
} from '@/lib/till/types';

export function mintTillToken(companyId: number): string {
  const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  return `t_${companyId}_${id}`;
}

export function parseTillToken(
  token: string
): { companyId: number; rest: string } | null {
  const m = /^t_(\d+)_(.+)$/.exec(String(token || '').trim());
  if (!m) return null;
  const companyId = Number(m[1]);
  if (!Number.isFinite(companyId) || companyId <= 0) return null;
  return { companyId, rest: m[2] };
}

export function tillPayPath(token: string): string {
  return `/pay/${encodeURIComponent(token)}`;
}

export function readTillSessions(
  meta: Record<string, unknown> | null | undefined
): TillSession[] {
  const raw = meta?.[TILL_META_KEY];
  if (!Array.isArray(raw)) return [];
  return raw.filter(isSession);
}

export function writeTillSessions(
  meta: Record<string, unknown>,
  sessions: TillSession[]
): Record<string, unknown> {
  const next = [...sessions]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, TILL_SESSION_CAP);
  return { ...meta, [TILL_META_KEY]: next };
}

export function expireSession(s: TillSession, now = Date.now()): TillSession {
  if (s.status === 'open' || s.status === 'pending') {
    if (new Date(s.expires_at).getTime() <= now) {
      return { ...s, status: 'expired' };
    }
  }
  return s;
}

export function findSession(
  sessions: TillSession[],
  token: string
): TillSession | null {
  const now = Date.now();
  const hit = sessions.find((s) => s.token === token);
  return hit ? expireSession(hit, now) : null;
}

export function upsertSession(
  sessions: TillSession[],
  next: TillSession
): TillSession[] {
  const rest = sessions.filter((s) => s.token !== next.token);
  return [next, ...rest];
}

export function createTillSession(opts: {
  companyId: number;
  module: TillModule;
  kind: TillSessionKind;
  amountZar: number;
  label: string;
  brand?: string | null;
  lines?: TillLine[];
  chargeIds?: string[];
}): TillSession {
  const now = Date.now();
  const amount = Math.max(0, Math.round(Number(opts.amountZar) * 100) / 100);
  return {
    token: mintTillToken(opts.companyId),
    company_id: opts.companyId,
    module: opts.module,
    kind: opts.kind,
    status: 'open',
    amount_zar: amount,
    currency: 'ZAR',
    label: opts.label || (opts.kind === 'wallet' ? 'Pay SA Member bills' : 'Till payment'),
    brand: opts.brand || null,
    lines: opts.lines,
    charge_ids: opts.chargeIds,
    created_at: new Date(now).toISOString(),
    expires_at: new Date(now + TILL_TTL_MS).toISOString(),
    paid_at: null,
    paid_via: null,
    paystack_ref: null,
    paid_by_user_id: null,
  };
}

function isSession(v: unknown): v is TillSession {
  if (!v || typeof v !== 'object') return false;
  const s = v as TillSession;
  return Boolean(s.token && s.company_id && s.status);
}
