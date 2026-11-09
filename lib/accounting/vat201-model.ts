/**
 * South African VAT201, calculated from documents and ledger movements.
 * Pure: no database, no network, no SARS credentials.
 *
 * Payment basis — output and input VAT follow the cash date. An unpaid bill
 * contributes nothing until it is paid.
 * Invoice basis — output and input VAT follow the invoice or bill date.
 * Hybrid — output VAT on the invoice date, input VAT on the cash date.
 * SARS registers a vendor on the invoice basis or the payments basis.
 * Hybrid is a book treatment for this return, not a third SARS category.
 *
 * Field numbers follow the SARS VAT201 guide (GEN-ELEC-04-G01):
 * https://www.sars.gov.za/wp-content/uploads/Ops/Guides/GEN-ELEC-04-G01-Guide-for-completing-the-Value-Added-Tax-VAT201-Declaration-External-Guide.pdf
 */
import { round2 } from '@/lib/accounting/vat';

export const ZA_VAT_RATE = 15;
/** Full tax invoice at this consideration (VAT included) and above. VAT Act s20. */
export const TAX_INVOICE_FULL_FROM = 5000;
/** At or below this consideration a tax invoice is not required. VAT Act s20. */
export const TAX_INVOICE_NOT_REQUIRED_TO = 50;

export const SARS_EFILING_URL = 'https://www.sarsefiling.co.za/';

export type VatBasis = 'payment' | 'invoice' | 'hybrid';
export type VatPeriodCategory = 'A' | 'B' | 'C' | 'D' | 'E';
export type VatFilingChannel = 'manual' | 'efiling';
export type VatReturnStatus = 'draft' | 'reviewed' | 'submitted' | 'paid';
export type VatSide = 'output' | 'input';

export type VatSupplyKind =
  | 'standard'
  | 'standard_capital'
  | 'zero_rated'
  | 'zero_rated_export'
  | 'exempt'
  | 'accommodation_over_28'
  | 'accommodation_under_28'
  | 'change_in_use_output'
  | 'other_output'
  | 'imported_capital'
  | 'imported_other'
  | 'change_in_use_input'
  | 'bad_debt'
  | 'other_input';

export type VatCashEvent = { date: string; amount: number };

export type TaxInvoiceFacts = {
  labelled: boolean;
  supplierName: boolean;
  supplierAddress: boolean;
  supplierVat: boolean;
  recipientName: boolean;
  recipientAddress: boolean;
  recipientVat: boolean;
  serial: boolean;
  date: boolean;
  description: boolean;
  quantity: boolean;
  consideration: boolean;
  vatShown: boolean;
  customsCode?: boolean;
};

export type VatDocument = {
  id: string;
  side: VatSide;
  documentDate: string;
  reference: string;
  counterparty: string;
  exclusive: number;
  vat: number;
  inclusive: number;
  kind: VatSupplyKind;
  cash: VatCashEvent[];
  facts: TaxInvoiceFacts;
  source?: string | null;
};

export type VatAccountSnap = {
  id: number;
  code: string;
  name: string;
  account_type: string;
  subtype?: string | null;
};

export type VatLedgerRow = {
  account_id: number;
  debit: number;
  credit: number;
  /** When set, this is `signedStatementAmount` from statement-figures. */
  signed?: number;
};

export type VatPeriod = {
  start: string;
  end: string;
  label: string;
  dueOn: string;
};

export type VatVendorSettings = {
  vatNumber: string;
  basis: VatBasis;
  category: VatPeriodCategory;
  effectiveFrom: string;
  firstPeriodEnd: string;
  filingChannel: VatFilingChannel;
};

export type Vat201Field = {
  code: string;
  label: string;
  hint: string;
  value: number;
  /** What eFiling expects to be typed or confirmed. */
  copy: string;
  section: 'output' | 'input' | 'result' | 'diesel';
};

export type VatListingRow = {
  id: string;
  side: VatSide;
  cashDate: string;
  documentDate: string;
  reference: string;
  counterparty: string;
  kind: VatSupplyKind;
  exclusive: number;
  vat: number;
  inclusive: number;
  claimed: boolean;
  blockedReason: string | null;
};

export type VatInvoiceGap = {
  id: string;
  side: VatSide;
  reference: string;
  counterparty: string;
  date: string;
  inclusive: number;
  threshold: 'abridged' | 'full';
  missing: string[];
  blocksInputClaim: boolean;
};

export type VatReconLine = {
  code: string;
  name: string;
  role: 'output' | 'input' | 'other';
  accountType: string;
  ledgerMovement: number;
  returnAmount: number | null;
  difference: number | null;
  flagged: boolean;
  includedInControl: boolean;
  note: string;
};

export type Vat201Report = {
  companyName: string;
  settings: VatVendorSettings;
  period: VatPeriod;
  today: string;
  status: VatReturnStatus;
  fields: Vat201Field[];
  totals: {
    outputTax: number;
    inputTax: number;
    payable: number;
    refundable: number;
  };
  outputListing: VatListingRow[];
  inputListing: VatListingRow[];
  missingTaxInvoices: VatInvoiceGap[];
  reconciliation: VatReconLine[];
  reconFlagged: boolean;
  basisNote: string;
  reminder: { show: boolean; tone: 'info' | 'due' | 'overdue'; text: string };
};

