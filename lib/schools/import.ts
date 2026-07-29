/**
 * Excel-compatible import for learners & staff.
 * Template A = .xlsx workbook (preferred) + CSV fallback for Excel compatibility.
 */

import type * as XLSXType from 'xlsx';

export type ImportRowError = { row: number; message: string };

export type LearnerImportRow = {
  external_id?: string;
  first_name: string;
  last_name: string;
  date_of_birth?: string | null;
  grade?: string | null;
  class_name?: string | null;
  gender?: string | null;
  nsnp_eligible?: boolean;
  special_diet?: string | null;
  guardian_name?: string | null;
  guardian_phone?: string | null;
};

export type StaffImportRow = {
  external_id?: string;
  first_name: string;
  last_name: string;
  role?: string;
  email?: string | null;
  phone?: string | null;
  phase?: string | null;
};

/** Canonical Template A column keys (sheet header row). */
export const LEARNER_HEADERS = [
  'external_id',
  'first_name',
  'last_name',
  'date_of_birth',
  'grade',
  'class_name',
  'gender',
  'nsnp_eligible',
  'special_diet',
  'guardian_name',
  'guardian_phone',
] as const;

/** Human-friendly Excel headers for Template A (same order as LEARNER_HEADERS). */
export const LEARNER_TEMPLATE_A_HEADERS = [
  'EXTERNAL_ID',
  'FIRST_NAME',
  'LAST_NAME',
  'DATE_OF_BIRTH',
  'GRADE',
  'CLASS_NAME',
  'GENDER',
  'NSNP_ELIGIBLE',
  'SPECIAL_DIET',
  'GUARDIAN_NAME',
  'GUARDIAN_PHONE',
] as const;

const STAFF_HEADERS = [
  'external_id',
  'first_name',
  'last_name',
  'role',
  'email',
  'phone',
  'phase',
] as const;

export const LEARNER_XLSX_MIME =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

function loadXlsx(): typeof XLSXType {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('xlsx') as typeof XLSXType;
}

export function learnerTemplateCsv(): string {
  const header = LEARNER_TEMPLATE_A_HEADERS.join(',');
  const example =
    'L001,Thabo,Molefe,2014-03-12,4,4A,M,Y,,Nomsa Molefe,0820000000';
  const bom = '\uFEFF';
  return `${bom}${header}\n${example}\n`;
}

/**
 * Template A — NSNP Learners import workbook (.xlsx).
 * Sheet "Learners" + "Instructions" for school kitchen staff.
 */
