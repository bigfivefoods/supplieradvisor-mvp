/**
 * Gym member seed loaded at runtime from Supabase.
 * This module holds types and parsing only. It must not embed member records.
 */
import type { FitContractSubmission } from '@/lib/fitness/member-contract';

export type VukaRosterRow = {
  name: string;
  amount_zar: number;
  /** Desk class code: 5AM MWF, BC, KAKB, PILATES, KIDS, 5AM T TH, 6:00 AM */
  class_hint?: string;
  note?: string;
};

export type VukaNameFold = {
  aliases: string[];
  canonical: string;
};

export type VukaCoachSeed = {
  name: string;
  email: string;
  code: string;
  /** Prefer a same-first-name coach whose name contains this fragment. */
  match_name?: string;
  /** Skip same-first-name people whose name contains this fragment. */
  avoid_name?: string;
};

export type VukaMemberSeed = {
  /**
   * Stamp compared with settings.vuka_contracts_import.
   * The historical gym stamp is 2026-08-19-bank.
   */
  importVersion: string;
  submissions: FitContractSubmission[];
  roster: VukaRosterRow[];
  nameFolds: VukaNameFold[];
  coaches: VukaCoachSeed[];
};

/** Do not rename. Live gym files are already stamped with this value. */
export const HISTORICAL_VUKA_CONTRACTS_IMPORT = '2026-08-19-bank';

export function emptyVukaMemberSeed(): VukaMemberSeed {
  return {
    importVersion: HISTORICAL_VUKA_CONTRACTS_IMPORT,
    submissions: [],
    roster: [],
    nameFolds: [],
    coaches: [],
  };
}

export function seedHasMembers(seed: VukaMemberSeed): boolean {
  return seed.submissions.length > 0 || seed.roster.length > 0;
}

export function contractsImportStamp(version: unknown): string {
  const v = String(version ?? '').trim();
  if (!v) return HISTORICAL_VUKA_CONTRACTS_IMPORT;
  if (v.endsWith('-bank')) return v;
  return `${v}-bank`;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * Accepts the private import file, including a legacy export that only has
 * import_version and submissions.
 */
export function parseVukaMemberSeed(raw: unknown): VukaMemberSeed {
  const row = asRecord(raw);
  if (!row) throw new Error('Member seed must be a JSON object');
  if (row.example === true) {
    throw new Error(
      'Refusing the example seed. Point the importer at your private file.'
    );
  }
  const submissions = Array.isArray(row.submissions) ? row.submissions : [];
  const roster = Array.isArray(row.roster) ? row.roster : [];
  const folds = Array.isArray(row.name_folds)
    ? row.name_folds
    : Array.isArray(row.nameFolds)
      ? row.nameFolds
      : [];
  const coaches = Array.isArray(row.coaches) ? row.coaches : [];

  const parsedSubs: FitContractSubmission[] = [];
  for (const item of submissions) {
    const rec = asRecord(item);
    if (!rec) continue;
    const name = asString(rec.name);
    if (!name) continue;
    parsedSubs.push({ ...(rec as unknown as FitContractSubmission), name });
  }

  const parsedRoster: VukaRosterRow[] = [];
  for (const item of roster) {
    const rec = asRecord(item);
    if (!rec) continue;
    const name = asString(rec.name);
    const amount = Number(rec.amount_zar);
    if (!name || !Number.isFinite(amount)) continue;
    const hint = asString(rec.class_hint);
    const note = asString(rec.note);
    parsedRoster.push({
      name,
      amount_zar: amount,
      ...(hint ? { class_hint: hint } : {}),
      ...(note ? { note } : {}),
    });
  }

  const parsedFolds: VukaNameFold[] = [];
  for (const item of folds) {
    const rec = asRecord(item);
    if (!rec) continue;
    const canonical = asString(rec.canonical);
    const aliases = Array.isArray(rec.aliases)
      ? rec.aliases.map((alias) => asString(alias).toLowerCase()).filter(Boolean)
      : [];
    if (!canonical || !aliases.length) continue;
    parsedFolds.push({ canonical, aliases });
  }

  const parsedCoaches: VukaCoachSeed[] = [];
  for (const item of coaches) {
    const rec = asRecord(item);
    if (!rec) continue;
    const name = asString(rec.name);
    const email = asString(rec.email).toLowerCase();
    const code = asString(rec.code);
    if (!name || !email || !code) continue;
    const match = asString(rec.match_name);
    const avoid = asString(rec.avoid_name);
    parsedCoaches.push({
      name,
      email,
      code,
      ...(match ? { match_name: match } : {}),
      ...(avoid ? { avoid_name: avoid } : {}),
    });
  }

  return {
    importVersion: contractsImportStamp(row.import_version ?? row.importVersion),
    submissions: parsedSubs,
    roster: parsedRoster,
    nameFolds: parsedFolds,
    coaches: parsedCoaches,
  };
}
