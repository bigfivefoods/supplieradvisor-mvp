/**
 * FleetAdvisor® renewal chain. A renewal is a new row. The earlier row stays as history.
 */
import type { FleetBook, FleetCompliance } from './types';
import { sastDate } from './format';

export function renewItem(
  book: FleetBook,
  itemId: string,
  input: { expires_on: string; issued_on?: string | null; reference?: string; allow_earlier?: boolean },
  now: string
): { ok: true; book: FleetBook; item: FleetCompliance } | { ok: false; error: string } {
  const prior = book.compliance.find((row) => row.id === itemId);
  if (!prior || prior.archived_at) return { ok: false, error: 'Choose a date that is still current.' };
  const expires = sastDate(input.expires_on);
  if (!expires) return { ok: false, error: 'Check the expiry date.' };
  const previous = sastDate(prior.expires_on);
  if (previous && expires <= previous && !input.allow_earlier) {
    return { ok: false, error: 'The new expiry must be after the current one.' };
  }
  const issued = input.issued_on == null || input.issued_on === '' ? null : sastDate(input.issued_on);
  if (input.issued_on && !issued) return { ok: false, error: 'Check the issued date.' };
  const item: FleetCompliance = {
    ...prior,
    id: crypto.randomUUID(),
    reference: input.reference == null ? prior.reference : String(input.reference).trim().slice(0, 64),
    issued_on: issued,
    expires_on: expires,
    archived_at: null,
    renewed_from_id: prior.id,
    updated_at: now,
  };
  const compliance = book.compliance.map((row) => (row.id === prior.id ? { ...row, archived_at: now, updated_at: now } : row));
  return { ok: true, item, book: { ...book, compliance: [...compliance, item] } };
}

export function timelineFor(
  subject: { kind: 'vehicle' | 'driver'; id: string },
  items: FleetCompliance[]
): Array<{ item: FleetCompliance; current: boolean }> {
  const related = items.filter((item) => item.subject_kind === subject.kind && item.subject_id === subject.id);
  const byId = new Map(related.map((item) => [item.id, item]));
  const pointed = new Set(related.map((item) => item.renewed_from_id).filter((id): id is string => Boolean(id)));
  const currents = related.filter((item) => !item.archived_at && !pointed.has(item.id));
  const ordered: Array<{ item: FleetCompliance; current: boolean }> = [];
  const seen = new Set<string>();
  for (const current of currents) {
    const chain: FleetCompliance[] = [];
    let cursor: FleetCompliance | undefined = current;
    while (cursor && !seen.has(cursor.id)) {
      seen.add(cursor.id);
      chain.push(cursor);
      cursor = cursor.renewed_from_id ? byId.get(cursor.renewed_from_id) : undefined;
    }
    chain.forEach((item, index) => ordered.push({ item, current: index === 0 }));
  }
  for (const item of related) {
    if (!seen.has(item.id)) ordered.push({ item, current: !item.archived_at });
  }
  return ordered;
}
