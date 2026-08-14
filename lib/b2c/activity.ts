/**
 * Personal activity for SA Member home — upcoming hires, classes, docs, alerts.
 */
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  bookingStatusLabel,
  readHiregraphFromMetadata,
} from '@/lib/hire/hiregraph';
import {
  evaluateMemberAccess,
  readFitgraphFromMetadata,
} from '@/lib/fitness/fitgraph';
import type { B2cMembership } from '@/lib/b2c/types';
import {
  chargesForMember,
  readMemberAccountStore,
} from '@/lib/b2c/member-account';
import {
  formatZar,
  isAdvisorAccountKind,
  kindAccountLabel,
} from '@/lib/b2c/member-account-types';

export type B2cActivityItem = {
  id: string;
  kind: string;
  tone: 'hire' | 'gym' | 'clinic' | 'alert' | 'docs';
  title: string;
  subtitle: string;
  href: string;
  when?: string | null;
  badge?: string | null;
};

export async function buildB2cActivity(
  memberships: B2cMembership[]
): Promise<B2cActivityItem[]> {
  const items: B2cActivityItem[] = [];
  const today = new Date().toISOString().slice(0, 10);
  const companyCache = new Map<
    number,
    Record<string, unknown>
  >();

  async function meta(companyId: number) {
    if (companyCache.has(companyId)) return companyCache.get(companyId)!;
    const supabase = getSupabaseServer();
    const { data } = await supabase
      .from('profiles')
      .select('metadata')
      .eq('id', companyId)
      .maybeSingle();
    const m =
      data?.metadata && typeof data.metadata === 'object'
        ? (data.metadata as Record<string, unknown>)
        : {};
    companyCache.set(companyId, m);
    return m;
  }

  for (const mem of memberships.filter((m) => m.active !== false)) {
    const brand = mem.brand || mem.company_name;
    try {
      const raw = await meta(mem.company_id);

      if (isAdvisorAccountKind(mem.kind)) {
        const acct = readMemberAccountStore(raw);
        const mine = chargesForMember(acct, {
          kind: mem.kind,
          ref_id: mem.ref_id,
          email: mem.email,
        });
        const openZar = mine
          .filter((c) => c.status === 'open')
          .reduce((n, c) => n + (Number(c.amount_zar) || 0), 0);
        if (openZar > 0) {
          items.push({
            id: `acct-${mem.company_id}-${mem.kind}-${mem.ref_id}`,
            kind: mem.kind,
            tone: 'alert',
            title: `${formatZar(openZar)} due`,
            subtitle: `${brand} · ${kindAccountLabel(mem.kind)}`,
            href: `/me?tab=memberships&account=${mem.company_id}`,
            badge: 'Pay',
          });
        }
      }

      if (mem.kind === 'hire') {
        const store = readHiregraphFromMetadata(raw);
        const crmId = Number(mem.ref_id);
        const mine = (store.bookings || []).filter(
          (b) => Number(b.crm_customer_id || b.customer_id) === crmId
        );
        for (const b of mine) {
          const st = String(b.status || '');
          if (
            ['cancelled', 'completed', 'returned'].includes(st)
          ) {
            continue;
          }
          const docs = (b.requirements_pending || []).length;
          items.push({
            id: `hire-${b.id}`,
            kind: 'hire',
            tone: docs && st === 'awaiting_requirements' ? 'docs' : 'hire',
            title: b.item_title || b.code || 'Hire',
            subtitle: `${brand} · ${bookingStatusLabel(st)}`,
            href: mem.portal_path,
            when: b.start_date || b.created_at || null,
            badge:
              docs > 0
                ? `${docs} doc${docs === 1 ? '' : 's'} needed`
                : bookingStatusLabel(st),
          });
        }
      }

      if (mem.kind === 'gym') {
        const store = readFitgraphFromMetadata(raw);
        const client = store.clients.find((c) => c.id === mem.ref_id);
        if (client) {
          const access = evaluateMemberAccess(store, client);
          if (!access.payment_ok || access.level === 'blocked') {
            items.push({
              id: `gym-alert-${mem.id}`,
              kind: 'gym',
              tone: 'alert',
              title: access.alert || 'Membership needs attention',
              subtitle: brand,
              href: mem.portal_path,
              badge: access.level === 'blocked' ? 'Blocked' : 'Unpaid',
            });
          }
          const mine = (store.bookings || []).filter(
            (b) =>
              b.client_id === client.id &&
              (b.status === 'booked' ||
                b.status === 'waitlist' ||
                b.status === 'attended')
          );
          for (const b of mine) {
            const ses = store.sessions.find((s) => s.id === b.session_id);
            if (!ses || ses.date < today) continue;
            const ct = store.class_types.find(
              (t) => t.id === ses.class_type_id
            );
            items.push({
              id: `gym-${b.id}`,
              kind: 'gym',
              tone: 'gym',
              title: ct?.name || 'Class',
              subtitle: `${brand} · ${ses.start_time || ''}`,
              href: mem.portal_path,
              when: `${ses.date}T${ses.start_time || '00:00'}`,
              badge: b.status === 'waitlist' ? 'Waitlist' : 'Booked',
            });
          }
        }
      }

      if (
        mem.kind === 'physio' ||
        mem.kind === 'dental' ||
        mem.kind === 'medical' ||
        mem.kind === 'psychiatry'
      ) {
        items.push({
          id: `clinic-${mem.id}`,
          kind: mem.kind,
          tone: 'clinic',
          title: `Book at ${brand}`,
          subtitle:
            mem.kind === 'physio'
              ? 'Physio appointments'
              : mem.kind === 'dental'
                ? 'Dental visits'
                : mem.kind === 'medical'
                  ? 'Practice bookings'
                  : 'Psychiatry sessions',
          href: mem.portal_path,
          badge: 'Open diary',
        });
      }
    } catch {
      /* skip broken company */
    }
  }

  items.sort((a, b) => {
    const aw = a.tone === 'alert' || a.tone === 'docs' ? 0 : 1;
    const bw = b.tone === 'alert' || b.tone === 'docs' ? 0 : 1;
    if (aw !== bw) return aw - bw;
    return String(a.when || '9').localeCompare(String(b.when || '9'));
  });

  return items.slice(0, 20);
}
