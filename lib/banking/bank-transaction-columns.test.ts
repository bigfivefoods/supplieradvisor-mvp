/**
 * bank_transactions queries must use columns the table actually has.
 * Run: npx --yes tsx lib/banking/bank-transaction-columns.test.ts
 *
 * Does not connect to Postgres. Production and staging are never written.
 */
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import {
  BANK_TRANSACTION_COLUMNS,
  UNALLOCATED_BANK_FILTER,
  UNALLOCATED_BANK_ORDER,
  UNALLOCATED_BANK_SELECT,
  bankClaimMatchPatch,
  bankLineTimestamp,
  isBankTransactionColumn,
  unmatchedBankNotification,
} from './bank-transaction-shape';

const FORBIDDEN = ['transaction_date', 'is_allocated', 'allocated', 'invoice_id'];

for (const name of FORBIDDEN) {
  assert.equal(
    isBankTransactionColumn(name),
    false,
    `${name} is not a bank_transactions column`
  );
}

for (const col of columnsInList(UNALLOCATED_BANK_SELECT)) {
  assert.equal(isBankTransactionColumn(col), true, `select ${col}`);
}
for (const col of columnsInFilter(UNALLOCATED_BANK_FILTER)) {
  assert.equal(isBankTransactionColumn(col), true, `filter ${col}`);
}
assert.equal(isBankTransactionColumn(UNALLOCATED_BANK_ORDER), true);
assert.equal(UNALLOCATED_BANK_FILTER.includes('unmatched'), false);
assert.equal(UNALLOCATED_BANK_FILTER.includes('unallocated'), true);

const now = '2026-10-22T12:00:00.000Z';

assert.equal(unmatchedBankNotification({ error: null, data: [] }, now), null);
assert.equal(unmatchedBankNotification({ error: null, data: null }, now), null);
assert.equal(
  unmatchedBankNotification(
    { error: { message: 'column bank_transactions.transaction_date does not exist' }, data: null },
    now
  ),
  null
);

const one = unmatchedBankNotification(
  {
    error: null,
    data: [
      {
        txn_date: '2026-10-19',
        description: 'EFT',
        amount: 100,
      },
    ],
  },
  now
);
assert.ok(one);
assert.equal(one.created_at, '2026-10-19');
assert.equal(one.severity, 'info');
assert.equal(one.source, 'banking');
assert.match(one.title, /1\+ unmatched bank line$/);

const legacyDate = unmatchedBankNotification(
  {
    error: null,
    data: [{ tx_date: '2026-10-18T08:12:00.000Z', created_at: '2026-10-01T00:00:00.000Z' }],
  },
  now
);
assert.equal(legacyDate?.created_at, '2026-10-18T08:12:00.000Z');
assert.equal(bankLineTimestamp({}, now), now);

const many = unmatchedBankNotification(
  {
    error: null,
    data: Array.from({ length: 5 }, () => ({ txn_date: '2026-10-19' })),
  },
  now
);
assert.equal(many?.severity, 'warning');
assert.match(many?.title || '', /5\+ unmatched bank lines/);

const patch = bankClaimMatchPatch({
  invoiceId: 42,
  now,
  actorUserId: 'user-1',
});
for (const key of Object.keys(patch)) {
  assert.equal(isBankTransactionColumn(key), true, `patch.${key}`);
}
assert.equal(patch.allocation_status, 'allocated');
assert.equal(patch.matched_invoice_id, 42);
assert.equal(patch.allocated_by, 'user-1');
assert.equal('allocated' in patch && typeof patch.allocated === 'boolean', false);
assert.equal('is_allocated' in patch, false);
assert.equal('invoice_id' in patch, false);

const route = readFileSync('app/api/notifications/route.ts', 'utf8');
assert.match(route, /UNALLOCATED_BANK_SELECT/);
assert.match(route, /UNALLOCATED_BANK_FILTER/);
assert.match(route, /UNALLOCATED_BANK_ORDER/);
assert.equal(route.includes('transaction_date'), false);
assert.equal(route.includes('is_allocated'), false);
assert.equal(route.includes('allocated.eq'), false);

const claim = readFileSync('lib/banking/apply-match-for-claim.ts', 'utf8');
assert.match(claim, /bankClaimMatchPatch/);
assert.equal(claim.includes('is_allocated'), false);
assert.equal(claim.includes('transaction_date'), false);
assert.equal(claim.includes('invoice_id:'), false);

const unknown = scanBankTransactionQueries(process.cwd());
assert.deepEqual(unknown, [], unknown.map((u) => `${u.file} ${u.column}`).join('\n'));

assert.ok(BANK_TRANSACTION_COLUMNS.includes('txn_date'));
assert.ok(BANK_TRANSACTION_COLUMNS.includes('allocation_status'));

console.log('bank-transaction-columns.test.ts ok');

