/**
 * Bulk import of provincial school registry (xlsx / csv).
 * Safe for browser + server (xlsx loaded at call time).
 */
import type * as XLSXType from 'xlsx';

export type SchoolRegistryRow = {
  school_name: string;
  district?: string | null;
  cmc?: string | null;
  circuit?: string | null;
  quintile?: number | null;
  local_municipality?: string | null;
  municipality_ward?: string | null;
  level_label?: string | null;
  phase?: string | null;
  natemis?: string | null;
  emis_number?: string | null;
  nsnp_applic_enrol?: number | null;
  final_emis_enrol?: number | null;
  final_nsnp_approved_enrol?: number | null;
  enrolment_year?: string | null;
  province?: string | null;
  raw?: Record<string, string>;
};

export type RegistryParseResult = {
  rows: SchoolRegistryRow[];
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

const HEADER_ALIASES: Record<string, keyof SchoolRegistryRow | 'skip'> = {
  institution_name: 'school_name',
  school_name: 'school_name',
  name: 'school_name',
  school: 'school_name',
  institution: 'school_name',
  district: 'district',
  education_district: 'district',
  cmc: 'cmc',
  circuit_management_centre: 'cmc',
  circuit_management: 'cmc',
  circuit: 'circuit',
  circuit_name: 'circuit',
  quintile: 'quintile',
  q: 'quintile',
  local_municipality: 'local_municipality',
  municipality: 'local_municipality',
  local_muni: 'local_municipality',
  municipality_ward_number: 'municipality_ward',
  municipality_ward: 'municipality_ward',
  ward_number: 'municipality_ward',
  ward: 'municipality_ward',
  level: 'level_label',
  school_level: 'level_label',
  phase: 'phase',
  natemis: 'natemis',
  nat_emis: 'natemis',
  national_emis: 'natemis',
  emis: 'emis_number',
  emis_number: 'emis_number',
  emis_no: 'emis_number',
  nsnp_applic_enrol_26_27: 'nsnp_applic_enrol',
  nsnp_applic_enrol: 'nsnp_applic_enrol',
  nsnp_application_enrolment: 'nsnp_applic_enrol',
  nsnp_applic_enrolment: 'nsnp_applic_enrol',
  final_emis_enrol_2026: 'final_emis_enrol',
  final_emis_enrol: 'final_emis_enrol',
  final_emis_enrolment: 'final_emis_enrol',
  final_nsnp_approved_enrol_26_27: 'final_nsnp_approved_enrol',
  final_nsnp_approved_enrol: 'final_nsnp_approved_enrol',
  final_nsnp_approved_enrolment: 'final_nsnp_approved_enrol',
  nsnp_approved_enrol: 'final_nsnp_approved_enrol',
  province: 'province',
};

function resolveField(header: string): keyof SchoolRegistryRow | 'skip' | null {
  const n = normHeader(header);
  if (HEADER_ALIASES[n]) return HEADER_ALIASES[n];
  if (n.includes('institution') && n.includes('name')) return 'school_name';
  if (n === 'natemis' || (n.includes('nat') && n.includes('emis'))) return 'natemis';
  if (n.includes('nsnp') && n.includes('applic')) return 'nsnp_applic_enrol';
  if (n.includes('final') && n.includes('emis') && n.includes('enrol'))
    return 'final_emis_enrol';
  if (n.includes('final') && n.includes('nsnp') && n.includes('enrol'))
    return 'final_nsnp_approved_enrol';
  if (n.includes('local') && n.includes('municip')) return 'local_municipality';
  if (n.includes('ward')) return 'municipality_ward';
  if (n.includes('quintile')) return 'quintile';
  if (n.includes('circuit') && !n.includes('manage')) return 'circuit';
  if (n.includes('cmc') || (n.includes('circuit') && n.includes('manage')))
    return 'cmc';
  if (n.includes('district')) return 'district';
  if (n.includes('level') && !n.includes('enrol')) return 'level_label';
  if (n.includes('province')) return 'province';
  return null;
}

function parseIntLoose(v: unknown): number | null {
  if (v == null || v === '') return null;
  if (typeof v === 'number' && Number.isFinite(v)) return Math.round(v);
  const s = String(v).replace(/[, ]/g, '').trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n) : null;
}

function parseQuintile(v: unknown): number | null {
  const n = parseIntLoose(v);
  if (n == null) return null;
  if (n >= 1 && n <= 5) return n;
  return n;
}

function mapLevelToPhase(level: string | null | undefined): string | null {
  if (!level) return null;
  const s = level.toLowerCase();
  if (s.includes('primary') || s.includes('prim')) return 'primary';
  if (s.includes('secondary') || s.includes('sec') || s.includes('high'))
    return 'secondary';
  if (s.includes('combined') || s.includes('comp')) return 'combined';
  if (s.includes('special') || s.includes('lsen')) return 'special';
  if (s.includes('ecd') || s.includes('pre')) return 'primary';
  return null;
}

