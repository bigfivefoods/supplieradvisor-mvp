/**
 * Fitgraph client list — downloadable .xlsx export + bulk import template.
 */
import type * as XLSXType from 'xlsx';
import {
  MEMBERSHIP_STATUSES,
  newId,
  type FitClient,
  type FitCoach,
  type FitMembershipPlan,
  type FitgraphStore,
} from '@/lib/fitness/fitgraph';

export const FIT_CLIENT_XLSX_MIME =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** Canonical column headers (import is case-insensitive / flexible aliases) */
export const FIT_CLIENT_HEADERS = [
  'code',
  'name',
  'email',
  'phone',
  'membership_plan_code',
  'membership_status',
  'coach_code',
  'start_date',
  'end_date',
  'emergency_contact',
  'notes',
  'active',
] as const;

function loadXlsx(): typeof XLSXType {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('xlsx') as typeof XLSXType;
}

function cell(v: unknown): string {
  if (v == null) return '';
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    return v.toISOString().slice(0, 10);
  }
  return String(v).trim();
}

function parseActive(raw: string): boolean {
  const s = raw.toLowerCase();
  if (!s) return true;
  if (['n', 'no', 'false', '0', 'inactive', 'ended'].includes(s)) return false;
  return true;
}

function normalizeHeader(h: string): string {
  return h
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^\w]/g, '');
}

/** Map flexible headers → canonical keys */
const HEADER_ALIASES: Record<string, (typeof FIT_CLIENT_HEADERS)[number]> = {
  code: 'code',
  member_code: 'code',
  client_code: 'code',
  memberid: 'code',
  name: 'name',
  full_name: 'name',
  fullname: 'name',
  client_name: 'name',
  member_name: 'name',
  email: 'email',
  email_address: 'email',
  phone: 'phone',
  mobile: 'phone',
  cellphone: 'phone',
  cell: 'phone',
  tel: 'phone',
  membership_plan_code: 'membership_plan_code',
  plan_code: 'membership_plan_code',
  plan: 'membership_plan_code',
  membership_plan: 'membership_plan_code',
  membership_status: 'membership_status',
  status: 'membership_status',
  member_status: 'membership_status',
  coach_code: 'coach_code',
  coach: 'coach_code',
  trainer: 'coach_code',
  trainer_code: 'coach_code',
  start_date: 'start_date',
  started: 'start_date',
  join_date: 'start_date',
  joined: 'start_date',
  end_date: 'end_date',
  ended: 'end_date',
  expiry: 'end_date',
  emergency_contact: 'emergency_contact',
  emergency: 'emergency_contact',
  ice: 'emergency_contact',
  notes: 'notes',
  note: 'notes',
  comments: 'notes',
  active: 'active',
};

function resolvePlanId(
  plans: FitMembershipPlan[],
  raw: string
): string | null {
  if (!raw) return null;
  const key = raw.toLowerCase();
  const hit = plans.find(
    (p) =>
      p.code.toLowerCase() === key ||
      p.name.toLowerCase() === key ||
      p.id === raw
  );
  return hit?.id ?? null;
}

function resolveCoachId(coaches: FitCoach[], raw: string): string | null {
  if (!raw) return null;
  const key = raw.toLowerCase();
  const hit = coaches.find(
    (c) =>
      c.code.toLowerCase() === key ||
      c.name.toLowerCase() === key ||
      c.id === raw
  );
  return hit?.id ?? null;
}

function planCode(store: FitgraphStore, planId?: string | null): string {
  if (!planId) return '';
  return store.membership_plans.find((p) => p.id === planId)?.code || '';
}

function coachCode(store: FitgraphStore, coachId?: string | null): string {
  if (!coachId) return '';
  return store.coaches.find((c) => c.id === coachId)?.code || '';
}

function clientToRow(store: FitgraphStore, c: FitClient): string[] {
  return [
    c.code || '',
    c.name || '',
    c.email || '',
    c.phone || '',
    planCode(store, c.membership_plan_id),
    String(c.membership_status || 'active'),
    coachCode(store, c.coach_id),
    c.start_date || '',
    c.end_date || '',
    c.emergency_contact || '',
    c.notes || '',
    c.active === false ? 'N' : 'Y',
  ];
}