const FIELD_META: Array<{
  code: string;
  label: string;
  hint: string;
  section: Vat201Field['section'];
}> = [
  { code: '1', label: 'Standard rate (excluding capital goods and/or services and accommodation)', hint: 'VAT-inclusive consideration', section: 'output' },
  { code: '1A', label: 'Standard rate (only capital goods and/or services)', hint: 'VAT-inclusive consideration', section: 'output' },
  { code: '2', label: 'Zero rate (excluding goods exported)', hint: 'Consideration', section: 'output' },
  { code: '2A', label: 'Zero rate (only exported goods)', hint: 'Consideration. Customs code is required on eFiling when this is not zero.', section: 'output' },
  { code: '3', label: 'Exempt and non-supplies', hint: 'Consideration. No output tax.', section: 'output' },
  { code: '4', label: 'Output tax on field 1', hint: 'Field 1 × 15/115. eFiling calculates this.', section: 'output' },
  { code: '4A', label: 'Output tax on field 1A', hint: 'Field 1A × 15/115. eFiling calculates this.', section: 'output' },
  { code: '5', label: 'Supply of accommodation exceeding 28 days', hint: 'VAT-exclusive consideration', section: 'output' },
  { code: '6', label: 'Commercial accommodation (60% of field 5)', hint: 'Field 5 × 60%. eFiling calculates this.', section: 'output' },
  { code: '7', label: 'Accommodation not exceeding 28 days', hint: 'VAT-exclusive consideration', section: 'output' },
  { code: '8', label: 'Total accommodation value', hint: 'Field 6 + field 7. eFiling calculates this.', section: 'output' },
  { code: '9', label: 'Output tax on accommodation', hint: 'Field 8 × 15%. eFiling calculates this.', section: 'output' },
  { code: '10', label: 'Change in use and export of second-hand goods', hint: 'VAT-inclusive consideration', section: 'output' },
  { code: '11', label: 'Output tax on field 10', hint: 'Field 10 × 15/115. eFiling calculates this.', section: 'output' },
  { code: '12', label: 'Other and imported services', hint: 'VAT amount only', section: 'output' },
  { code: '13', label: 'Total output tax', hint: 'Fields 4 + 4A + 9 + 11 + 12', section: 'output' },
  { code: '14', label: 'Capital goods and/or services supplied to you', hint: 'VAT amount. A valid tax invoice is required.', section: 'input' },
  { code: '14A', label: 'Capital goods imported by you', hint: 'VAT amount. Customs code is required on eFiling.', section: 'input' },
  { code: '15', label: 'Other goods and/or services supplied to you (not capital goods)', hint: 'VAT amount. A valid tax invoice is required.', section: 'input' },
  { code: '15A', label: 'Other goods imported by you (not capital goods)', hint: 'VAT amount. Customs code is required on eFiling.', section: 'input' },
  { code: '16', label: 'Change in use', hint: 'VAT amount now applied for taxable purposes', section: 'input' },
  { code: '17', label: 'Bad debts', hint: 'VAT amount. Invoice basis only.', section: 'input' },
  { code: '18', label: 'Other', hint: 'Credit notes issued, debit notes received, and accounting-basis adjustments', section: 'input' },
  { code: '19', label: 'Total input tax', hint: 'Fields 14 + 14A + 15 + 15A + 16 + 17 + 18', section: 'input' },
  { code: '20', label: 'VAT payable / refundable', hint: 'Field 13 − field 19. A minus amount is a refund.', section: 'result' },
  { code: '21', label: 'Diesel — on land — total purchases (litres)', hint: 'Leave blank unless a diesel refund is registered.', section: 'diesel' },
  { code: '22', label: 'Diesel — on land — non-eligible purchases (litres)', hint: 'Leave blank unless a diesel refund is registered.', section: 'diesel' },
  { code: '23', label: 'Diesel — on land — eligible purchases (litres)', hint: 'Leave blank unless a diesel refund is registered.', section: 'diesel' },
  { code: '24', label: 'Diesel — on land — claimable litres', hint: 'Leave blank unless a diesel refund is registered.', section: 'diesel' },
  { code: '25', label: 'Diesel — on land — total', hint: 'Leave blank unless a diesel refund is registered.', section: 'diesel' },
  { code: '26', label: 'Diesel — offshore — total purchases (litres)', hint: 'Leave blank unless a diesel refund is registered.', section: 'diesel' },
  { code: '27', label: 'Diesel — offshore — non-eligible purchases (litres)', hint: 'Leave blank unless a diesel refund is registered.', section: 'diesel' },
  { code: '28', label: 'Diesel — offshore — eligible purchases (litres)', hint: 'Leave blank unless a diesel refund is registered.', section: 'diesel' },
  { code: '29', label: 'Diesel — offshore — total', hint: 'Leave blank unless a diesel refund is registered.', section: 'diesel' },
  { code: '30', label: 'Diesel — rail and harbour — total purchases (litres)', hint: 'Leave blank unless a diesel refund is registered.', section: 'diesel' },
  { code: '31', label: 'Diesel — rail and harbour — non-eligible purchases (litres)', hint: 'Leave blank unless a diesel refund is registered.', section: 'diesel' },
  { code: '32', label: 'Diesel — rail and harbour — eligible purchases (litres)', hint: 'Leave blank unless a diesel refund is registered.', section: 'diesel' },
  { code: '33', label: 'Diesel — rail and harbour — total', hint: 'Leave blank unless a diesel refund is registered.', section: 'diesel' },
  { code: '34', label: 'Diesel — peak power plant — total purchases (litres)', hint: 'Leave blank unless a diesel refund is registered.', section: 'diesel' },
  { code: '35', label: 'Diesel — peak power plant — non-eligible purchases (litres)', hint: 'Leave blank unless a diesel refund is registered.', section: 'diesel' },
  { code: '36', label: 'Diesel — peak power plant — eligible purchases (litres)', hint: 'Leave blank unless a diesel refund is registered.', section: 'diesel' },
  { code: '37', label: 'Diesel — peak power plant — total', hint: 'Leave blank unless a diesel refund is registered.', section: 'diesel' },
  { code: '38', label: 'Total after diesel', hint: 'Equals field 20 when no diesel refund is claimed.', section: 'result' },
];

