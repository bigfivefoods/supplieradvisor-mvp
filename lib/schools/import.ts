/**
 * Excel-compatible CSV import for learners & staff.
 * Templates download as .csv (open/save in Excel).
 */

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

const LEARNER_HEADERS = [
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

const STAFF_HEADERS = [
  'external_id',
  'first_name',
  'last_name',
  'role',
  'email',
  'phone',
  'phase',
] as const;

export function learnerTemplateCsv(): string {
  const header = LEARNER_HEADERS.join(',');
  const example =
    'L001,Thabo,Molefe,2014-03-12,4,4A,M,Y,,Nomsa Molefe,0820000000';
  const bom = '\uFEFF';
  return `${bom}${header}\n${example}\n`;
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

export function parseLearnerCsv(text: string): {
  rows: LearnerImportRow[];
  errors: ImportRowError[];
} {
  const grid = parseCsv(text);
  if (grid.length < 2) {
    return { rows: [], errors: [{ row: 0, message: 'File empty or missing header' }] };
  }
  const headers = grid[0].map(normHeader);
  const idx = (name: string) => headers.indexOf(name);
  const rows: LearnerImportRow[] = [];
  const errors: ImportRowError[] = [];

  for (let r = 1; r < grid.length; r += 1) {
    const line = grid[r];
    const get = (name: string) => {
      const i = idx(name);
      return i >= 0 ? String(line[i] || '').trim() : '';
    };
    const first = get('first_name') || get('firstname') || get('name');
    const last = get('last_name') || get('lastname') || get('surname');
    if (!first || !last) {
      errors.push({ row: r + 1, message: 'first_name and last_name required' });
      continue;
    }
    rows.push({
      external_id: get('external_id') || get('learner_id') || undefined,
      first_name: first,
      last_name: last,
      date_of_birth: get('date_of_birth') || get('dob') || null,
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