function cellStr(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'number' && Number.isFinite(v)) {
    if (Number.isInteger(v) && Math.abs(v) >= 1e10) return String(Math.round(v));
    return String(v);
  }
  return String(v).trim();
}

function gridToResult(
  grid: unknown[][],
  sheetName: string,
  provinceDefault?: string
): RegistryParseResult {
  if (!grid.length) {
    return {
      rows: [],
      headers: [],
      errors: [{ row: 0, message: 'Empty sheet' }],
      sheetName,
    };
  }

  let headerRowIdx = 0;
  for (let i = 0; i < Math.min(15, grid.length); i += 1) {
    const row = grid[i] || [];
    const joined = row.map((c) => normHeader(cellStr(c))).join(' ');
    if (
      joined.includes('institution') ||
      joined.includes('natemis') ||
      joined.includes('school_name') ||
      (joined.includes('district') && joined.includes('circuit'))
    ) {
      headerRowIdx = i;
      break;
    }
  }

  const headerCells = (grid[headerRowIdx] || []).map((c) => cellStr(c));
  const fieldByCol: Array<keyof SchoolRegistryRow | 'skip' | null> =
    headerCells.map((h) => resolveField(h));

  const rows: SchoolRegistryRow[] = [];
  const errors: Array<{ row: number; message: string }> = [];

  for (let r = headerRowIdx + 1; r < grid.length; r += 1) {
    const line = grid[r] || [];
    if (!line.some((c) => cellStr(c))) continue;

    const raw: Record<string, string> = {};
    const rec: Partial<SchoolRegistryRow> = {};
    for (let c = 0; c < headerCells.length; c += 1) {
      const field = fieldByCol[c];
      const val = cellStr(line[c]);
      if (headerCells[c]) raw[headerCells[c]] = val;
      if (!field || field === 'skip') continue;
      if (field === 'quintile') {
        rec.quintile = parseQuintile(val);
      } else if (
        field === 'nsnp_applic_enrol' ||
        field === 'final_emis_enrol' ||
        field === 'final_nsnp_approved_enrol'
      ) {
        rec[field] = parseIntLoose(val);
      } else {
        (rec as Record<string, unknown>)[field] = val || null;
      }
    }

    const school_name = String(rec.school_name || '').trim();
    if (!school_name) {
      errors.push({ row: r + 1, message: 'Missing institution / school name' });
      continue;
    }

    const natemis = rec.natemis
      ? String(rec.natemis).replace(/\.0$/, '')
      : null;
    const emis = rec.emis_number
      ? String(rec.emis_number).replace(/\.0$/, '')
      : natemis;

    rows.push({
      school_name,
      district: rec.district || null,
      cmc: rec.cmc || null,
      circuit: rec.circuit || null,
      quintile: rec.quintile ?? null,
      local_municipality: rec.local_municipality || null,
      municipality_ward: rec.municipality_ward
        ? String(rec.municipality_ward).replace(/\.0$/, '')
        : null,
      level_label: rec.level_label || null,
      phase: rec.phase || mapLevelToPhase(rec.level_label) || null,
      natemis,
      emis_number: emis,
      nsnp_applic_enrol: rec.nsnp_applic_enrol ?? null,
      final_emis_enrol: rec.final_emis_enrol ?? null,
      final_nsnp_approved_enrol: rec.final_nsnp_approved_enrol ?? null,
      enrolment_year: '2026-27',
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

export function parseSchoolRegistryBuffer(
  buf: ArrayBuffer | Buffer,
  opts?: { sheetName?: string; provinceDefault?: string }
): RegistryParseResult {
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
    if (!sheet) {
      return {
        rows: [],
        headers: [],
        errors: [{ row: 0, message: `Sheet “${sheetName}” not found` }],
        sheetName,
      };
    }
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

export function parseSchoolRegistryCsv(
  text: string,
  opts?: { provinceDefault?: string }
): RegistryParseResult {
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

/** Browser helper: parse File without uploading */
export async function parseSchoolRegistryFile(
  file: File,
  opts?: { provinceDefault?: string }
): Promise<RegistryParseResult> {
  const name = file.name.toLowerCase();
  const ab = await file.arrayBuffer();
  if (name.endsWith('.csv') || name.endsWith('.txt')) {
    const text = new TextDecoder('utf-8').decode(ab);
    return parseSchoolRegistryCsv(text, opts);
  }
  return parseSchoolRegistryBuffer(ab, opts);
}

/** Keep small: each batch must finish well under Vercel Hobby (~10s) / Pro limits. */
export const REGISTRY_BATCH_SIZE = 25;
