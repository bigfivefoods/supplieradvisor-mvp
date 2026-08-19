/**
 * GymAdvisor member profile: PWA passport facts, join history, PBs.
 */
import { formatAddress, type MemberPassport } from '@/lib/b2c/member-passport';
import type { MemberAccountCharge } from '@/lib/b2c/member-account-types';
import { goalsForClient } from '@/lib/fitness/fitgraph-relationship';
import {
  newId,
  type FitClient,
  type FitMemberJoinEvent,
  type FitgraphStore,
} from '@/lib/fitness/fitgraph';

export type MemberJoinTimelineItem = {
  id: string;
  at: string;
  title: string;
  note?: string;
  source?: string;
};

export type MemberPersonalBest = {
  id: string;
  label: string;
  value: string;
  at?: string | null;
  source: 'goal' | 'watch';
};

export type MemberMonthStatement = {
  month: string;
  label: string;
  charged_zar: number;
  paid_zar: number;
  open_zar: number;
  items: Array<{
    id: string;
    description: string;
    amount_zar: number;
    status: string;
    due_date?: string | null;
  }>;
};

export type PassportFact = { label: string; value: string };

export function appendJoinEvent(
  client: Pick<FitClient, 'join_events'>,
  event: Omit<FitMemberJoinEvent, 'id'> & { id?: string }
): FitMemberJoinEvent[] {
  const row: FitMemberJoinEvent = {
    id: event.id || newId('jn'),
    at: event.at || new Date().toISOString(),
    kind: event.kind,
    title: event.title,
    note: event.note,
    source: event.source,
  };
  return [...(client.join_events || []), row].slice(-80);
}

