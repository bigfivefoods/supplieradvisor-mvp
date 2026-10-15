import { resolvePaymentStatus, type ConstructiongraphStore } from './constructiongraph';
import { missingDiarySiteIds } from './diary-model';
import { sastToday } from './format';
import { isDelayed } from './programme-model';
import type { ConstructionRole } from './roles';
import { expiringInductions } from './safety-model';

export type AttentionItem = {
  id: string;
  tone: 'info' | 'warn' | 'bad';
  title: string;
  detail: string;
  href: string;
};

export function attentionItems(
  store: ConstructiongraphStore,
  role: ConstructionRole,
  today = sastToday()
): AttentionItem[] {
  const items: AttentionItem[] = [];
  const money = role === 'owner' || role === 'office' || role === 'viewer';
  if (money && Array.isArray(store.payments)) {
    for (const row of store.payments) {
      if (resolvePaymentStatus(row, today) !== 'overdue') continue;
      items.push({
        id: `pay-${row.id}`,
        tone: 'bad',
        title: `${row.number} is overdue`,
        detail: row.title,
        href: '/dashboard/constructiongraph/payments',
      });
    }
  }
  for (const row of store.programme || []) {
    if (!isDelayed(row, today)) continue;
    items.push({
      id: `prog-${row.id}`,
      tone: 'warn',
      title: `${row.activity} is delayed`,
      detail: 'Plan end is behind today, or the row is marked delayed.',
      href: '/dashboard/constructiongraph/programme',
    });
  }
  for (const row of store.variations || []) {
    if (row.status !== 'submitted' && row.status !== 'queried') continue;
    items.push({
      id: `var-${row.id}`,
      tone: 'warn',
      title: `${row.number} is waiting for a decision`,
      detail: row.title || row.description,
      href: '/dashboard/constructiongraph/variations',
    });
  }
  for (const row of store.safety || []) {
    if (row.kind === 'incident' && row.status !== 'closed') {
      items.push({
        id: `inc-${row.id}`,
        tone: 'bad',
        title: `Incident open: ${row.title}`,
        detail: row.action_owner ? `Action owner ${row.action_owner}` : 'No action owner yet',
        href: '/dashboard/constructiongraph/safety',
      });
    }
  }
  for (const row of expiringInductions(store.safety || [], today)) {
    items.push({
      id: `ind-${row.id}`,
      tone: 'warn',
      title: `Induction expiring: ${row.person_name || row.title}`,
      detail: row.expires_on || row.valid_to || '',
      href: '/dashboard/constructiongraph/safety',
    });
  }
  for (const siteId of missingDiarySiteIds(store, today)) {
    const site = store.sites.find((row) => row.id === siteId);
    items.push({
      id: `diary-${siteId}`,
      tone: 'info',
      title: `Diary missing today${site ? ` · ${site.name}` : ''}`,
      detail: 'Start today’s diary for this project on site.',
      href: '/dashboard/constructiongraph/diary',
    });
  }
  return items;
}

export function bookIsEmpty(store: ConstructiongraphStore): boolean {
  return (
    store.clients.length === 0 &&
    store.sites.length === 0 &&
    store.quotes.length === 0 &&
    store.programme.length === 0 &&
    (store.diary || []).length === 0
  );
}

export function hasSampleRows(store: ConstructiongraphStore): boolean {
  const groups = [
    store.clients,
    store.sites,
    store.quotes,
    store.drawings,
    store.boq,
    store.costs,
    store.subcontractors,
    store.materials,
    store.plant,
    store.programme,
    store.safety,
    store.variations,
    store.certificates,
    store.payments,
    store.snags,
    store.diary,
    store.portals,
  ];
  return groups.some((rows) =>
    (rows || []).some((row) => Boolean(row && (row as { sample?: boolean }).sample))
  );
}
