/**
 * Human "keep this account" confirmations from journal allocation review.
 * Stored on accounting_settings.metadata — no extra table.
 */
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { getOrCreateSettings } from '@/lib/accounting/server';
import { normalizeMerchantKey } from '@/lib/accounting/mass-allocate';
import { invalidateLearnedPatterns } from '@/lib/banking/learning';

const META_KEY = 'allocation_keeps';

export type AllocationKeepLine = {
  journal_id: number;
  line_id: number | null;
  gl_account_id: number;
  merchant_key: string;
  sample: string;
  at: string;
};

export type AllocationKeepPattern = {
  gl_account_id: number;
  hits: number;
  sample: string;
};

export type AllocationKeepStore = {
  lines: Record<string, AllocationKeepLine>;
  patterns: Record<string, AllocationKeepPattern>;
};

export function lineKeepId(
  journalId: number,
  lineId: number | null | undefined
): string {
  return `${journalId}:${lineId ?? 'x'}`;
}

export function emptyAllocationKeeps(): AllocationKeepStore {
  return { lines: {}, patterns: {} };
}

export function parseAllocationKeeps(meta: unknown): AllocationKeepStore {
  const root =
    meta && typeof meta === 'object' && !Array.isArray(meta)
      ? (meta as Record<string, unknown>)
      : {};
  const raw = root[META_KEY];
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return emptyAllocationKeeps();
  }
  const o = raw as Record<string, unknown>;
  const lines: AllocationKeepStore['lines'] = {};
  if (o.lines && typeof o.lines === 'object' && !Array.isArray(o.lines)) {
    for (const [k, v] of Object.entries(o.lines as Record<string, unknown>)) {
      if (!v || typeof v !== 'object') continue;
      const row = v as Record<string, unknown>;
      const journalId = Number(row.journal_id);
      const gl = Number(row.gl_account_id);
      if (!Number.isFinite(journalId) || !Number.isFinite(gl)) continue;
      lines[k] = {
        journal_id: journalId,
        line_id: row.line_id != null ? Number(row.line_id) : null,
        gl_account_id: gl,
        merchant_key: String(row.merchant_key || ''),
        sample: String(row.sample || ''),
        at: String(row.at || ''),
      };
    }
  }
  const patterns: AllocationKeepStore['patterns'] = {};
  if (o.patterns && typeof o.patterns === 'object' && !Array.isArray(o.patterns)) {
    for (const [k, v] of Object.entries(o.patterns as Record<string, unknown>)) {
      if (!v || typeof v !== 'object') continue;
      const row = v as Record<string, unknown>;
      const gl = Number(row.gl_account_id);
      if (!k || !Number.isFinite(gl)) continue;
      patterns[k] = {
        gl_account_id: gl,
        hits: Math.max(1, Number(row.hits) || 1),
        sample: String(row.sample || ''),
      };
    }
  }
  return { lines, patterns };
}

export function keepBlocksFlag(
  keeps: AllocationKeepStore,
  opts: {
    journalId: number;
    lineId: number | null;
    merchantKey: string;
    postedAccountId: number;
  }
): boolean {
  if (keeps.lines[lineKeepId(opts.journalId, opts.lineId)]) return true;
  const pat = keeps.patterns[opts.merchantKey];
  if (pat && Number(pat.gl_account_id) === Number(opts.postedAccountId)) {
    return true;
  }
  return false;
}

export async function loadAllocationKeeps(
  companyId: number
): Promise<AllocationKeepStore> {
  const settings = await getOrCreateSettings(companyId);
  return parseAllocationKeeps(settings.metadata);
}

export type AllocationKeepInput = {
  journal_id: number;
  line_id?: number | null;
  gl_account_id: number;
  description?: string | null;
  counterparty?: string | null;
};

export function applyAllocationKeep(
  keeps: AllocationKeepStore,
  input: AllocationKeepInput,
  at = new Date().toISOString()
): void {
  const journalId = Number(input.journal_id);
  const gl = Number(input.gl_account_id);
  if (!Number.isFinite(journalId) || journalId <= 0) {
    throw new Error('journal_id required');
  }
  if (!Number.isFinite(gl) || gl <= 0) {
    throw new Error('account required');
  }
  const sample = String(input.description || '').trim().slice(0, 160);
  const key =
    input.counterparty && String(input.counterparty).trim().length > 2
      ? normalizeMerchantKey(String(input.counterparty))
      : normalizeMerchantKey(sample);
  const id = lineKeepId(journalId, input.line_id ?? null);
  keeps.lines[id] = {
    journal_id: journalId,
    line_id: input.line_id != null ? Number(input.line_id) : null,
    gl_account_id: gl,
    merchant_key: key,
    sample,
    at,
  };
  if (key && key !== 'other') {
    const prev = keeps.patterns[key];
    keeps.patterns[key] = {
      gl_account_id: gl,
      hits: (prev?.gl_account_id === gl ? prev.hits : 0) + 1,
      sample: sample || prev?.sample || key,
    };
  }
}

export async function confirmAllocationKeeps(
  companyId: number,
  items: AllocationKeepInput[]
): Promise<AllocationKeepStore> {
  if (!items.length) return loadAllocationKeeps(companyId);
  const settings = await getOrCreateSettings(companyId);
  const keeps = parseAllocationKeeps(settings.metadata);
  const at = new Date().toISOString();
  for (const item of items) {
    applyAllocationKeep(keeps, item, at);
  }
  const supabase = getSupabaseServer();
  const nextMeta = {
    ...(settings.metadata && typeof settings.metadata === 'object'
      ? settings.metadata
      : {}),
    [META_KEY]: keeps,
  };
  const { error } = await supabase
    .from('accounting_settings')
    .update({
      metadata: nextMeta,
      updated_at: new Date().toISOString(),
    })
    .eq('profile_id', companyId);
  if (error) throw new Error(error.message);
  invalidateLearnedPatterns(companyId);
  const { invalidateAccountingReads } = await import(
    '@/lib/accounting/read-cache'
  );
  invalidateAccountingReads(companyId);
  return keeps;
}

export async function confirmAllocationKeep(
  companyId: number,
  input: AllocationKeepInput
): Promise<AllocationKeepStore> {
  return confirmAllocationKeeps(companyId, [input]);
}
