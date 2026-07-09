/**
 * GS1 barcode parsing foundations (EAN-13, UPC-A, GTIN, limited GS1-128 AI).
 * Best-in-class inventory systems normalize every scan to GTIN-14.
 */

export type Gs1ParseResult = {
  raw: string;
  symbology: 'ean13' | 'upca' | 'gtin14' | 'gs1-128' | 'code128' | 'qr' | 'unknown';
  gtin14?: string;
  gtin?: string;
  validChecksum?: boolean;
  lot?: string;
  serial?: string;
  expiry?: string; // YYYY-MM-DD
  bestBefore?: string;
  sscc?: string;
  quantity?: number;
  applicationIdentifiers: Record<string, string>;
  errors: string[];
};

function onlyDigits(s: string) {
  return s.replace(/\D/g, '');
}

/** GS1 mod-10 check digit for GTIN */
export function gtinCheckDigit(bodyWithoutCheck: string): number {
  const d = onlyDigits(bodyWithoutCheck);
  let sum = 0;
  const padded = d.padStart(13, '0').slice(-13);
  for (let i = 0; i < 13; i++) {
    const n = Number(padded[i]);
    // from right: odd positions *3
    const fromRight = 13 - i;
    sum += fromRight % 2 === 0 ? n : n * 3;
  }
  return (10 - (sum % 10)) % 10;
}

export function isValidGtin(gtin: string): boolean {
  const d = onlyDigits(gtin);
  if (![8, 12, 13, 14].includes(d.length)) return false;
  const body = d.slice(0, -1);
  const check = Number(d.slice(-1));
  // normalize body to 13 for check
  const body13 = body.padStart(13, '0').slice(-13);
  return gtinCheckDigit(body13.slice(0, 13)) === check || gtinCheckDigit(body) === check;
}

export function toGtin14(gtin: string): string | null {
  const d = onlyDigits(gtin);
  if (![8, 12, 13, 14].includes(d.length)) return null;
  if (!isValidGtin(d) && d.length !== 14) {
    // still pad for operational use
  }
  return d.padStart(14, '0').slice(-14);
}

/** Parse common GS1 Application Identifiers from GS1-128 / Digital Link-ish strings */
export function parseGs1AIs(raw: string): Record<string, string> {
  const ais: Record<string, string> = {};
  // FNC1 often as ]C1 or \x1d or as parentheses (01)...
  let s = raw.replace(/^\]C1/, '').replace(/\x1d/g, '|');

  // Parenthetical form: (01)09501101530003(10)ABC(17)250101
  const paren = /\((\d{2,4})\)([^()]+)/g;
  let m: RegExpExecArray | null;
  while ((m = paren.exec(s)) !== null) {
    ais[m[1]] = m[2].trim();
  }
  if (Object.keys(ais).length) return ais;

  // Concatenated fixed/variable AIs (simplified)
  s = s.replace(/\|/g, '');
  const fixedLens: Record<string, number> = {
    '00': 18,
    '01': 14,
    '02': 14,
    '11': 6,
    '13': 6,
    '15': 6,
    '17': 6,
    '310': 6,
    '310n': 6,
  };

  let i = 0;
  while (i < s.length - 1) {
    let ai = s.slice(i, i + 2);
    if (ai === '31' && s.length > i + 3) {
      // 310n weight
      ai = s.slice(i, i + 4);
      const val = s.slice(i + 4, i + 10);
      ais[ai] = val;
      i += 10;
      continue;
    }
    if (ai === '00' || ai === '01' || ai === '02') {
      const len = fixedLens[ai];
      ais[ai] = s.slice(i + 2, i + 2 + len);
      i += 2 + len;
      continue;
    }
    if (['11', '13', '15', '17'].includes(ai)) {
      ais[ai] = s.slice(i + 2, i + 8);
      i += 8;
      continue;
    }
    if (ai === '10' || ai === '21') {
      // variable until next AI or end — take rest or until known AI
      const rest = s.slice(i + 2);
      const next = rest.search(/(01|17|15|10|21|37)/);
      const val = next > 0 ? rest.slice(0, next) : rest;
      ais[ai] = val;
      i += 2 + val.length;
      continue;
    }
    i += 1;
  }
  return ais;
}

