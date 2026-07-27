/**
 * Bulk import of provincial NSNP service providers (xlsx / csv).
 * Columns: District · Cluster allocation · Name of service provider · CSD number
 */
import type * as XLSXType from 'xlsx';

export type SpRegistryRow = {
  name: string;
  district?: string | null;
  cluster_allocation?: string | null;
  csd_number?: string | null;
  province?: string | null;
  raw?: Record<string, string>;
};

export type SpRegistryParseResult = {
  rows: SpRegistryRow[];
  headers: string[];
  errors: Array<{ row: number; message: string }>;
  sheetName: string;
};

function loadXlsx(): typeof XLSXType {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('xlsx') as typeof XLSXType;
}

function normHeader(h: string): string {
  return String(h || '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

function cellStr(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'number' && Number.isFinite(v)) {
    if (Number.isInteger(v) && Math.abs(v) >= 1e6) return String(Math.round(v));
    return String(v);
  }
  return String(v).trim();
}

function resolveField(
  header: string
): keyof SpRegistryRow | 'skip' | null {
  const n = normHeader(header);
  if (
    n === 'name_of_service_provider' ||
    n === 'service_provider' ||
    n === 'service_provider_name' ||
    n === 'sp_name' ||
    n === 'isp_name' ||
    n === 'supplier_name' ||
    n === 'name' ||
    n === 'trading_name' ||
    (n.includes('name') &&
      (n.includes('service') || n.includes('provider') || n.includes('sp')))
  ) {
    return 'name';
  }
  if (n === 'district' || n.includes('district')) return 'district';
  if (
    n === 'cluster_allocation' ||
    n === 'cluster' ||
    n.includes('cluster')
  ) {
    return 'cluster_allocation';
  }
  if (
    n === 'csd_number' ||
    n === 'csd' ||
    n === 'csd_no' ||
    n === 'csd_num' ||
    (n.includes('csd') && n.includes('number')) ||
    n === 'csd_number_'
  ) {
    return 'csd_number';
  }
  if (n === 'province' || n.includes('province')) return 'province';
  return null;
}

function gridToResult(
  grid: unknown[][],
  sheetName: string,
  provinceDefault?: string
): SpRegistryParseResult {
  if (!grid.length) {
    return {
      rows: [],
      headers: [],
      errors: [{ row: 0, message: 'Empty sheet' }],
      sheetName,
    };
  }

  let headerRowIdx = 0;
  for (let i = 0; i < Math.min(20, grid.length); i += 1) {
    const row = grid[i] || [];
    const joined = row.map((c) => normHeader(cellStr(c))).join(' ');
    if (
      joined.includes('csd') ||
      joined.includes('service_provider') ||
      (joined.includes('district') && joined.includes('cluster')) ||
      (joined.includes('district') && joined.includes('name'))
    ) {
      headerRowIdx = i;
      break;
    }
  }

  const headerCells = (grid[headerRowIdx] || []).map((c) => cellStr(c));
  const fieldByCol = headerCells.map((h) => resolveField(h));

  const rows: SpRegistryRow[] = [];
  const errors: Array<{ row: number; message: string }> = [];
  const seenCsd = new Set<string>();
  const seenName = new Set<string>();

  for (let r = headerRowIdx + 1; r < grid.length; r += 1) {
    const line = grid[r] || [];
    if (!line.some((c) => cellStr(c))) continue;

    const raw: Record<string, string> = {};
    const rec: Partial<SpRegistryRow> = {};
    for (let c = 0; c < headerCells.length; c += 1) {
      const field = fieldByCol[c];
      const val = cellStr(line[c]);
      if (headerCells[c]) raw[headerCells[c]] = val;
      if (!field || field === 'skip') continue;
      (rec as Record<string, unknown>)[field] = val || null;
    }

    const name = String(rec.name || '').trim();
    if (!name) {
      errors.push({
        row: r + 1,
        message: 'Missing service provider name',
      });
      continue;
    }

    let csd = rec.csd_number
      ? String(rec.csd_number).replace(/\.0$/, '').replace(/\s+/g, '').trim()
      : null;
    if (csd === '') csd = null;

    // Skip exact duplicate CSD in same file
    if (csd) {
      if (seenCsd.has(csd)) {
        errors.push({
          row: r + 1,
          message: `Duplicate CSD ${csd} in file (skipped)`,
        });
        continue;
      }
      seenCsd.add(csd);
    } else {
      const nk = `${name.toLowerCase()}|${String(rec.district || '').toLowerCase()}`;
      if (seenName.has(nk)) {
        errors.push({
          row: r + 1,
          message: `Duplicate name in file without CSD (skipped)`,
        });
        continue;
      }
      seenName.add(nk);
    }

    rows.push({
      name,
      district: rec.district ? String(rec.district).trim() : null,
      cluster_allocation: rec.cluster_allocation
        ? String(rec.cluster_allocation).trim()
        : null,
      csd_number: csd,
      province: rec.province || provinceDefault || null,
      raw,
    });
  }

  return {
    rows,
    headers: headerCells.filter(Boolean),
    errors,
    sheetName,
  };
}

export function parseSpRegistryBuffer(
  buf: ArrayBuffer | Buffer,
  opts?: { sheetName?: string; provinceDefault?: string }
): SpRegistryParseResult {
  try {
    const XLSX = loadXlsx();
    const wb = XLSX.read(buf, { type: 'buffer', cellDates: false });
    if (!wb.SheetNames?.length) {
      return {
        rows: [],
        headers: [],
        errors: [{ row: 0, message: 'Workbook has no sheets' }],
        sheetName: '',
      };
    }
    const sheetName =
      opts?.sheetName && wb.SheetNames.includes(opts.sheetName)
        ? opts.sheetName
        : wb.SheetNames[0];
    const sheet = wb.Sheets[sheetName];
    const grid = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      defval: '',
      raw: false,
    }) as unknown[][];
    return gridToResult(grid, sheetName, opts?.provinceDefault);
  } catch (e: unknown) {
    return {
      rows: [],
      headers: [],
      errors: [
        {
          row: 0,
          message:
            e instanceof Error
              ? `Spreadsheet parse failed: ${e.message}`
              : 'Spreadsheet parse failed',
        },
      ],
      sheetName: '',
    };
  }
}

