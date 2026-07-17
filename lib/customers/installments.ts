/**
 * Parse / update structured installment blocks in invoice notes.
 * Format:
 * [installments]
 * YYYY-MM-DD|amount|paid?
 * [/installments]
 */

export type Installment = {
  date: string;
  amount: number;
  paid: boolean;
  index: number;
};

export function parseInstallments(notes: string | null | undefined): Installment[] {
  const text = notes != null ? String(notes) : '';
  const m = text.match(/\[installments\]([\s\S]*?)\[\/installments\]/i);
  if (!m) return [];
  const lines = m[1]
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  const out: Installment[] = [];
  lines.forEach((line, index) => {
    const parts = line.split('|').map((p) => p.trim());
    const date = parts[0] || '';
    const amount = Number(String(parts[1] || '').replace(/,/g, ''));
    const paid =
      String(parts[2] || '').toLowerCase() === 'paid' ||
      String(parts[2] || '') === '1' ||
      String(parts[2] || '').toLowerCase() === 'true';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(amount)) return;
    out.push({ date, amount, paid, index });
  });
  return out;
}

export function writeInstallments(
  notes: string | null | undefined,
  rows: Installment[]
): string {
  let base = notes != null ? String(notes) : '';
  base = base.replace(/\[installments\][\s\S]*?\[\/installments\]/gi, '').trim();
  if (!rows.length) return base;
  const block = `[installments]\n${rows
    .map((r) => `${r.date}|${r.amount}${r.paid ? '|paid' : ''}`)
    .join('\n')}\n[/installments]`;
  return base ? `${base}\n${block}` : block;
}

export function installmentSummary(rows: Installment[]): {
  total: number;
  paid: number;
  remaining: number;
  nextDue: string | null;
} {
  const total = rows.reduce((s, r) => s + r.amount, 0);
  const paid = rows.filter((r) => r.paid).reduce((s, r) => s + r.amount, 0);
  const unpaid = rows.filter((r) => !r.paid);
  return {
    total,
    paid,
    remaining: Math.max(0, total - paid),
    nextDue: unpaid[0]?.date || null,
  };
}
