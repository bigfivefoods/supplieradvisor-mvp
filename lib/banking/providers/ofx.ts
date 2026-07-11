/**
 * Minimal OFX / QFX bank statement parser (SGML-style OFX 1.x common in SA exports).
 * Converts to CanonicalTxn for the shared ingest pipeline.
 */

import type { CanonicalTxn } from '../types';
import { providerTxnId } from '../ingest';
import { parseAmount, parseDate } from '@/lib/accounting/csv';

function tagValue(block: string, tag: string): string | null {
  // <TAG>value or <TAG>value</TAG>
  const re = new RegExp(`<${tag}>([^<\\r\\n]+)`, 'i');
  const m = block.match(re);
  return m ? m[1].trim() : null;
}

function splitTransactions(ofx: string): string[] {
  const parts = ofx.split(/<STMTTRN>/i).slice(1);
  return parts.map((p) => p.split(/<\/STMTTRN>/i)[0] || p);
}

/**
 * Parse OFX/QFX text into canonical bank transactions.
 * Amounts: OFX credit positive, debit negative — we keep signed +in / −out.
 */
export function parseOfxText(text: string): {
  txns: CanonicalTxn[];
  warnings: string[];
  accountId?: string | null;
  currency?: string;
} {
  const warnings: string[] = [];
  const raw = String(text || '');
  if (!/<OFX>/i.test(raw) && !/<STMTTRN>/i.test(raw)) {
    return { txns: [], warnings: ['Not a valid OFX file (missing OFX/STMTTRN markers)'] };
  }

  const currency =
    tagValue(raw, 'CURDEF') || tagValue(raw, 'CURRENCY') || 'ZAR';
  const accountId =
    tagValue(raw, 'ACCTID') || tagValue(raw, 'BANKID') || null;

  const blocks = splitTransactions(raw);
  const txns: CanonicalTxn[] = [];
  let skipped = 0;

  for (const block of blocks) {
    const dateRaw =
      tagValue(block, 'DTPOSTED') ||
      tagValue(block, 'DTUSER') ||
      tagValue(block, 'DTAVAIL');
    // OFX dates: YYYYMMDD or YYYYMMDDHHMMSS
    let booked_at: string | null = null;
    if (dateRaw && /^\d{8}/.test(dateRaw)) {
      booked_at = `${dateRaw.slice(0, 4)}-${dateRaw.slice(4, 6)}-${dateRaw.slice(6, 8)}`;
    } else {
      booked_at = parseDate(dateRaw);
    }
    if (!booked_at) {
      skipped++;
      continue;
    }

    const amtRaw = tagValue(block, 'TRNAMT');
    const amount = parseAmount(amtRaw);
    if (amount == null || amount === 0) {
      skipped++;
      continue;
    }

    const fitid = tagValue(block, 'FITID');
    const name = tagValue(block, 'NAME');
    const memo = tagValue(block, 'MEMO');
    const checknum = tagValue(block, 'CHECKNUM');
    const refnum = tagValue(block, 'REFNUM');
    const trntype = tagValue(block, 'TRNTYPE');

    const description = [name, memo].filter(Boolean).join(' — ') || trntype || 'OFX transaction';
    const reference = refnum || checknum || fitid;
    const provider_txn_id =
      fitid ||
      providerTxnId('ofx', [booked_at, description, amount, reference, accountId]);

    txns.push({
      provider: 'ofx',
      provider_txn_id,
      booked_at,
      amount,
      currency: currency || 'ZAR',
      description: description.slice(0, 500),
      reference: reference ? reference.slice(0, 200) : null,
      counterparty: name ? name.slice(0, 200) : null,
      balance_after: null,
      raw: {
        trntype,
        fitid,
        name,
        memo,
        checknum,
        refnum,
        ofx_account: accountId,
      },
    });
  }

  if (!txns.length) {
    warnings.push('No STMTTRN transactions parsed from OFX');
  }
  if (skipped) {
    warnings.push(`Skipped ${skipped} incomplete OFX rows`);
  }

  return { txns, warnings, accountId, currency: currency || 'ZAR' };
}

export function isOfxContent(text: string, filename?: string): boolean {
  const fn = String(filename || '').toLowerCase();
  if (fn.endsWith('.ofx') || fn.endsWith('.qfx')) return true;
  const head = String(text || '').slice(0, 400).toUpperCase();
  return head.includes('<OFX') || head.includes('OFXHEADER');
}