function yyMmDdToIso(yymmdd: string): string | undefined {
  const d = onlyDigits(yymmdd);
  if (d.length !== 6) return undefined;
  const yy = Number(d.slice(0, 2));
  const mm = d.slice(2, 4);
  const dd = d.slice(4, 6);
  const year = yy >= 70 ? 1900 + yy : 2000 + yy;
  return `${year}-${mm}-${dd === '00' ? '01' : dd}`;
}

export function parseBarcode(rawInput: string): Gs1ParseResult {
  const raw = (rawInput || '').trim();
  const errors: string[] = [];
  const digits = onlyDigits(raw);

  // Pure GTIN / EAN / UPC
  if (/^\d{8}$|^\d{12}$|^\d{13}$|^\d{14}$/.test(digits) && raw.replace(/\s/g, '') === digits) {
    const gtin14 = toGtin14(digits)!;
    const valid = isValidGtin(digits);
    if (!valid) errors.push('GTIN checksum failed');
    const symbology =
      digits.length === 12 ? 'upca' : digits.length === 13 ? 'ean13' : digits.length === 14 ? 'gtin14' : 'ean13';
    return {
      raw,
      symbology,
      gtin14,
      gtin: digits,
      validChecksum: valid,
      applicationIdentifiers: { '01': gtin14 },
      errors,
    };
  }

  // GS1 with AIs
  if (raw.includes('(01)') || raw.includes(']C1') || raw.startsWith('01') || raw.includes('\x1d')) {
    const ais = parseGs1AIs(raw);
    const gtin = ais['01'] || ais['02'];
    const gtin14 = gtin ? toGtin14(gtin) || undefined : undefined;
    return {
      raw,
      symbology: 'gs1-128',
      gtin14,
      gtin,
      validChecksum: gtin ? isValidGtin(gtin) : undefined,
      lot: ais['10'],
      serial: ais['21'],
      expiry: ais['17'] ? yyMmDdToIso(ais['17']) : undefined,
      bestBefore: ais['15'] ? yyMmDdToIso(ais['15']) : undefined,
      sscc: ais['00'],
      quantity: ais['37'] ? Number(ais['37']) : undefined,
      applicationIdentifiers: ais,
      errors,
    };
  }

  // QR product passport URL
  if (raw.includes('/p/') || raw.startsWith('http')) {
    const m = raw.match(/\/p\/([a-zA-Z0-9-]+)/);
    return {
      raw,
      symbology: 'qr',
      applicationIdentifiers: m ? { public_id: m[1] } : {},
      errors: m ? [] : ['Could not extract public product id from QR'],
    };
  }

  return {
    raw,
    symbology: 'unknown',
    applicationIdentifiers: {},
    errors: ['Unrecognized barcode format'],
  };
}

/** Minimal EDI 846 / 944-style inventory snapshot XML/JSON for partners */
export function buildEdiInventoryAdvice(params: {
  companyId: number;
  tradingPartner?: string;
  lines: Array<{
    sku?: string | null;
    gtin?: string | null;
    quantity: number;
    uom?: string | null;
    lot?: string | null;
    warehouse?: string | null;
  }>;
}) {
  const controlNumber = `SA${Date.now()}`;
  return {
    standard: 'X12',
    transactionSet: '846', // Inventory Inquiry/Advice
    controlNumber,
    sender: `SUPPLIERADVISOR-${params.companyId}`,
    receiver: params.tradingPartner || 'PARTNER',
    createdAt: new Date().toISOString(),
    lines: params.lines.map((l, i) => ({
      line: i + 1,
      sku: l.sku,
      gtin: l.gtin,
      qty: l.quantity,
      uom: l.uom || 'EA',
      lot: l.lot,
      warehouse: l.warehouse,
    })),
    // EDIFACT-ish text dump for download
    edifactPreview: [
      `UNA:+.? '`,
      `UNB+UNOC:3+SA${params.companyId}+${params.tradingPartner || 'PARTNER'}+${new Date()
        .toISOString()
        .slice(0, 10)
        .replace(/-/g, '')}:${new Date().toISOString().slice(11, 16).replace(':', '')}+${controlNumber}'`,
      `UNH+1+INVRPT:D:96A:UN'`,
      ...params.lines.map(
        (l, i) =>
          `LIN+${i + 1}++${l.gtin || l.sku || ''}:SA'QTY+33:${l.quantity}:${l.uom || 'PCE'}'`
      ),
      `UNT+${params.lines.length + 2}+1'`,
      `UNZ+1+${controlNumber}'`,
    ].join('\n'),
  };
}
