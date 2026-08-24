/**
 * Normalise customer, supplier, and operations RIAD rows onto one company book.
 */
export type CompanyRiadSource = 'customer' | 'supplier' | 'operations';

export type CompanyRiadRow = {
  key: string;
  source: CompanyRiadSource;
  sourceId: number;
  entry_type: string;
  title: string;
  description: string | null;
  status: string;
  severity: string;
  category: string | null;
  owner_name: string | null;
  party_name: string | null;
  due_date: string | null;
  created_at: string | null;
  href: string;
};

function str(v: unknown): string {
  return String(v || '').trim();
}

export function normalizeSeverity(raw: unknown, priority?: unknown): string {
  const p = str(priority).toLowerCase();
  if (['low', 'medium', 'high', 'critical'].includes(p)) return p;
  const t = str(raw).toLowerCase();
  if (['low', 'medium', 'high', 'critical'].includes(t)) return t;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return 'medium';
  if (n >= 5) return 'critical';
  if (n >= 4) return 'high';
  if (n >= 3) return 'medium';
  return 'low';
}

export function mapCustomerRiad(
  row: Record<string, unknown>,
  customerName?: string | null
): CompanyRiadRow {
  const id = Number(row.id);
  return {
    key: `customer:${id}`,
    source: 'customer',
    sourceId: id,
    entry_type: str(row.entry_type || row.riad_type) || 'risk',
    title: str(row.title) || 'Untitled',
    description: row.description != null ? str(row.description) || null : null,
    status: str(row.status) || 'open',
    severity: normalizeSeverity(row.severity, row.priority),
    category: str(row.category) || null,
    owner_name: str(row.owner_name) || null,
    party_name: customerName || str(row.customer_name) || null,
    due_date: row.due_date != null ? String(row.due_date).slice(0, 10) : null,
    created_at: row.created_at != null ? String(row.created_at) : null,
    href: '/dashboard/customers/riad-log',
  };
}

export function mapSupplierRiad(
  row: Record<string, unknown>,
  supplierName?: string | null
): CompanyRiadRow {
  const id = Number(row.id);
  return {
    key: `supplier:${id}`,
    source: 'supplier',
    sourceId: id,
    entry_type: str(row.entry_type || row.riad_type) || 'risk',
    title: str(row.title) || 'Untitled',
    description: row.description != null ? str(row.description) || null : null,
    status: str(row.status) || 'open',
    severity: normalizeSeverity(row.severity, row.priority),
    category: str(row.category) || null,
    owner_name: str(row.owner_name) || null,
    party_name: supplierName || str(row.supplier_name) || null,
    due_date: row.due_date != null ? String(row.due_date).slice(0, 10) : null,
    created_at: row.created_at != null ? String(row.created_at) : null,
    href: '/dashboard/suppliers/riad-log',
  };
}

export function mapOperationsRiad(row: Record<string, unknown>): CompanyRiadRow {
  const id = Number(row.id);
  const party =
    str(row.container_name) ||
    str(row.stakeholder_name) ||
    (row.container_code ? String(row.container_code) : null);
  return {
    key: `operations:${id}`,
    source: 'operations',
    sourceId: id,
    entry_type: str(row.riad_type || row.entry_type) || 'risk',
    title: str(row.title) || 'Untitled',
    description: row.description != null ? str(row.description) || null : null,
    status: str(row.status) || 'open',
    severity: normalizeSeverity(row.severity, row.priority),
    category: str(row.category) || str(row.module) || null,
    owner_name: str(row.owner_name || row.created_by_name) || null,
    party_name: party,
    due_date: row.due_date != null ? String(row.due_date).slice(0, 10) : null,
    created_at: row.created_at != null ? String(row.created_at) : null,
    href: '/dashboard/containers/riad-log',
  };
}

export function sortCompanyRiad(a: CompanyRiadRow, b: CompanyRiadRow): number {
  const am = Date.parse(a.created_at || '') || 0;
  const bm = Date.parse(b.created_at || '') || 0;
  return bm - am;
}