/**
 * Build workbook: current clients (or empty template) + reference sheets.
 */
export function buildFitClientsXlsx(
  store: FitgraphStore,
  opts?: {
    /** empty template with example rows instead of live data */
    templateOnly?: boolean;
    brandName?: string;
  }
): Uint8Array {
  const XLSX = loadXlsx();
  const headers = [...FIT_CLIENT_HEADERS];
  let dataRows: string[][];

  if (opts?.templateOnly) {
    dataRows = [
      [
        'M-001',
        'Thabo Molefe',
        'thabo@example.com',
        '0820000001',
        store.membership_plans[0]?.code || 'UNLIM',
        'active',
        store.coaches[0]?.code || '',
        new Date().toISOString().slice(0, 10),
        '',
        'Nomsa Molefe 0820000002',
        '',
        'Y',
      ],
      [
        'M-002',
        'Aisha Naidoo',
        'aisha@example.com',
        '0831112222',
        store.membership_plans[1]?.code || store.membership_plans[0]?.code || '',
        'trial',
        store.coaches[1]?.code || store.coaches[0]?.code || '',
        new Date().toISOString().slice(0, 10),
        '',
        '',
        'Morning classes preferred',
        'Y',
      ],
    ];
  } else {
    dataRows = [...store.clients]
      .sort((a, b) => (a.code || '').localeCompare(b.code || ''))
      .map((c) => clientToRow(store, c));
  }

  const ws = XLSX.utils.aoa_to_sheet([headers, ...dataRows]);
  ws['!cols'] = headers.map((h) => ({
    wch: Math.max(12, h.length + 2),
  }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Clients');

  // Reference: plans
  const planRows = [
    ['code', 'name', 'price_zar', 'billing', 'status'],
    ...store.membership_plans.map((p) => [
      p.code,
      p.name,
      String(p.price_zar ?? ''),
      p.billing || '',
      p.active === false ? 'inactive' : 'active',
    ]),
  ];
  const planWs = XLSX.utils.aoa_to_sheet(planRows);
  XLSX.utils.book_append_sheet(wb, planWs, 'Plans');

  // Reference: coaches
  const coachRows = [
    ['code', 'name', 'specialties', 'status'],
    ...store.coaches.map((c) => [
      c.code,
      c.name,
      (c.specialties || []).join(', '),
      c.active === false || c.end_date ? 'ended' : 'active',
    ]),
  ];
  const coachWs = XLSX.utils.aoa_to_sheet(coachRows);
  XLSX.utils.book_append_sheet(wb, coachWs, 'Coaches');

  const brand = opts?.brandName || store.settings?.brand_name || 'Fitgraph';
  const help = XLSX.utils.aoa_to_sheet([
    [`${brand} — client list (.xlsx)`],
    [''],
    ['How to use'],
    ['1. Keep the header row on the "Clients" sheet exactly as provided.'],
    ['2. name is required. code is optional (auto-generated if blank).'],
    ['3. membership_plan_code and coach_code must match codes on Plans / Coaches sheets.'],
    [
      `4. membership_status: ${MEMBERSHIP_STATUSES.join(' | ')} (default active).`,
    ],
    ['5. start_date / end_date: YYYY-MM-DD (Excel date cells are accepted).'],
    ['6. active: Y / N (or Yes / No). Default Y if blank.'],
    [
      '7. On upload: rows match existing clients by code (preferred) or email; otherwise a new client is created.',
    ],
    ['8. Delete example rows before import if you used the blank template.'],
    [''],
    ['Sheets'],
    ['Clients — import / export data'],
    ['Plans — reference membership plan codes for this gym'],
    ['Coaches — reference coach codes for this gym'],
  ]);
  XLSX.utils.book_append_sheet(wb, help, 'Instructions');

  const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as
    | Uint8Array
    | number[];
  return out instanceof Uint8Array ? out : new Uint8Array(out);
}

export type FitClientImportRow = {
  row: number;
  code?: string;
  name: string;
  email?: string;
  phone?: string;
  membership_plan_code?: string;
  membership_status?: string;
  coach_code?: string;
  start_date?: string;
  end_date?: string;
  emergency_contact?: string;
  notes?: string;
  active?: boolean;
};

export type FitClientImportResult = {
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
  warnings: string[];
};

/**
 * Parse .xlsx (base64 or buffer) or CSV text into import rows.
 */
export function parseFitClientsImport(input: {
  xlsxBase64?: string;
  buffer?: Buffer | Uint8Array;
  csv?: string;
}): { rows: FitClientImportRow[]; errors: string[] } {
  const XLSX = loadXlsx();
  const errors: string[] = [];
  let grid: unknown[][] = [];

  try {
    if (input.xlsxBase64 || input.buffer) {
      const buf = input.buffer
        ? Buffer.from(input.buffer)
        : Buffer.from(String(input.xlsxBase64), 'base64');
      const wb = XLSX.read(buf, { type: 'buffer', cellDates: true });
      const sheetName =
        wb.SheetNames.find((n) => /client|member/i.test(n)) ||
        wb.SheetNames[0];
      if (!sheetName) {
        return { rows: [], errors: ['Workbook has no sheets'] };
      }
      const sheet = wb.Sheets[sheetName];
      grid = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
        header: 1,
        defval: '',
        raw: false,
      }) as unknown[][];
    } else if (input.csv) {
      const wb = XLSX.read(input.csv, { type: 'string' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      grid = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
        header: 1,
        defval: '',
        raw: false,
      }) as unknown[][];
    } else {
      return { rows: [], errors: ['No file data provided'] };
    }
  } catch (e: unknown) {
    return {
      rows: [],
      errors: [e instanceof Error ? e.message : 'Could not parse file'],
    };
  }

  if (!grid.length) return { rows: [], errors: ['File is empty'] };

  // Find header row (first non-empty with a name-like column)
  let headerIdx = 0;
  for (let i = 0; i < Math.min(grid.length, 10); i++) {
    const cells = (grid[i] || []).map((c) => normalizeHeader(cell(c)));
    if (cells.some((c) => HEADER_ALIASES[c] === 'name' || c === 'name')) {
      headerIdx = i;
      break;
    }
  }

  const headerCells = (grid[headerIdx] || []).map((c) =>
    normalizeHeader(cell(c))
  );
  const colMap: Partial<
    Record<(typeof FIT_CLIENT_HEADERS)[number], number>
  > = {};
  headerCells.forEach((h, idx) => {
    const key = HEADER_ALIASES[h];
    if (key && colMap[key] === undefined) colMap[key] = idx;
  });

  if (colMap.name === undefined) {
    return {
      rows: [],
      errors: [
        'Missing required column "name" (or "full_name") on the Clients sheet',
      ],
    };
  }

  const rows: FitClientImportRow[] = [];
  for (let r = headerIdx + 1; r < grid.length; r++) {
    const line = grid[r] || [];
    const get = (k: (typeof FIT_CLIENT_HEADERS)[number]) => {
      const i = colMap[k];
      return i === undefined ? '' : cell(line[i]);
    };
    const name = get('name');
    const code = get('code');
    const email = get('email');
    // Skip blank rows
    if (!name && !code && !email) continue;
    if (!name) {
      errors.push(`Row ${r + 1}: name is required`);
      continue;
    }

    let start_date = get('start_date');
    let end_date = get('end_date');
    // Excel serial dates sometimes arrive as numbers as strings
    if (/^\d+(\.\d+)?$/.test(start_date)) {
      try {
        const X = loadXlsx();
        const n = Number(start_date);
        const parsed = X.SSF?.parse_date_code?.(n);
        if (parsed) {
          start_date = `${parsed.y}-${String(parsed.m).padStart(2, '0')}-${String(parsed.d).padStart(2, '0')}`;
        }
      } catch {
        /* keep raw */
      }
    }
    if (/^\d+(\.\d+)?$/.test(end_date)) {
      try {
        const X = loadXlsx();
        const n = Number(end_date);
        const parsed = X.SSF?.parse_date_code?.(n);
        if (parsed) {
          end_date = `${parsed.y}-${String(parsed.m).padStart(2, '0')}-${String(parsed.d).padStart(2, '0')}`;
        }
      } catch {
        /* keep raw */
      }
    }

    const statusRaw = get('membership_status').toLowerCase() || 'active';
    const status = MEMBERSHIP_STATUSES.includes(
      statusRaw as (typeof MEMBERSHIP_STATUSES)[number]
    )
      ? statusRaw
      : statusRaw || 'active';

    rows.push({
      row: r + 1,
      code: code || undefined,
      name,
      email: email || undefined,
      phone: get('phone') || undefined,
      membership_plan_code: get('membership_plan_code') || undefined,
      membership_status: status,
      coach_code: get('coach_code') || undefined,
      start_date: start_date || undefined,
      end_date: end_date || undefined,
      emergency_contact: get('emergency_contact') || undefined,
      notes: get('notes') || undefined,
      active: parseActive(get('active')),
    });
  }

  return { rows, errors };
}

