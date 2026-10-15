import { normaliseEmail, normaliseName, normalisePhoneZA } from './normalise';

export type DebtorMatch = {
  id: string;
  display_name: string;
  id_hash: string | null;
  phones: string[];
  emails: string[];
};

export type DuplicateHit = {
  id: string;
  kind: 'same_id' | 'possible';
};

export function findDebtorDuplicates(debtors: readonly DebtorMatch[], incoming: DebtorMatch): DuplicateHit[] {
  const name = normaliseName(incoming.display_name);
  const phones = new Set(incoming.phones.map(foldPhone).filter(Boolean));
  const emails = new Set(incoming.emails.map(foldEmail).filter(Boolean));
  const hits: DuplicateHit[] = [];
  for (const row of debtors) {
    if (row.id === incoming.id) continue;
    if (incoming.id_hash && row.id_hash && incoming.id_hash === row.id_hash) {
      hits.push({ id: row.id, kind: 'same_id' });
      continue;
    }
    if (!name || normaliseName(row.display_name) !== name) continue;
    const phoneHit = row.phones.some((phone) => phones.has(foldPhone(phone)));
    const emailHit = row.emails.some((email) => emails.has(foldEmail(email)));
    if (phoneHit || emailHit) hits.push({ id: row.id, kind: 'possible' });
  }
  hits.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'same_id' ? -1 : 1;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
  return hits;
}

export type AccountRef = { id: string; creditor_id: string; creditor_account_ref: string };

export function findAccountDuplicates(
  existing: readonly AccountRef[],
  incoming: { creditor_id: string; creditor_account_ref: string }
): AccountRef[] {
  const ref = incoming.creditor_account_ref.trim().toLowerCase();
  return existing
    .filter((row) => row.creditor_id === incoming.creditor_id && row.creditor_account_ref.trim().toLowerCase() === ref)
    .slice()
    .sort((a, b) => (a.id < b.id ? -1 : 1));
}

function foldPhone(value: string): string {
  const parsed = normalisePhoneZA(value);
  return parsed.ok ? parsed.value : '';
}

function foldEmail(value: string): string {
  const parsed = normaliseEmail(value);
  return parsed.ok ? parsed.value : '';
}