export function ageFromDob(dob?: string | null, onIso?: string): number | null {
  const raw = String(dob || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const on = String(onIso || new Date().toISOString()).slice(0, 10);
  const [y, m, d] = raw.split('-').map(Number);
  const [oy, om, od] = on.split('-').map(Number);
  let age = oy - y;
  if (om < m || (om === m && od < d)) age -= 1;
  return age >= 0 && age < 130 ? age : null;
}

export function nextOfKinLabel(c: FitClient): string | null {
  const name = String(c.next_of_kin || c.passport?.emergency_name || '').trim();
  const phone = String(
    c.next_of_kin_phone || c.passport?.emergency_phone || ''
  ).trim();
  const rel = String(
    c.next_of_kin_relationship || c.passport?.emergency_relationship || ''
  ).trim();
  if (!name && !phone && !c.emergency_contact) return null;
  if (name || phone) {
    return [name, rel ? `(${rel})` : null, phone].filter(Boolean).join(' · ');
  }
  return String(c.emergency_contact || '').trim() || null;
}

export function memberBirthday(c: FitClient): string | null {
  const dob =
    String(c.date_of_birth || '').slice(0, 10) ||
    String(c.passport?.date_of_birth || '').slice(0, 10) ||
    String(c.medical?.date_of_birth || '').slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(dob) ? dob : null;
}

const PASSPORT_FACTS: Array<[keyof MemberPassport, string]> = [
  ['preferred_name', 'Preferred name'],
  ['title', 'Title'],
  ['date_of_birth', 'Birthday'],
  ['sex', 'Sex'],
  ['language', 'Language'],
  ['nationality', 'Nationality'],
  ['id_type', 'ID type'],
  ['emergency_name', 'Next of kin'],
  ['emergency_relationship', 'Relationship'],
  ['emergency_phone', 'Next of kin phone'],
  ['medical_aid_scheme', 'Medical aid'],
  ['medical_aid_plan', 'Aid plan'],
  ['medical_aid_number', 'Aid number'],
  ['allergies', 'Allergies'],
  ['chronic_conditions', 'Chronic conditions'],
  ['medications', 'Medications'],
  ['blood_type', 'Blood type'],
  ['gp_name', 'GP'],
  ['gp_phone', 'GP phone'],
  ['injury_notes', 'Injury notes'],
  ['training_modifications', 'Training modifications'],
  ['goals', 'Goals'],
  ['experience_level', 'Experience'],
];

export function passportFacts(c: FitClient): PassportFact[] {
  const p = c.passport || {};
  const out: PassportFact[] = [];
  for (const [key, label] of PASSPORT_FACTS) {
    const raw = p[key];
    if (raw == null || raw === false) continue;
    const value = typeof raw === 'boolean' ? (raw ? 'Yes' : '') : String(raw).trim();
    if (!value) continue;
    out.push({ label, value });
  }
  const addr = formatAddress(p);
  if (addr) out.push({ label: 'Address', value: addr });
  if (p.injured === true) out.push({ label: 'Injured', value: 'Yes' });
  if (c.id_number) {
    if (!out.some((f) => f.label === 'ID number')) {
      out.unshift({ label: 'ID number', value: c.id_number });
    }
  }
  return out;
}

function pushUnique(
  items: MemberJoinTimelineItem[],
  seen: Set<string>,
  row: MemberJoinTimelineItem
) {
  const key = `${row.at.slice(0, 16)}|${row.title}`;
  if (seen.has(key)) return;
  seen.add(key);
  items.push(row);
}

export function memberJoinTimeline(
  store: FitgraphStore,
  client: FitClient
): MemberJoinTimelineItem[] {
  const items: MemberJoinTimelineItem[] = [];
  const seen = new Set<string>();
  for (const e of client.join_events || []) {
    pushUnique(items, seen, {
      id: e.id,
      at: e.at,
      title: e.title,
      note: e.note,
      source: e.source,
    });
  }
  if (client.created_at) {
    pushUnique(items, seen, {
      id: `created-${client.id}`,
      at: client.created_at,
      title: 'Added to the gym book',
      source: 'desk',
    });
  }
  if (client.start_date) {
    pushUnique(items, seen, {
      id: `start-${client.id}`,
      at: `${client.start_date}T00:00:00.000Z`,
      title: 'Membership start',
      note: client.start_date,
      source: 'desk',
    });
  }
  if (client.invite_sent_at) {
    pushUnique(items, seen, {
      id: `invite-${client.id}`,
      at: client.invite_sent_at,
      title: 'SA Member invite sent',
      note: client.invite_email || client.email,
      source: 'invite',
    });
  }
  if (client.invite_accepted_at) {
    pushUnique(items, seen, {
      id: `accepted-${client.id}`,
      at: client.invite_accepted_at,
      title: 'Joined on SA Member',
      source: 'pwa',
    });
  } else if (client.platform_user_id) {
    pushUnique(items, seen, {
      id: `wallet-${client.id}`,
      at: client.updated_at || client.created_at,
      title: 'SA Member wallet linked',
      source: 'pwa',
    });
  }
  if (client.membership_frozen_at) {
    pushUnique(items, seen, {
      id: `freeze-${client.id}`,
      at: client.membership_frozen_at,
      title: 'Membership frozen',
      note: client.membership_freeze_until
        ? `Until ${client.membership_freeze_until}`
        : undefined,
      source: 'desk',
    });
  }
  for (const sub of store.subscriptions || []) {
    if (sub.client_id !== client.id || !sub.started_at) continue;
    const plan = store.membership_plans.find((p) => p.id === sub.plan_id);
    pushUnique(items, seen, {
      id: `sub-${sub.id}`,
      at: `${String(sub.started_at).slice(0, 10)}T00:00:00.000Z`,
      title: plan ? `Joined ${plan.name}` : 'Joined a class',
      note: sub.status,
      source: 'system',
    });
    if (sub.cancel_at) {
      pushUnique(items, seen, {
        id: `sub-x-${sub.id}`,
        at: `${String(sub.cancel_at).slice(0, 10)}T00:00:00.000Z`,
        title: plan ? `Left ${plan.name}` : 'Left a class',
        source: 'system',
      });
    }
  }
  for (const n of store.desk_notices || []) {
    if (n.person_id !== client.id) continue;
    pushUnique(items, seen, {
      id: n.id,
      at: n.created_at,
      title:
        n.kind === 'member_joined' ? 'Joined from SA Member' : n.kind,
      note: n.note || undefined,
      source: n.source,
    });
  }
  return items.sort((a, b) => String(b.at).localeCompare(String(a.at)));
}

export function memberPersonalBests(
  store: FitgraphStore,
  clientId: string
): MemberPersonalBest[] {
  const out: MemberPersonalBest[] = [];
  for (const g of goalsForClient(store, clientId)) {
    const unit = g.unit ? ` ${g.unit}` : '';
    if (g.status === 'achieved' && g.current_value != null) {
      out.push({
        id: `goal-${g.id}`,
        label: g.title,
        value: `${g.current_value}${unit}`,
        at: g.achieved_at || g.updated_at,
        source: 'goal',
      });
      continue;
    }
    if (g.current_value != null && Number.isFinite(Number(g.current_value))) {
      out.push({
        id: `goal-${g.id}`,
        label: g.title,
        value: `${g.current_value}${unit}`,
        at: g.updated_at,
        source: 'goal',
      });
    }
  }
  const sessions = (store.watch_sessions || []).filter(
    (s) => s.client_id === clientId
  );
  const longestKm = sessions.reduce<(typeof sessions)[number] | null>(
    (best, s) =>
      Number(s.distance_km) > Number(best?.distance_km || 0) ? s : best,
    null
  );
  if (longestKm && Number(longestKm.distance_km) > 0) {
    out.push({
      id: `watch-km-${longestKm.id}`,
      label: 'Longest watch distance',
      value: `${Number(longestKm.distance_km).toFixed(2)} km`,
      at: longestKm.started_at,
      source: 'watch',
    });
  }
  const longestMin = sessions.reduce<(typeof sessions)[number] | null>(
    (best, s) =>
      Number(s.duration_min) > Number(best?.duration_min || 0) ? s : best,
    null
  );
  if (longestMin && Number(longestMin.duration_min) > 0) {
    out.push({
      id: `watch-min-${longestMin.id}`,
      label: 'Longest watch session',
      value: `${Number(longestMin.duration_min)} min`,
      at: longestMin.started_at,
      source: 'watch',
    });
  }
  const maxCal = sessions.reduce<(typeof sessions)[number] | null>(
    (best, s) =>
      Number(s.calories) > Number(best?.calories || 0) ? s : best,
    null
  );
  if (maxCal && Number(maxCal.calories) > 0) {
    out.push({
      id: `watch-cal-${maxCal.id}`,
      label: 'Highest calories',
      value: `${Math.round(Number(maxCal.calories))} kcal`,
      at: maxCal.started_at,
      source: 'watch',
    });
  }
  return out;
}

export function monthlyStatements(
  charges: MemberAccountCharge[]
): MemberMonthStatement[] {
  const months = new Map<string, MemberMonthStatement>();
  for (const c of charges) {
    const month = String(c.due_date || c.created_at || '').slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(month)) continue;
    let row = months.get(month);
    if (!row) {
      const label = new Date(`${month}-01T12:00:00`).toLocaleString('en-ZA', {
        month: 'long',
        year: 'numeric',
      });
      row = {
        month,
        label,
        charged_zar: 0,
        paid_zar: 0,
        open_zar: 0,
        items: [],
      };
      months.set(month, row);
    }
    const amt = Number(c.amount_zar) || 0;
    if (c.status !== 'void') row.charged_zar += amt;
    if (c.status === 'paid') row.paid_zar += amt;
    if (c.status === 'open' || c.status === 'pending_pop') row.open_zar += amt;
    row.items.push({
      id: c.id,
      description: c.description,
      amount_zar: amt,
      status: c.status,
      due_date: c.due_date,
    });
  }
  return [...months.values()].sort((a, b) => b.month.localeCompare(a.month));
}
