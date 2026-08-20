/**
 * Preview or apply duplicate invoice recognition / bank-income overlap.
 *
 *   npx tsx scripts/dedupe-invoice-books.mts 102
 *   npx tsx scripts/dedupe-invoice-books.mts 102 --apply
 */
import { readFileSync, existsSync } from 'fs';
import { applyInvoiceDedupe } from '../lib/accounting/dedupe-invoice-books';

function loadEnv() {
  const paths = ['.env.local', '/workspaces/supplieradvisor-mvp/.env.local'];
  for (const p of paths) {
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, 'utf8').split('\n')) {
      const t = line.trim();
      if (!t || t.startsWith('#') || !t.includes('=')) continue;
      const i = t.indexOf('=');
      const k = t.slice(0, i);
      const v = t.slice(i + 1).replace(/^["']|["']$/g, '');
      if (!process.env[k]) process.env[k] = v;
    }
  }
}

loadEnv();

const profileId = Number(process.argv[2] || 102);
const apply = process.argv.includes('--apply');
if (!Number.isFinite(profileId) || profileId <= 0) {
  console.error('Usage: npx tsx scripts/dedupe-invoice-books.mts <companyId> [--apply]');
  process.exit(1);
}

const report = await applyInvoiceDedupe({
  profileId,
  createdBy: 'ops:dedupe-invoice-books',
  apply,
});
console.log(JSON.stringify(report, null, 2));
if (report.errors.length) process.exit(1);