function topLevelKeys(objectBody: string): string[] {
  const keys: string[] = [];
  let depth = 0;
  let quote: "'" | '"' | '`' | null = null;
  for (let i = 0; i < objectBody.length; i++) {
    const ch = objectBody[i];
    if (quote) {
      if (ch === '\\') {
        i += 1;
        continue;
      }
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') {
      quote = ch;
      continue;
    }
    if (ch === '{' || ch === '(' || ch === '[') {
      depth += 1;
      continue;
    }
    if (ch === '}' || ch === ')' || ch === ']') {
      depth = Math.max(0, depth - 1);
      continue;
    }
    if (depth !== 0) continue;
    const m = objectBody.slice(i).match(/^([a-z_][a-z0-9_]*)\s*:/);
    if (m) {
      keys.push(m[1]);
      i += m[0].length - 1;
    }
  }
  return keys;
}

function columnsInList(list: string): string[] {
  return list
    .split(',')
    .map((part) => part.trim().split(/\s+/)[0])
    .filter((col) => col && col !== '*');
}

function columnsInFilter(filter: string): string[] {
  return filter
    .split(',')
    .map((clause) => clause.split('.')[0]?.trim() || '')
    .filter(Boolean);
}

function scanBankTransactionQueries(root: string): Array<{ file: string; column: string }> {
  const bad: Array<{ file: string; column: string }> = [];
  const knownSelects: Record<string, string> = {
    UNALLOCATED_BANK_SELECT,
  };
  const knownFilters: Record<string, string> = {
    UNALLOCATED_BANK_FILTER,
  };
  const knownOrders: Record<string, string> = {
    UNALLOCATED_BANK_ORDER,
  };
  for (const file of listTs(root)) {
    const src = readFileSync(file, 'utf8');
    if (!src.includes('bank_transactions')) continue;
    const re = /\.from\(\s*['"]bank_transactions['"]\s*\)/g;
    let match: RegExpExecArray | null;
    while ((match = re.exec(src))) {
      const rest = src.slice(match.index + match[0].length);
      const nextFrom = rest.search(/\.from\(/);
      const window = rest.slice(0, nextFrom === -1 ? 700 : nextFrom);
      const before = src.slice(Math.max(0, match.index - 600), match.index);
      const cols = new Set<string>();
      collectSelect(window, before, knownSelects, cols);
      collectFilter(window, knownFilters, cols);
      collectOrder(window, knownOrders, cols);
      for (const filter of window.matchAll(
        /\.(?:eq|neq|gt|gte|lt|lte|in|is)\(\s*['"]([a-z_][a-z0-9_]*)['"]/g
      )) {
        cols.add(filter[1]);
      }
      for (const obj of window.matchAll(/\.(?:update|insert)\(\s*\{([\s\S]*?)\}\s*\)/g)) {
        for (const key of topLevelKeys(obj[1])) cols.add(key);
      }
      for (const col of cols) {
        if (!isBankTransactionColumn(col)) {
          bad.push({ file: file.slice(root.length + 1), column: col });
        }
      }
    }
  }
  return bad;
}

function collectSelect(
  window: string,
  before: string,
  known: Record<string, string>,
  cols: Set<string>
) {
  const literal = window.match(/\.select\(\s*['"]([^'"]+)['"]/);
  if (literal) {
    for (const col of columnsInList(literal[1])) cols.add(col);
    return;
  }
  const ident = window.match(/\.select\(\s*([A-Za-z_][A-Za-z0-9_]*)\s*[,)]/);
  if (!ident) return;
  const name = ident[1];
  if (known[name]) {
    for (const col of columnsInList(known[name])) cols.add(col);
    return;
  }
  const assign = before.match(
    new RegExp(`${name}\\s*=\\s*['"]([^'"]+)['"]`)
  );
  if (assign) {
    for (const col of columnsInList(assign[1])) cols.add(col);
  }
}

function collectFilter(window: string, known: Record<string, string>, cols: Set<string>) {
  const literal = window.match(/\.or\(\s*['"]([^'"]+)['"]/);
  if (literal) {
    for (const col of columnsInFilter(literal[1])) cols.add(col);
    return;
  }
  const ident = window.match(/\.or\(\s*([A-Za-z_][A-Za-z0-9_]*)\s*\)/);
  if (ident && known[ident[1]]) {
    for (const col of columnsInFilter(known[ident[1]])) cols.add(col);
  }
}

function collectOrder(window: string, known: Record<string, string>, cols: Set<string>) {
  for (const literal of window.matchAll(/\.order\(\s*['"]([a-z_][a-z0-9_]*)['"]/g)) {
    cols.add(literal[1]);
  }
  for (const ident of window.matchAll(/\.order\(\s*([A-Za-z_][A-Za-z0-9_]*)\s*,/g)) {
    const name = ident[1];
    if (known[name]) cols.add(known[name]);
  }
}

function listTs(dir: string, out: string[] = []): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of entries) {
    if (
      name === 'node_modules' ||
      name === '.next' ||
      name === '.git' ||
      name === 'dist' ||
      name === 'coverage'
    ) {
      continue;
    }
    const path = join(dir, name);
    let st;
    try {
      st = statSync(path);
    } catch {
      continue;
    }
    if (st.isDirectory()) listTs(path, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(path);
  }
  return out;
}