export function parseSpRegistryCsv(
  text: string,
  opts?: { provinceDefault?: string }
): SpRegistryParseResult {
  try {
    const XLSX = loadXlsx();
    const wb = XLSX.read(text, { type: 'string' });
    const sheetName = wb.SheetNames[0] || 'csv';
    const sheet = wb.Sheets[sheetName];
    const grid = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      defval: '',
      raw: false,
    }) as unknown[][];
    return gridToResult(grid, sheetName, opts?.provinceDefault);
  } catch (e: unknown) {
    return {
      rows: [],
      headers: [],
      errors: [
        {
          row: 0,
          message:
            e instanceof Error
              ? `CSV parse failed: ${e.message}`
              : 'CSV parse failed',
        },
      ],
      sheetName: 'csv',
    };
  }
}

export async function parseSpRegistryFile(
  file: File,
  opts?: { provinceDefault?: string }
): Promise<SpRegistryParseResult> {
  const name = file.name.toLowerCase();
  const ab = await file.arrayBuffer();
  if (name.endsWith('.csv') || name.endsWith('.txt')) {
    const text = new TextDecoder('utf-8').decode(ab);
    return parseSpRegistryCsv(text, opts);
  }
  return parseSpRegistryBuffer(ab, opts);
}

/** Keep small under Vercel timeout. */
export const SP_REGISTRY_BATCH_SIZE = 25;

/** Canonical headers for the downloadable SP import template (must match parser). */
export const SP_REGISTRY_TEMPLATE_HEADERS = [
  'DISTRICT',
  'CLUSTER ALLOCATION',
  'NAME OF SERVICE PROVIDER',
  'CSD NUMBER',
] as const;

export type SpTemplateRow = {
  district?: string | null;
  cluster_allocation?: string | null;
  name: string;
  csd_number?: string | null;
};

/**
 * Build an .xlsx workbook buffer for the SP registry template.
 * Include example rows when `rows` is empty so users see the expected shape.
 */
export function buildSpRegistryTemplateXlsx(
  rows?: SpTemplateRow[],
  opts?: { includeExamples?: boolean; sheetName?: string }
): Buffer {
  const XLSX = loadXlsx();
  const headers = [...SP_REGISTRY_TEMPLATE_HEADERS];
  const dataRows: string[][] = [];

  if (rows?.length) {
    for (const r of rows) {
      dataRows.push([
        String(r.district || ''),
        String(r.cluster_allocation || ''),
        String(r.name || ''),
        String(r.csd_number || ''),
      ]);
    }
  } else if (opts?.includeExamples !== false) {
    dataRows.push(
      [
        'uMgungundlovu',
        'Cluster A',
        'Example Fresh Foods (Pty) Ltd',
        'MAAA0000000',
      ],
      [
        'eThekwini',
        'Cluster B',
        'Example School Meals CC',
        'MAAA0000001',
      ]
    );
  }

  const aoa: string[][] = [headers, ...dataRows];
  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // Comfortable column widths for Excel
  ws['!cols'] = [
    { wch: 22 },
    { wch: 20 },
    { wch: 40 },
    { wch: 16 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    wb,
    ws,
    opts?.sheetName || 'Service Providers'
  );

  // Instructions sheet
  const help = XLSX.utils.aoa_to_sheet([
    ['NSNP Service Provider import template'],
    [''],
    ['How to use'],
    ['1. Keep the header row on the "Service Providers" sheet exactly as provided.'],
    ['2. Fill DISTRICT, CLUSTER ALLOCATION, NAME OF SERVICE PROVIDER, CSD NUMBER.'],
    ['3. Delete the example rows before import (or leave them if you want test data).'],
    ['4. Save as .xlsx and upload on Schools → Import SPs.'],
    ['5. Import upserts by CSD NUMBER when present; name is required on every row.'],
    [''],
    ['Column', 'Required', 'Notes'],
    ['DISTRICT', 'Recommended', 'Education district the SP is allocated to'],
    ['CLUSTER ALLOCATION', 'Recommended', 'Cluster / allocation for NSNP supply'],
    ['NAME OF SERVICE PROVIDER', 'Yes', 'Legal or trading name'],
    ['CSD NUMBER', 'Recommended', 'Central Supplier Database number — used to update existing SPs'],
    [''],
    ['Optional: you may add a PROVINCE column; otherwise the province selected on the import page is used.'],
  ]);
  help['!cols'] = [{ wch: 28 }, { wch: 14 }, { wch: 56 }];
  XLSX.utils.book_append_sheet(wb, help, 'Instructions');

  const out = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  return Buffer.isBuffer(out) ? out : Buffer.from(out as ArrayBuffer);
}