export function buildLearnerTemplateAXlsx(opts?: {
  includeExamples?: boolean;
}): Uint8Array {
  const XLSX = loadXlsx();
  const headers = [...LEARNER_TEMPLATE_A_HEADERS];
  const dataRows: string[][] = [];
  if (opts?.includeExamples !== false) {
    dataRows.push(
      [
        'L001',
        'Thabo',
        'Molefe',
        '2014-03-12',
        '4',
        '4A',
        'M',
        'Y',
        '',
        'Nomsa Molefe',
        '0820000000',
      ],
      [
        'L002',
        'Aisha',
        'Naidoo',
        '2015-07-22',
        '3',
        '3B',
        'F',
        'Y',
        'Halal',
        'Priya Naidoo',
        '0831112222',
      ],
      [
        'L003',
        'Johan',
        'Botha',
        '2013-11-05',
        '5',
        '5A',
        'M',
        'N',
        '',
        '',
        '',
      ]
    );
  }
  const ws = XLSX.utils.aoa_to_sheet([headers, ...dataRows]);
  ws['!cols'] = [
    { wch: 14 },
    { wch: 14 },
    { wch: 14 },
    { wch: 14 },
    { wch: 8 },
    { wch: 10 },
    { wch: 8 },
    { wch: 14 },
    { wch: 14 },
    { wch: 16 },
    { wch: 14 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Learners');

  const help = XLSX.utils.aoa_to_sheet([
    ['NSNP Learners — Template A (import)'],
    [''],
    ['How to use'],
    ['1. Keep the header row on the "Learners" sheet exactly as provided.'],
    ['2. Fill one row per learner. FIRST_NAME and LAST_NAME are required.'],
    ['3. DATE_OF_BIRTH: use YYYY-MM-DD (Excel date cells are also accepted).'],
    ['4. NSNP_ELIGIBLE: Y / N (or Yes / No). Default Y if blank.'],
    ['5. Delete example rows before import (or leave them for a test load).'],
    ['6. Save as .xlsx and upload on School → Learners → Import Template A.'],
    ['7. After import, select learners and mark school-verified or attested.'],
    [''],
    ['Column', 'Required', 'Notes'],
    ['EXTERNAL_ID', 'Recommended', 'School / EMIS learner code — helps re-import'],
    ['FIRST_NAME', 'Yes', 'Learner first name'],
    ['LAST_NAME', 'Yes', 'Learner surname'],
    ['DATE_OF_BIRTH', 'No', 'YYYY-MM-DD'],
    ['GRADE', 'Recommended', 'e.g. R, 1–12'],
    ['CLASS_NAME', 'Recommended', 'e.g. 4A'],
    ['GENDER', 'No', 'M / F / Other'],
    ['NSNP_ELIGIBLE', 'Recommended', 'Y = eligible for NSNP meals'],
    ['SPECIAL_DIET', 'No', 'e.g. Halal, vegetarian, allergy notes'],
    ['GUARDIAN_NAME', 'No', 'Parent / guardian name'],
    ['GUARDIAN_PHONE', 'No', 'Contact number'],
    [''],
    ['Verification after import'],
    [
      'Imported learners start as draft. Use the Learners screen to mark school-verified (internal check) then attested (principal / coordinator attestation).',
    ],
  ]);
  help['!cols'] = [{ wch: 28 }, { wch: 14 }, { wch: 56 }];
  XLSX.utils.book_append_sheet(wb, help, 'Instructions');

  const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as
    | number[]
    | Uint8Array;
  return out instanceof Uint8Array ? out : new Uint8Array(out);
}

export function staffTemplateCsv(): string {
  const header = STAFF_HEADERS.join(',');
  const example =
    'T001,Sarah,Nkosi,teacher,sarah@school.edu.za,0821111111,primary';
  const bom = '\uFEFF';
  return `${bom}${header}\n${example}\n`;
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let cur: string[] = [];
  let cell = '';
  let inQuotes = false;
  const s = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < s.length; i += 1) {
    const ch = s[i];
    if (inQuotes) {
      if (ch === '"') {
        if (s[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',' || ch === '\t') {
      cur.push(cell.trim());
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && s[i + 1] === '\n') i += 1;
      cur.push(cell.trim());
      cell = '';
      if (cur.some((c) => c.length)) rows.push(cur);
      cur = [];
    } else {
      cell += ch;
    }
  }
  cur.push(cell.trim());
  if (cur.some((c) => c.length)) rows.push(cur);
  return rows;
}

function normHeader(h: string): string {
  return h
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

function yesNo(v: string | undefined): boolean {
  if (!v) return true;
  const s = v.toLowerCase();
  if (['n', 'no', 'false', '0'].includes(s)) return false;
  return true;
}

/** Normalise Excel serial dates or free-text DOB to YYYY-MM-DD when possible. */
function normalizeDob(raw: string): string | null {
  const v = String(raw || '').trim();
  if (!v) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);
  // Excel serial day number (as string from sheet_to_json raw)
  if (/^\d+(\.\d+)?$/.test(v)) {
    const n = Number(v);
    if (n > 20000 && n < 80000) {
      // Excel epoch 1899-12-30
      const utc = Math.round((n - 25569) * 86400 * 1000);
      const d = new Date(utc);
      if (!Number.isNaN(d.getTime())) {
        return d.toISOString().slice(0, 10);
      }
    }
  }
  // DD/MM/YYYY or DD-MM-YYYY common in SA
  const m = v.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if (m) {
    const dd = m[1].padStart(2, '0');
    const mm = m[2].padStart(2, '0');
    return `${m[3]}-${mm}-${dd}`;
  }
  return v;
}

export function parseLearnerGrid(grid: string[][]): {
  rows: LearnerImportRow[];
  errors: ImportRowError[];
} {
  if (grid.length < 2) {
    return {
      rows: [],
      errors: [{ row: 0, message: 'File empty or missing header' }],
    };
  }
  const headers = grid[0].map(normHeader);
  const idx = (name: string) => headers.indexOf(name);
  const rows: LearnerImportRow[] = [];
  const errors: ImportRowError[] = [];

  for (let r = 1; r < grid.length; r += 1) {
    const line = grid[r];
    const get = (name: string) => {
      const i = idx(name);
      return i >= 0 ? String(line[i] ?? '').trim() : '';
    };
    const first = get('first_name') || get('firstname') || get('name');
    const last = get('last_name') || get('lastname') || get('surname');
    if (!first && !last) continue; // blank row
    if (!first || !last) {
      errors.push({
        row: r + 1,
        message: 'FIRST_NAME and LAST_NAME required',
      });
      continue;
    }
    rows.push({
      external_id: get('external_id') || get('learner_id') || undefined,
      first_name: first,
      last_name: last,
      date_of_birth: normalizeDob(
        get('date_of_birth') || get('dob') || get('date_of_birth_yyyy_mm_dd')
      ),
      grade: get('grade') || null,
      class_name: get('class_name') || get('class') || null,
      gender: get('gender') || null,
      nsnp_eligible: yesNo(get('nsnp_eligible') || get('eligible')),
      special_diet: get('special_diet') || null,
      guardian_name: get('guardian_name') || null,
      guardian_phone: get('guardian_phone') || null,
    });
  }
  return { rows, errors };
}

export function parseLearnerCsv(text: string): {
  rows: LearnerImportRow[];
  errors: ImportRowError[];
} {
  return parseLearnerGrid(parseCsv(text));
}

/** Parse Template A .xlsx (or any sheet with learner headers). */
export function parseLearnerXlsx(buf: ArrayBuffer | Buffer | Uint8Array): {
  rows: LearnerImportRow[];
  errors: ImportRowError[];
} {
  try {
    const XLSX = loadXlsx();
    const wb = XLSX.read(buf, { type: 'buffer', cellDates: false });
    const sheetName =
      wb.SheetNames.find((n) => /learner/i.test(n)) || wb.SheetNames[0];
    if (!sheetName) {
      return {
        rows: [],
        errors: [{ row: 0, message: 'Workbook has no sheets' }],
      };
    }
    const sheet = wb.Sheets[sheetName];
    const grid = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      defval: '',
      raw: false,
    }) as unknown[][];
    const stringGrid = grid.map((row) =>
      (Array.isArray(row) ? row : []).map((c) =>
        c == null ? '' : String(c).trim()
      )
    );
    return parseLearnerGrid(stringGrid);
  } catch (e: unknown) {
    return {
      rows: [],
      errors: [
        {
          row: 0,
          message:
            e instanceof Error ? e.message : 'Could not read Excel workbook',
        },
      ],
    };
  }
}

/** Detect extension and parse CSV text or XLSX buffer. */
export function parseLearnerFile(opts: {
  fileName?: string;
  csvText?: string | null;
  xlsxBase64?: string | null;
  xlsxBuffer?: ArrayBuffer | Buffer | Uint8Array | null;
}): { rows: LearnerImportRow[]; errors: ImportRowError[] } {
  const name = String(opts.fileName || '').toLowerCase();
  if (opts.xlsxBuffer) {
    return parseLearnerXlsx(opts.xlsxBuffer);
  }
  if (opts.xlsxBase64) {
    const b64 = opts.xlsxBase64.replace(/^data:[^;]+;base64,/, '');
    const buf = Buffer.from(b64, 'base64');
    return parseLearnerXlsx(buf);
  }
  if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
    if (opts.csvText && !opts.csvText.includes(',')) {
      // mis-routed binary as text — fail clearly
      return {
        rows: [],
        errors: [
          {
            row: 0,
            message: 'Excel file must be uploaded as binary / base64',
          },
        ],
      };
    }
  }
  return parseLearnerCsv(String(opts.csvText || ''));
}

export function parseStaffCsv(text: string): {
  rows: StaffImportRow[];
  errors: ImportRowError[];
} {
  const grid = parseCsv(text);
  if (grid.length < 2) {
    return { rows: [], errors: [{ row: 0, message: 'File empty or missing header' }] };
  }
  const headers = grid[0].map(normHeader);
  const idx = (name: string) => headers.indexOf(name);
  const rows: StaffImportRow[] = [];
  const errors: ImportRowError[] = [];

  for (let r = 1; r < grid.length; r += 1) {
    const line = grid[r];
    const get = (name: string) => {
      const i = idx(name);
      return i >= 0 ? String(line[i] || '').trim() : '';
    };
    const first = get('first_name') || get('firstname');
    const last = get('last_name') || get('lastname') || get('surname');
    if (!first || !last) {
      errors.push({ row: r + 1, message: 'first_name and last_name required' });
      continue;
    }
    rows.push({
      external_id: get('external_id') || get('staff_id') || undefined,
      first_name: first,
      last_name: last,
      role: get('role') || 'teacher',
      email: get('email') || null,
      phone: get('phone') || null,
      phase: get('phase') || null,
    });
  }
  return { rows, errors };
}