export function ymd(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function parseYmd(value: string): { y: number; m: number; d: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || '').slice(0, 10));
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  return { y, m, d };
}

export function lastDayOfMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function addMonthsEnd(value: string, months: number): string {
  const parsed = parseYmd(value);
  if (!parsed) return value;
  const index = parsed.y * 12 + (parsed.m - 1) + months;
  const y = Math.floor(index / 12);
  const m = (index % 12) + 1;
  return ymd(y, m, lastDayOfMonth(y, m));
}

export function addDays(value: string, days: number): string {
  const parsed = parseYmd(value);
  if (!parsed) return value;
  const next = new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d) + days * 86400000);
  return ymd(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate());
}

export function todayInJohannesburg(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Johannesburg',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

function weekday(year: number, month: number, day: number): number {
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

/** Anonymous Gregorian algorithm. Month is 1–12. */
export function easterSunday(year: number): { y: number; m: number; d: number } {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return { y: year, m: month, d: day };
}

function holidayKey(year: number, month: number, day: number): string {
  return ymd(year, month, day);
}

/** SA public holidays, including the Monday observed when the day falls on a Sunday. */
export function saPublicHolidays(year: number): Set<string> {
  const fixed = [
    [1, 1],
    [3, 21],
    [4, 27],
    [5, 1],
    [6, 16],
    [8, 9],
    [9, 24],
    [12, 16],
    [12, 25],
    [12, 26],
  ];
  const days = new Set<string>();
  const add = (month: number, day: number) => {
    days.add(holidayKey(year, month, day));
    if (weekday(year, month, day) === 0) {
      const observed = addDays(ymd(year, month, day), 1);
      days.add(observed);
    }
  };
  for (const [month, day] of fixed) add(month, day);
  const easter = easterSunday(year);
  const goodFriday = addDays(ymd(easter.y, easter.m, easter.d), -2);
  const familyDay = addDays(ymd(easter.y, easter.m, easter.d), 1);
  days.add(goodFriday);
  days.add(familyDay);
  return days;
}

export function isBusinessDay(value: string): boolean {
  const parsed = parseYmd(value);
  if (!parsed) return false;
  const dow = weekday(parsed.y, parsed.m, parsed.d);
  if (dow === 0 || dow === 6) return false;
  return !saPublicHolidays(parsed.y).has(value);
}

export function precedingBusinessDay(value: string): string {
  let cursor = value;
  for (let i = 0; i < 14 && !isBusinessDay(cursor); i += 1) cursor = addDays(cursor, -1);
  return cursor;
}

/**
 * Manual filers: the 25th, or the business day before it.
 * eFiling: the last business day of the month after the period ends.
 * https://www.sars.gov.za/types-of-tax/value-added-tax/obligations-of-a-vat-vendor/
 */
export function vatDueDate(periodEnd: string, channel: VatFilingChannel): string {
  const parsed = parseYmd(periodEnd);
  if (!parsed) return periodEnd;
  const month = parsed.m === 12 ? 1 : parsed.m + 1;
  const year = parsed.m === 12 ? parsed.y + 1 : parsed.y;
  if (channel === 'manual') return precedingBusinessDay(ymd(year, month, 25));
  return precedingBusinessDay(ymd(year, month, lastDayOfMonth(year, month)));
}

export function categoryStep(category: VatPeriodCategory): number {
  if (category === 'A') return 1;
  if (category === 'D') return 6;
  if (category === 'E') return 12;
  return 2;
}

export function categoryAllowsEnd(category: VatPeriodCategory, periodEnd: string): boolean {
  const parsed = parseYmd(periodEnd);
  if (!parsed) return false;
  if (parsed.d !== lastDayOfMonth(parsed.y, parsed.m)) return false;
  if (category === 'B') return parsed.m % 2 === 0;
  if (category === 'C') return parsed.m % 2 === 1;
  return true;
}

export function categoryLabel(category: VatPeriodCategory): string {
  switch (category) {
    case 'A':
      return 'Category A · monthly';
    case 'B':
      return 'Category B · two months ending Feb, Apr, Jun, Aug, Oct, Dec';
    case 'C':
      return 'Category C · two months ending Jan, Mar, May, Jul, Sep, Nov';
    case 'D':
      return 'Category D · six months';
    case 'E':
      return 'Category E · annual';
    default:
      return category;
  }
}

export function basisLabel(basis: VatBasis): string {
  if (basis === 'payment') return 'Payment basis';
  if (basis === 'hybrid') return 'Hybrid basis';
  return 'Invoice basis';
}

function periodLabel(start: string, end: string): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const a = parseYmd(start);
  const b = parseYmd(end);
  if (!a || !b) return `${start} – ${end}`;
  const left = `${months[a.m - 1]} ${a.y}`;
  const right = `${months[b.m - 1]} ${b.y}`;
  return left === right ? left : `${left} – ${right}`;
}

export function vatPeriods(settings: VatVendorSettings, today: string): VatPeriod[] {
  if (!categoryAllowsEnd(settings.category, settings.firstPeriodEnd)) return [];
  const step = categoryStep(settings.category);
  const ends = new Set<string>();
  let cursor = settings.firstPeriodEnd;
  for (let i = 0; i < 36; i += 1) {
    ends.add(cursor);
    const prev = addMonthsEnd(cursor, -step);
    if (prev >= cursor) break;
    if (settings.effectiveFrom && prev < addMonthsEnd(settings.effectiveFrom, -step)) break;
    cursor = prev;
  }
  cursor = settings.firstPeriodEnd;
  const horizon = addMonthsEnd(today.slice(0, 10) || settings.firstPeriodEnd, step * 2);
  for (let i = 0; i < 36; i += 1) {
    cursor = addMonthsEnd(cursor, step);
    ends.add(cursor);
    if (cursor >= horizon) break;
  }
  const ordered = [...ends].sort();
  const periods: VatPeriod[] = [];
  for (let i = 0; i < ordered.length; i += 1) {
    const end = ordered[i];
    const prev = i === 0 ? addMonthsEnd(end, -step) : ordered[i - 1];
    let start = addDays(prev, 1);
    if (settings.effectiveFrom && start < settings.effectiveFrom && end >= settings.effectiveFrom) {
      start = settings.effectiveFrom;
    }
    if (settings.effectiveFrom && end < settings.effectiveFrom) continue;
    if (start > end) continue;
    periods.push({
      start,
      end,
      label: periodLabel(start, end),
      dueOn: vatDueDate(end, settings.filingChannel),
    });
  }
  return periods;
}

export function periodByEnd(periods: VatPeriod[], end: string): VatPeriod | null {
  return periods.find((period) => period.end === end.slice(0, 10)) || null;
}

export function currentOpenPeriod(periods: VatPeriod[], today: string): VatPeriod | null {
  const day = today.slice(0, 10);
  const open = periods.filter((period) => period.end >= day || period.dueOn >= day);
  return open[0] || periods[periods.length - 1] || null;
}

export function normaliseVatNumber(value: string | null | undefined): string {
  return String(value || '').replace(/\s+/g, '');
}

export function vatNumberError(value: string): string | null {
  const vat = normaliseVatNumber(value);
  if (!vat) return 'Enter the VAT number.';
  if (!/^4\d{9}$/.test(vat)) return 'A SARS VAT number is 10 digits and starts with 4.';
  return null;
}

export function defaultVatSettings(
  profileId: number,
  profile?: { vat_number?: string | null }
): VatVendorSettings {
  const vatNumber = normaliseVatNumber(profile?.vat_number);
  if (profileId === 102) {
    return {
      vatNumber: vatNumber || '4280321847',
      basis: 'payment',
      category: 'B',
      effectiveFrom: '2025-05-29',
      firstPeriodEnd: '2025-06-30',
      filingChannel: 'efiling',
    };
  }
  return {
    vatNumber,
    basis: 'invoice',
    category: 'B',
    effectiveFrom: '',
    firstPeriodEnd: '',
    filingChannel: 'efiling',
  };
}

/**
 * Same sign as statement-figures `signedStatementAmount` for asset and liability.
 * Asset / expense: debit − credit. Liability / equity / revenue: credit − debit.
 */
export function signedControlMovement(
  accountType: string | null | undefined,
  debit: number,
  credit: number
): number {
  const type = String(accountType || '').toLowerCase();
  if (type === 'asset' || type === 'expense' || type === 'expenses' || type === 'cogs') {
    return round2(debit - credit);
  }
  return round2(credit - debit);
}

export function accountIsVatControl(account: {
  code?: string | null;
  name?: string | null;
  subtype?: string | null;
}): boolean {
  const code = String(account.code || '');
  if (code === '1150' || code === '2120') return true;
  const name = String(account.name || '').toLowerCase();
  const subtype = String(account.subtype || '').toLowerCase();
  if (code === '2130' || code === '2140' || code === '2125') {
    return subtype === 'tax' || /\bvat\b/.test(name);
  }
  return subtype === 'tax' || /\bvat\b/.test(name);
}

function inPeriod(date: string, period: { start: string; end: string }): boolean {
  const day = date.slice(0, 10);
  return day >= period.start && day <= period.end;
}

function usesCash(basis: VatBasis, side: VatSide): boolean {
  if (basis === 'payment') return true;
  if (basis === 'hybrid') return side === 'input';
  return false;
}

export type VatSlice = {
  date: string;
  exclusive: number;
  vat: number;
  inclusive: number;
  fraction: number;
};

/** Split a document across cash dates, or keep it on the document date. */
export function allocateDocument(doc: VatDocument, basis: VatBasis): VatSlice[] {
  if (!usesCash(basis, doc.side)) {
    return [
      {
        date: doc.documentDate.slice(0, 10),
        exclusive: round2(doc.exclusive),
        vat: round2(doc.vat),
        inclusive: round2(doc.inclusive),
        fraction: 1,
      },
    ];
  }
  const denom =
    Math.abs(doc.inclusive) >= 0.005 ? Math.abs(doc.inclusive) : Math.abs(doc.exclusive);
  if (denom < 0.005) return [];
  const events = [...doc.cash]
    .map((event) => ({ date: event.date.slice(0, 10), amount: Math.abs(Number(event.amount || 0)) }))
    .filter((event) => event.date && event.amount >= 0.005)
    .sort((a, b) => a.date.localeCompare(b.date) || a.amount - b.amount);
  let remaining = denom;
  const raw: VatSlice[] = [];
  for (const event of events) {
    if (remaining < 0.005) break;
    const take = Math.min(event.amount, remaining);
    const fraction = take / denom;
    remaining = round2(remaining - take);
    raw.push({
      date: event.date,
      fraction,
      exclusive: doc.exclusive * fraction,
      vat: doc.vat * fraction,
      inclusive: doc.inclusive * fraction,
    });
  }
  if (!raw.length) return [];
  const slices = raw.map((slice) => ({
    ...slice,
    exclusive: round2(slice.exclusive),
    vat: round2(slice.vat),
    inclusive: round2(slice.inclusive),
  }));
  const allocated = raw.reduce((sum, slice) => sum + slice.fraction, 0);
  const targetVat = round2(doc.vat * allocated);
  const targetEx = round2(doc.exclusive * allocated);
  const targetInc = round2(doc.inclusive * allocated);
  const last = slices[slices.length - 1];
  last.vat = round2(last.vat + (targetVat - slices.reduce((sum, slice) => sum + slice.vat, 0)));
  last.exclusive = round2(
    last.exclusive + (targetEx - slices.reduce((sum, slice) => sum + slice.exclusive, 0))
  );
  last.inclusive = round2(
    last.inclusive + (targetInc - slices.reduce((sum, slice) => sum + slice.inclusive, 0))
  );
  return slices;
}

const FACT_LABELS: Array<[keyof TaxInvoiceFacts, string]> = [
  ['labelled', 'the words “tax invoice”'],
  ['supplierName', 'supplier name'],
  ['supplierAddress', 'supplier address'],
  ['supplierVat', 'supplier VAT number'],
  ['recipientName', 'recipient name'],
  ['recipientAddress', 'recipient address'],
  ['recipientVat', 'recipient VAT number'],
  ['serial', 'invoice number'],
  ['date', 'issue date'],
  ['description', 'description of the goods or services'],
  ['quantity', 'quantity or volume'],
  ['consideration', 'consideration'],
  ['vatShown', 'VAT amount, or a statement that VAT is included and the rate'],
];

const ABRIDGED_SKIP = new Set<keyof TaxInvoiceFacts>([
  'recipientName',
  'recipientAddress',
  'recipientVat',
  'quantity',
]);

export function taxInvoiceThreshold(inclusive: number, kind: VatSupplyKind): 'not_required' | 'abridged' | 'full' {
  const amount = Math.abs(inclusive);
  const zeroRated = kind === 'zero_rated' || kind === 'zero_rated_export';
  if (zeroRated || amount >= TAX_INVOICE_FULL_FROM) return 'full';
  if (amount <= TAX_INVOICE_NOT_REQUIRED_TO) return 'not_required';
  return 'abridged';
}

export function missingTaxInvoiceParticulars(doc: VatDocument): {
  threshold: 'not_required' | 'abridged' | 'full';
  missing: string[];
} {
  const threshold = taxInvoiceThreshold(doc.inclusive, doc.kind);
  if (threshold === 'not_required') return { threshold, missing: [] };
  if (doc.kind === 'imported_capital' || doc.kind === 'imported_other') {
    return {
      threshold: 'full',
      missing: doc.facts.customsCode ? [] : ['customs code, bill of entry and proof of VAT paid'],
    };
  }
  const missing: string[] = [];
  for (const [key, label] of FACT_LABELS) {
    if (threshold === 'abridged' && ABRIDGED_SKIP.has(key)) continue;
    if (!doc.facts[key]) missing.push(label);
  }
  return { threshold, missing };
}

function blocksClaim(doc: VatDocument, missing: string[]): boolean {
  if (doc.side !== 'input' || !missing.length) return false;
  return (
    doc.kind === 'standard' ||
    doc.kind === 'standard_capital' ||
    doc.kind === 'imported_capital' ||
    doc.kind === 'imported_other'
  );
}

function copyAmount(value: number): string {
  return round2(value).toFixed(2);
}

function fieldMap(values: Record<string, number>): Vat201Field[] {
  return FIELD_META.map((meta) => {
    const value = round2(values[meta.code] || 0);
    return { ...meta, value, copy: copyAmount(value) };
  });
}

export function reminderFor(period: VatPeriod, status: VatReturnStatus, today: string): Vat201Report['reminder'] {
  if (status === 'submitted' || status === 'paid') {
    return {
      show: true,
      tone: 'info',
      text: `This VAT201 is ${status}. The due date was ${period.dueOn}.`,
    };
  }
  const overdue = today > period.dueOn;
  const soon = today >= addDays(period.dueOn, -21);
  if (overdue) {
    return {
      show: true,
      tone: 'overdue',
      text: `VAT201 for ${period.label} was due on ${period.dueOn}. It is still ${status}.`,
    };
  }
  if (soon || today >= period.end) {
    return {
      show: true,
      tone: 'due',
      text: `VAT201 for ${period.label} is due on ${period.dueOn}. Status: ${status}.`,
    };
  }
  return {
    show: true,
    tone: 'info',
    text: `VAT201 for ${period.label} is due on ${period.dueOn}.`,
  };
}

export function buildVat201Pack(input: {
  companyName: string;
  settings: VatVendorSettings;
  period: VatPeriod;
  documents: VatDocument[];
  accounts: VatAccountSnap[];
  ledgerRows: VatLedgerRow[];
  today: string;
  status?: VatReturnStatus;
}): Vat201Report {
  const values: Record<string, number> = {};
  const outputListing: VatListingRow[] = [];
  const inputListing: VatListingRow[] = [];
  const missingTaxInvoices: VatInvoiceGap[] = [];
  const seenGaps = new Set<string>();

  for (const doc of input.documents) {
    const gap = missingTaxInvoiceParticulars(doc);
    const blocked = blocksClaim(doc, gap.missing);
    const badDebtBlocked = doc.side === 'input' && doc.kind === 'bad_debt' && input.settings.basis !== 'invoice';
    if (gap.missing.length && gap.threshold !== 'not_required' && !seenGaps.has(doc.id)) {
      seenGaps.add(doc.id);
      missingTaxInvoices.push({
        id: doc.id,
        side: doc.side,
        reference: doc.reference,
        counterparty: doc.counterparty,
        date: doc.documentDate,
        inclusive: round2(doc.inclusive),
        threshold: gap.threshold,
        missing: gap.missing,
        blocksInputClaim: blocked,
      });
    }
    const slices = allocateDocument(doc, input.settings.basis).filter((slice) =>
      inPeriod(slice.date, input.period)
    );
    if (
      !slices.length &&
      usesCash(input.settings.basis, doc.side) &&
      inPeriod(doc.documentDate, input.period) &&
      Math.abs(doc.vat) >= 0.005
    ) {
      const row: VatListingRow = {
        id: `${doc.id}:unpaid`,
        side: doc.side,
        cashDate: '—',
        documentDate: doc.documentDate,
        reference: doc.reference,
        counterparty: doc.counterparty,
        kind: doc.kind,
        exclusive: round2(doc.exclusive),
        vat: round2(doc.vat),
        inclusive: round2(doc.inclusive),
        claimed: false,
        blockedReason: 'Not in this return. VAT follows the cash date, and no cash was received or paid in this period.',
      };
      if (doc.side === 'output') outputListing.push(row);
      else inputListing.push(row);
    }
    for (const slice of slices) {
      const claimed = !(doc.side === 'input' && blocked) && !badDebtBlocked;
      const row: VatListingRow = {
        id: `${doc.id}:${slice.date}`,
        side: doc.side,
        cashDate: slice.date,
        documentDate: doc.documentDate,
        reference: doc.reference,
        counterparty: doc.counterparty,
        kind: doc.kind,
        exclusive: slice.exclusive,
        vat: slice.vat,
        inclusive: slice.inclusive,
        claimed,
        blockedReason: claimed
          ? null
          : badDebtBlocked
            ? 'Bad debts are claimed in field 17 only on the invoice basis.'
            : `Input tax held back. Missing ${gap.missing.join(', ')}.`,
      };
      if (doc.side === 'output') outputListing.push(row);
      else inputListing.push(row);
      if (!claimed) continue;
      addSlice(values, doc, slice, input.settings.basis);
    }
  }

  const f1 = values['1'] || 0;
  const f1a = values['1A'] || 0;
  const f5 = values['5'] || 0;
  const f7 = values['7'] || 0;
  const f10 = values['10'] || 0;
  values['4'] = round2((f1 * ZA_VAT_RATE) / (100 + ZA_VAT_RATE));
  values['4A'] = round2((f1a * ZA_VAT_RATE) / (100 + ZA_VAT_RATE));
  values['6'] = round2(f5 * 0.6);
  values['8'] = round2((values['6'] || 0) + f7);
  values['9'] = round2(((values['8'] || 0) * ZA_VAT_RATE) / 100);
  values['11'] = round2((f10 * ZA_VAT_RATE) / (100 + ZA_VAT_RATE));
  values['13'] = round2(
    (values['4'] || 0) +
      (values['4A'] || 0) +
      (values['9'] || 0) +
      (values['11'] || 0) +
      (values['12'] || 0)
  );
  values['19'] = round2(
    (values['14'] || 0) +
      (values['14A'] || 0) +
      (values['15'] || 0) +
      (values['15A'] || 0) +
      (values['16'] || 0) +
      (values['17'] || 0) +
      (values['18'] || 0)
  );
  values['20'] = round2((values['13'] || 0) - (values['19'] || 0));
  values['38'] = values['20'];

  const fields = fieldMap(values);
  const payable = Math.max(values['20'] || 0, 0);
  const refundable = Math.max(-(values['20'] || 0), 0);
  const reconciliation = reconcileControls({
    accounts: input.accounts,
    ledgerRows: input.ledgerRows,
    outputTax: values['13'] || 0,
    inputTax: values['19'] || 0,
    basis: input.settings.basis,
  });
  const status = input.status || 'draft';
  return {
    companyName: input.companyName,
    settings: input.settings,
    period: input.period,
    today: input.today,
    status,
    fields,
    totals: {
      outputTax: values['13'] || 0,
      inputTax: values['19'] || 0,
      payable: round2(payable),
      refundable: round2(refundable),
    },
    outputListing,
    inputListing,
    missingTaxInvoices,
    reconciliation,
    reconFlagged: reconciliation.some((line) => line.flagged && line.includedInControl),
    basisNote: basisNote(input.settings.basis),
    reminder: reminderFor(input.period, status, input.today),
  };
}

function addSlice(
  values: Record<string, number>,
  doc: VatDocument,
  slice: VatSlice,
  basis: VatBasis
): void {
  const add = (code: string, amount: number) => {
    values[code] = round2((values[code] || 0) + amount);
  };
  if (doc.side === 'output') {
    switch (doc.kind) {
      case 'standard_capital':
        add('1A', slice.inclusive);
        break;
      case 'zero_rated_export':
        add('2A', slice.inclusive || slice.exclusive);
        break;
      case 'zero_rated':
        add('2', slice.inclusive || slice.exclusive);
        break;
      case 'exempt':
        add('3', slice.inclusive || slice.exclusive);
        break;
      case 'accommodation_over_28':
        add('5', slice.exclusive);
        break;
      case 'accommodation_under_28':
        add('7', slice.exclusive);
        break;
      case 'change_in_use_output':
        add('10', slice.inclusive);
        break;
      case 'other_output':
        add('12', slice.vat);
        break;
      case 'standard':
      default:
        add('1', slice.inclusive);
        break;
    }
    return;
  }
  switch (doc.kind) {
    case 'standard_capital':
      add('14', slice.vat);
      break;
    case 'imported_capital':
      add('14A', slice.vat);
      break;
    case 'imported_other':
      add('15A', slice.vat);
      break;
    case 'change_in_use_input':
      add('16', slice.vat);
      break;
    case 'bad_debt':
      if (basis === 'invoice') add('17', slice.vat);
      break;
    case 'other_input':
      add('18', slice.vat);
      break;
    case 'standard':
    default:
      add('15', slice.vat);
      break;
  }
}

function basisNote(basis: VatBasis): string {
  if (basis === 'payment') {
    return 'Payment basis: VAT is due or claimable when cash is received or paid. The ledger still posts output VAT on the invoice date and input VAT on the bill date, so this return will not match 1150 and 2120 until those invoices are paid.';
  }
  if (basis === 'hybrid') {
    return 'Hybrid basis: output VAT follows the invoice date and input VAT follows the cash date. Unpaid supplier bills stay out of input tax.';
  }
  return 'Invoice basis: output VAT follows the invoice date and input VAT follows the bill date, including amounts that are still unpaid.';
}

export function reconcileControls(input: {
  accounts: VatAccountSnap[];
  ledgerRows: VatLedgerRow[];
  outputTax: number;
  inputTax: number;
  basis: VatBasis;
}): VatReconLine[] {
  const byId = new Map(input.ledgerRows.map((row) => [Number(row.account_id), row]));
  const wanted = input.accounts.filter((account) => {
    const code = String(account.code || '');
    return code === '1150' || code === '2120' || code === '2130' || code === '2140' || accountIsVatControl(account);
  });
  const lines: VatReconLine[] = [];
  for (const account of wanted) {
    const row = byId.get(Number(account.id)) || { debit: 0, credit: 0, account_id: account.id };
    const movement =
      row.signed != null
        ? round2(row.signed)
        : signedControlMovement(account.account_type, Number(row.debit || 0), Number(row.credit || 0));
    const code = String(account.code || '');
    const primary = code === '1150' || code === '2120';
    const included = primary || accountIsVatControl(account);
    const role: VatReconLine['role'] = code === '2120' ? 'output' : code === '1150' ? 'input' : 'other';
    const returnAmount = code === '2120' ? input.outputTax : code === '1150' ? input.inputTax : null;
    const difference = returnAmount == null ? null : round2(returnAmount - movement);
    let flagged = difference != null && Math.abs(difference) >= 0.05;
    let note = '';
    if ((code === '2130' || code === '2140') && included && Math.abs(movement) >= 0.05) {
      flagged = true;
      note = 'Other VAT control has a movement this period and is not a VAT201 field.';
    } else if (code === '2130' || code === '2140') {
      note = included
        ? 'No movement. Included because the account name or subtype marks it as VAT.'
        : `Not added to the VAT control total. This chart names ${code} “${account.name}”. Rename it so the name contains VAT, or set the subtype to tax, if it is a VAT control.`;
    } else if (flagged && input.basis === 'payment') {
      note = 'Difference flagged. On the payment basis the return follows cash, while this account follows the invoice or bill date.';
    } else if (flagged && input.basis === 'hybrid' && code === '1150') {
      note = 'Difference flagged. Hybrid input VAT follows cash, while 1150 follows the bill date.';
    } else if (flagged) {
      note = 'Difference flagged. The VAT201 does not match this account for the tax period.';
    } else if (primary) {
      note = 'Agrees to the VAT201 for this tax period.';
    }
    lines.push({
      code,
      name: account.name,
      role,
      accountType: account.account_type,
      ledgerMovement: movement,
      returnAmount,
      difference,
      flagged: Boolean(flagged && (primary || included)),
      includedInControl: included && (primary || code === '2130' || code === '2140' || code === '2125'),
      note,
    });
  }
  const rank = (code: string) => (code === '2120' ? 0 : code === '1150' ? 1 : code === '2130' ? 2 : code === '2140' ? 3 : 4);
  lines.sort((a, b) => rank(a.code) - rank(b.code) || a.code.localeCompare(b.code));
  return lines;
}

export type SettlementLine = {
  accountCode: string;
  debit: number;
  credit: number;
  memo: string;
};

/**
 * One balanced journal: clear the return’s output and input VAT through 2125,
 * then pay or receive the net on the bank. 2125 nets to zero in this same entry.
 */
export function buildVatSettlementLines(input: {
  outputTax: number;
  inputTax: number;
}): { ok: true; lines: SettlementLine[]; bankAmount: number; payable: boolean } | { ok: false; error: string } {
  const outputTax = round2(Math.abs(input.outputTax));
  const inputTax = round2(Math.abs(input.inputTax));
  const net = round2(outputTax - inputTax);
  if (outputTax < 0.005 && inputTax < 0.005) {
    return { ok: false, error: 'This return has no VAT to settle.' };
  }
  const lines: SettlementLine[] = [];
  if (outputTax >= 0.005) {
    lines.push({ accountCode: '2120', debit: outputTax, credit: 0, memo: 'Clear output VAT on the VAT201' });
    lines.push({ accountCode: '2125', debit: 0, credit: outputTax, memo: 'VAT payable / receivable (SARS)' });
  }
  if (inputTax >= 0.005) {
    lines.push({ accountCode: '2125', debit: inputTax, credit: 0, memo: 'VAT payable / receivable (SARS)' });
    lines.push({ accountCode: '1150', debit: 0, credit: inputTax, memo: 'Clear input VAT on the VAT201' });
  }
  if (net >= 0.005) {
    lines.push({ accountCode: '2125', debit: net, credit: 0, memo: 'Pay SARS' });
    lines.push({ accountCode: '1110', debit: 0, credit: net, memo: 'VAT payment to SARS' });
  } else if (net <= -0.005) {
    const refund = round2(-net);
    lines.push({ accountCode: '1110', debit: refund, credit: 0, memo: 'VAT refund from SARS' });
    lines.push({ accountCode: '2125', debit: 0, credit: refund, memo: 'VAT refund' });
  }
  const debit = round2(lines.reduce((sum, line) => sum + line.debit, 0));
  const credit = round2(lines.reduce((sum, line) => sum + line.credit, 0));
  if (Math.abs(debit - credit) > 0.02) {
    return { ok: false, error: `Settlement journal does not balance (${debit} vs ${credit}).` };
  }
  return { ok: true, lines, bankAmount: round2(Math.abs(net)), payable: net >= 0 };
}

export function vat201ToCsv(report: Vat201Report): string {
  const rows: string[][] = [
    ['SupplierAdvisor® VAT201'],
    ['Company', report.companyName],
    ['VAT number', report.settings.vatNumber],
    ['Basis', report.settings.basis],
    ['Category', report.settings.category],
    ['Period', report.period.label],
    ['Period start', report.period.start],
    ['Period end', report.period.end],
    ['Due', report.period.dueOn],
    ['Status', report.status],
    [],
    ['Field', 'Label', 'Value'],
    ...report.fields.map((field) => [field.code, field.label, field.copy]),
    [],
    ['Output VAT listing'],
    ['Cash date', 'Document date', 'Reference', 'Counterparty', 'Kind', 'Exclusive', 'VAT', 'Inclusive'],
    ...report.outputListing.map((row) => [
      row.cashDate,
      row.documentDate,
      row.reference,
      row.counterparty,
      row.kind,
      row.exclusive.toFixed(2),
      row.vat.toFixed(2),
      row.inclusive.toFixed(2),
    ]),
    [],
    ['Input VAT listing'],
    ['Cash date', 'Document date', 'Reference', 'Counterparty', 'Kind', 'Exclusive', 'VAT', 'Inclusive', 'Claimed', 'Note'],
    ...report.inputListing.map((row) => [
      row.cashDate,
      row.documentDate,
      row.reference,
      row.counterparty,
      row.kind,
      row.exclusive.toFixed(2),
      row.vat.toFixed(2),
      row.inclusive.toFixed(2),
      row.claimed ? 'yes' : 'no',
      row.blockedReason || '',
    ]),
    [],
    ['Missing tax invoice'],
    ['Reference', 'Counterparty', 'Date', 'Inclusive', 'Threshold', 'Blocks input claim', 'Missing'],
    ...report.missingTaxInvoices.map((row) => [
      row.reference,
      row.counterparty,
      row.date,
      row.inclusive.toFixed(2),
      row.threshold,
      row.blocksInputClaim ? 'yes' : 'no',
      row.missing.join('; '),
    ]),
    [],
    ['Reconciliation'],
    ['Account', 'Name', 'Ledger movement', 'VAT201', 'Difference', 'Flagged', 'Note'],
    ...report.reconciliation.map((row) => [
      row.code,
      row.name,
      row.ledgerMovement.toFixed(2),
      row.returnAmount == null ? '' : row.returnAmount.toFixed(2),
      row.difference == null ? '' : row.difference.toFixed(2),
      row.flagged ? 'yes' : 'no',
      row.note,
    ]),
  ];
  return rows.map((row) => row.map(csvCell).join(',')).join('\n');
}

function csvCell(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export function fieldByCode(report: Vat201Report, code: string): Vat201Field | undefined {
  return report.fields.find((field) => field.code === code);
}
