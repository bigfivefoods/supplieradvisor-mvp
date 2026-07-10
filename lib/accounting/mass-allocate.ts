/**
 * Helpers for mass-allocating bank transactions to GL accounts.
 * Groups similar descriptions and suggests expense/income accounts from keywords.
 */

import type { BankTransaction, CoaAccount } from './types';

export type MassAllocGroup = {
  key: string;
  label: string;
  ids: Array<string | number>;
  count: number;
  totalIn: number;
  totalOut: number;
  sampleDescriptions: string[];
  /** Heuristic suggested GL account id */
  suggestedGlId: number | null;
  suggestedGlLabel: string | null;
};

/** Collapse description into a stable merchant/type key for grouping. */
export function normalizeMerchantKey(description: string | null | undefined): string {
  let s = String(description || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
  if (!s) return 'other';

  // Strip common FNB noise
  s = s
    .replace(/\b\d{4,6}\*\d{3,5}\b/g, ' ')
    .replace(/\b\d{1,2}\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b/gi, ' ')
    .replace(/\binv[-_]?\d+\b/gi, ' ')
    .replace(/\b\d{6,}\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Prefer type + first meaningful tokens
  const prefixes = [
    'pos purchase',
    'fuel purchase',
    'fnb app payment to',
    'fnb app payment from',
    'fnb app transfer to',
    'fnb app transfer from',
    'fnb app paym',
    'internet pmt to',
    'internet pmt from',
    'int-banking pmt frm',
    'int-banking pmt to',
    'magtape credit',
    'rtc credit',
    'payshap',
    'send money app',
    'debit order',
    'stop order',
  ];
  for (const p of prefixes) {
    if (s.startsWith(p)) {
      const rest = s.slice(p.length).trim();
      const tokens = rest.split(' ').filter(Boolean).slice(0, 3).join(' ');
      return `${p}${tokens ? ' ' + tokens : ''}`.slice(0, 80);
    }
  }

  return s.split(' ').slice(0, 5).join(' ').slice(0, 80) || 'other';
}

export function displayGroupLabel(key: string): string {
  if (!key || key === 'other') return 'Other / uncategorised';
  return key
    .split(' ')
    .map((w) => (w.length <= 2 ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ');
}

type KeywordRule = {
  pattern: RegExp;
  /** Prefer these CoA codes in order */
  codes: string[];
  /** Or match account name contains */
  nameHints: string[];
  /** Prefer revenue accounts when true */
  preferIncome?: boolean;
};

/** SA / FNB-oriented keyword → GL mapping (resolved against live CoA). */
export const DEFAULT_ALLOC_RULES: KeywordRule[] = [
  {
    pattern: /\b(shell|engen|total\b|fuel|petrol|diesel|motovation|garage)\b/i,
    codes: ['6500', '6990'],
    nameHints: ['travel', 'fuel', 'vehicle', 'motor', 'misc'],
  },
  {
    pattern: /\b(tapngo|plaza|toll|e-?tag)\b/i,
    codes: ['6500', '6990'],
    nameHints: ['travel', 'toll', 'misc'],
  },
  {
    pattern: /\b(coffee|cafe|yoco|restaurant|foodpak|checkers|woolworths|treat|brew)\b/i,
    codes: ['6500', '6990'],
    nameHints: ['entertainment', 'travel', 'meals', 'misc'],
  },
  {
    pattern: /\b(xero|github|paystack|software|subscription|istore|microsoft|adobe)\b/i,
    codes: ['6600', '6990'],
    nameHints: ['professional', 'software', 'subscription', 'misc'],
  },
  {
    pattern: /\b(office space|rent|storage|container storage|landlord)\b/i,
    codes: ['6200'],
    nameHints: ['rent', 'facilit', 'premises', 'storage'],
  },
  {
    pattern: /\b(salary|wages|payroll)\b/i,
    codes: ['6100'],
    nameHints: ['salary', 'wage', 'payroll'],
  },
  {
    pattern: /\b(bank charge|service fee|cash deposit fee|cash handling|predet limit|monthly fee|fee monthly)\b/i,
    codes: ['6900'],
    nameHints: ['bank charge', 'finance', 'fee'],
  },
  {
    pattern: /\b(interest|int charged)\b/i,
    codes: ['6950', '6900'],
    nameHints: ['interest'],
  },
  {
    pattern: /\b(insurance)\b/i,
    codes: ['6700'],
    nameHints: ['insurance'],
  },
  {
    pattern: /\b(electric|water|utility|municipal)\b/i,
    codes: ['6300'],
    nameHints: ['utilit'],
  },
  {
    pattern: /\b(advert|marketing|facebook|google ads)\b/i,
    codes: ['6400'],
    nameHints: ['market'],
  },
  {
    pattern: /\b(loan|drawings|owner)\b/i,
    codes: ['2210', '3300'],
    nameHints: ['loan', 'drawing', 'owner'],
  },
  // Income / receipts
  {
    pattern:
      /\b(payment from|pmt frm|magtape credit|rtc credit|general credit|deposit|salary deposit|int-banking pmt frm)\b/i,
    codes: ['4100', '4200', '4300'],
    nameHints: ['sales', 'revenue', 'service', 'other income'],
    preferIncome: true,
  },
  {
    pattern: /\b(pos purchase|purchase)\b/i,
    codes: ['6990', '6500'],
    nameHints: ['misc', 'operating', 'travel'],
  },
  {
    pattern: /\b(fnb app payment to|internet pmt to|payment to|transfer to)\b/i,
    codes: ['6990', '2110'],
    nameHints: ['misc', 'payable', 'supplier'],
  },
];

function findByCode(coa: CoaAccount[], codes: string[]): CoaAccount | null {
  for (const code of codes) {
    const hit = coa.find((a) => String(a.code) === code && !a.is_header);
    if (hit) return hit;
  }
  return null;
}

function findByNameHints(
  coa: CoaAccount[],
  hints: string[],
  preferTypes?: string[]
): CoaAccount | null {
  const pool = preferTypes?.length
    ? coa.filter((a) => preferTypes.includes(String(a.account_type)))
    : coa;
  for (const h of hints) {
    const hit = pool.find(
      (a) => !a.is_header && String(a.name || '').toLowerCase().includes(h.toLowerCase())
    );
    if (hit) return hit;
  }
  return null;
}

/**
 * Suggest a GL account for a description + signed amount.
 * Inflows prefer revenue; outflows prefer expense/cogs.
 */
export function suggestGlForDescription(
  description: string,
  amount: number,
  coa: CoaAccount[]
): { id: number; label: string } | null {
  const usable = coa.filter(
    (a) =>
      !a.is_header &&
      a.is_active !== false &&
      ['revenue', 'expense', 'cogs', 'liability', 'equity', 'asset'].includes(
        String(a.account_type)
      )
  );
  if (!usable.length) return null;

  const isIn = amount > 0;
  const desc = description || '';

  for (const rule of DEFAULT_ALLOC_RULES) {
    if (!rule.pattern.test(desc)) continue;
    if (rule.preferIncome && !isIn) continue;
    if (!rule.preferIncome && isIn && rule.pattern.source.includes('purchase')) continue;

    const byCode = findByCode(usable, rule.codes);
    if (byCode) {
      return { id: Number(byCode.id), label: `${byCode.code} · ${byCode.name}` };
    }
    const types = rule.preferIncome
      ? ['revenue']
      : isIn
        ? ['revenue', 'liability', 'equity']
        : ['expense', 'cogs', 'liability', 'equity', 'asset'];
    const byName = findByNameHints(usable, rule.nameHints, types);
    if (byName) {
      return { id: Number(byName.id), label: `${byName.code} · ${byName.name}` };
    }
  }

  // Fallbacks
  if (isIn) {
    const rev =
      findByCode(usable, ['4100', '4200', '4300']) ||
      usable.find((a) => a.account_type === 'revenue');
    if (rev) return { id: Number(rev.id), label: `${rev.code} · ${rev.name}` };
  } else {
    const exp =
      findByCode(usable, ['6990', '6900', '6500']) ||
      usable.find((a) => a.account_type === 'expense');
    if (exp) return { id: Number(exp.id), label: `${exp.code} · ${exp.name}` };
  }
  return null;
}

/** Group unallocated transactions for the mass-allocate UI. */
export function groupTransactionsForMassAlloc(
  transactions: BankTransaction[],
  coa: CoaAccount[]
): MassAllocGroup[] {
  const map = new Map<
    string,
    {
      ids: Array<string | number>;
      totalIn: number;
      totalOut: number;
      samples: string[];
      netForSuggest: number;
    }
  >();

  for (const t of transactions) {
    if ((t.allocation_status || 'unallocated') !== 'unallocated') continue;
    const key = normalizeMerchantKey(t.description);
    let g = map.get(key);
    if (!g) {
      g = { ids: [], totalIn: 0, totalOut: 0, samples: [], netForSuggest: 0 };
      map.set(key, g);
    }
    g.ids.push(t.id);
    const amt = Number(t.amount || 0);
    if (amt >= 0) g.totalIn += amt;
    else g.totalOut += Math.abs(amt);
    g.netForSuggest += amt;
    if (g.samples.length < 3 && t.description) g.samples.push(String(t.description));
  }

  const groups: MassAllocGroup[] = [];
  for (const [key, g] of map) {
    const sampleDesc = g.samples[0] || key;
    // Use dominant direction for suggestion
    const suggestAmt = g.totalIn >= g.totalOut ? Math.max(g.netForSuggest, 1) : -Math.max(g.totalOut, 1);
    const suggestion = suggestGlForDescription(sampleDesc, suggestAmt, coa);
    groups.push({
      key,
      label: displayGroupLabel(key),
      ids: g.ids,
      count: g.ids.length,
      totalIn: Math.round(g.totalIn * 100) / 100,
      totalOut: Math.round(g.totalOut * 100) / 100,
      sampleDescriptions: g.samples,
      suggestedGlId: suggestion?.id ?? null,
      suggestedGlLabel: suggestion?.label ?? null,
    });
  }

  // Largest groups first
  groups.sort((a, b) => b.count - a.count || b.totalOut + b.totalIn - (a.totalOut + a.totalIn));
  return groups;
}
