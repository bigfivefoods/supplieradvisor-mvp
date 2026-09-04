/**
 * Gym diary paint: assigned coach calendar colour fills the class block.
 */
import { normalizeEventHex } from '@/lib/schedule/event-color';
import type { FitgraphStore, FitSession } from '@/lib/fitness/fitgraph';
import {
  sessionKindFromRecord,
  sessionKindTone,
} from '@/lib/fitness/session-times';

export { CALENDAR_SWATCHES, normalizeEventHex } from '@/lib/schedule/event-color';

const TONE_HEX: Record<string, string> = {
  yellow: '#E8E830',
  amber: '#F59E0B',
  indigo: '#6366F1',
  rose: '#F43F5E',
  violet: '#8B5CF6',
  teal: '#14B8A6',
  sky: '#0EA5E9',
  emerald: '#10B981',
};

export type GymCalendarPaint = {
  color: string;
  stripeColor?: string;
};

export function gymCalendarPaint(
  store: FitgraphStore,
  session: FitSession
): GymCalendarPaint {
  const ct = (store.class_types || []).find(
    (c) => c.id === session.class_type_id
  );
  const coach = (store.coaches || []).find((c) => c.id === session.coach_id);
  const kind = sessionKindFromRecord({
    session_kind: session.session_kind,
    class_code: ct?.code,
  });
  const classHex = normalizeEventHex(ct?.color);
  const coachHex = normalizeEventHex(coach?.color);
  const fallback = TONE_HEX[sessionKindTone(kind)] || TONE_HEX.yellow;
  return { color: coachHex || classHex || fallback };
}

export function formatAgreedRateZar(raw?: number | string | null): string | null {
  if (raw == null || raw === '') return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return null;
  return `R${n.toLocaleString('en-ZA', {
    minimumFractionDigits: n % 1 ? 2 : 0,
    maximumFractionDigits: 2,
  })}`;
}