/**
 * Apply parsed rows onto store (mutates). Match by code then email.
 */
export function applyFitClientImport(
  store: FitgraphStore,
  rows: FitClientImportRow[],
  now: string
): FitClientImportResult {
  let created = 0;
  let updated = 0;
  let skipped = 0;
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!store.clients) store.clients = [];

  for (const row of rows) {
    try {
      const planId = resolvePlanId(
        store.membership_plans || [],
        row.membership_plan_code || ''
      );
      if (row.membership_plan_code && !planId) {
        warnings.push(
          `Row ${row.row}: plan code "${row.membership_plan_code}" not found — left blank`
        );
      }
      const coachId = resolveCoachId(
        store.coaches || [],
        row.coach_code || ''
      );
      if (row.coach_code && !coachId) {
        warnings.push(
          `Row ${row.row}: coach code "${row.coach_code}" not found — left blank`
        );
      }

      const codeKey = (row.code || '').trim().toLowerCase();
      const emailKey = (row.email || '').trim().toLowerCase();
      let idx = -1;
      if (codeKey) {
        idx = store.clients.findIndex(
          (c) => (c.code || '').toLowerCase() === codeKey
        );
      }
      if (idx < 0 && emailKey) {
        idx = store.clients.findIndex(
          (c) => (c.email || '').toLowerCase() === emailKey
        );
      }

      if (idx >= 0) {
        const prev = store.clients[idx];
        store.clients[idx] = {
          ...prev,
          code: row.code?.trim() || prev.code,
          name: row.name.trim(),
          email: row.email !== undefined ? row.email || undefined : prev.email,
          phone: row.phone !== undefined ? row.phone || undefined : prev.phone,
          membership_plan_id:
            row.membership_plan_code && planId
              ? planId
              : row.membership_plan_code === ''
                ? null
                : prev.membership_plan_id,
          membership_status: row.membership_status || prev.membership_status,
          coach_id:
            row.coach_code && coachId
              ? coachId
              : row.coach_code === ''
                ? null
                : prev.coach_id,
          start_date:
            row.start_date !== undefined
              ? row.start_date || null
              : prev.start_date,
          end_date:
            row.end_date !== undefined ? row.end_date || null : prev.end_date,
          emergency_contact:
            row.emergency_contact !== undefined
              ? row.emergency_contact
              : prev.emergency_contact,
          notes: row.notes !== undefined ? row.notes : prev.notes,
          active: row.active !== false,
          updated_at: now,
        };
        updated += 1;
      } else {
        const code =
          row.code?.trim() ||
          `M-${String(store.clients.length + 1).padStart(3, '0')}`;
        // Ensure unique code
        let finalCode = code;
        let n = 1;
        while (
          store.clients.some(
            (c) => c.code.toLowerCase() === finalCode.toLowerCase()
          )
        ) {
          finalCode = `${code}-${n++}`;
        }
        const client: FitClient = {
          id: newId('cli'),
          code: finalCode,
          name: row.name.trim(),
          email: row.email,
          phone: row.phone,
          membership_plan_id: planId,
          membership_status: row.membership_status || 'active',
          coach_id: coachId,
          start_date: row.start_date || now.slice(0, 10),
          end_date: row.end_date || null,
          emergency_contact: row.emergency_contact,
          notes: row.notes,
          active: row.active !== false,
          created_at: now,
          updated_at: now,
        };
        store.clients.push(client);
        created += 1;
      }
    } catch (e: unknown) {
      errors.push(
        `Row ${row.row}: ${e instanceof Error ? e.message : 'import failed'}`
      );
      skipped += 1;
    }
  }

  return { created, updated, skipped, errors, warnings };
}
