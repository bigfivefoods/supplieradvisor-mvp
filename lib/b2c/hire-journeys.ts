/**
 * HireAdvisor® golden path for the member app.
 * Request → documents → approved → paid → out → return → done.
 */
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  bookingStatusLabel,
  bookingStatusTimeline,
  HIRE_REQUIREMENT_LABELS,
  readHiregraphFromMetadata,
  type HireRequirementKey,
} from '@/lib/hire/hiregraph';
import type { B2cMembership } from '@/lib/b2c/types';

export type B2cHireJourney = {
  id: string;
  membership_id: string;
  brand: string;
  company_id: number;
  portal_path: string;
  item_title: string;
  code: string;
  status: string;
  status_label: string;
  timeline: Array<{
    id: string;
    label: string;
    done: boolean;
    current: boolean;
  }>;
  start_date?: string | null;
  end_date?: string | null;
  duration_label?: string;
  can_extend?: boolean;
  customer_pays_zar?: number | null;
  deposit_zar?: number | null;
  docs_pending: Array<{ key: string; label: string }>;
  next_action: string;
  open: boolean;
};

export function hireNextAction(
  status: string,
  docs: number,
  endDate?: string | null
): string {
  const st = String(status || 'requested');
  if (st === 'requested') return 'Waiting for the hire desk to approve';
  if (st === 'awaiting_requirements' || docs > 0) {
    return `Complete ${docs || 'required'} document${docs === 1 ? '' : 's'}`;
  }
  if (st === 'approved') return 'Pay the rental and refundable deposit';
  if (st === 'paid') return 'Collect your gear at handover';
  if (st === 'out') {
    return endDate
      ? `On hire — return by ${String(endDate).slice(0, 10)}`
      : 'On hire — return on the agreed date';
  }
  if (st === 'returned') return 'Desk is checking the return and deposit';
  if (st === 'completed') return 'Hire complete — deposit settled';
  if (st === 'cancelled') return 'This hire was cancelled';
  if (st === 'disputed') return 'This hire is in dispute';
  return bookingStatusLabel(st);
}

export async function buildHireJourneys(
  memberships: B2cMembership[]
): Promise<B2cHireJourney[]> {
  const out: B2cHireJourney[] = [];
  const supabase = getSupabaseServer();
  const hireMems = memberships.filter(
    (m) => m.kind === 'hire' && m.active !== false
  );

  for (const mem of hireMems) {
    const { data } = await supabase
      .from('profiles')
      .select('metadata')
      .eq('id', mem.company_id)
      .maybeSingle();
    const meta =
      data?.metadata && typeof data.metadata === 'object'
        ? (data.metadata as Record<string, unknown>)
        : {};
    const store = readHiregraphFromMetadata(meta);
    const crmId = Number(mem.ref_id);
    const mine = (store.bookings || []).filter(
      (b) => Number(b.crm_customer_id || b.customer_id) === crmId
    );
    const brand = mem.brand || mem.company_name;

    for (const b of mine) {
      const payload = {
        id: b.id,
        status: String(b.status || 'requested'),
        status_label: bookingStatusLabel(b.status),
        timeline: bookingStatusTimeline(b.status),
        requirements_pending: (b.requirements_pending || []).map((r) => {
          const key = String(r) as HireRequirementKey;
          return {
            key,
            label: HIRE_REQUIREMENT_LABELS[key] || String(r).replace(/_/g, ' '),
          };
        }),
      };
      const docs = payload.requirements_pending;
      const st = payload.status;
      const open = [
        'requested',
        'awaiting_requirements',
        'approved',
        'paid',
        'out',
        'returned',
      ].includes(st);

      out.push({
        id: b.id,
        membership_id: mem.id,
        brand,
        company_id: mem.company_id,
        portal_path: mem.portal_path,
        item_title: b.item_title || b.code || 'Hire',
        code: b.code || b.id,
        status: st,
        status_label: payload.status_label,
        timeline: payload.timeline,
        start_date: b.start_date || null,
        end_date: b.end_date || null,
        duration_label: `${b.units || 1} unit${Number(b.units || 1) === 1 ? '' : 's'}`,
        can_extend: ['approved', 'paid', 'out'].includes(st),
        customer_pays_zar: b.customer_pays_zar ?? b.rental_zar ?? null,
        deposit_zar: b.deposit_zar ?? null,
        docs_pending: docs,
        next_action: hireNextAction(st, docs.length, b.end_date),
        open,
      });
    }
  }

  out.sort((a, b) => {
    if (a.open !== b.open) return a.open ? -1 : 1;
    return String(b.start_date || b.code).localeCompare(
      String(a.start_date || a.code)
    );
  });
  return out.slice(0, 24);
}
