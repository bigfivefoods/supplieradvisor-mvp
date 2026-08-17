/**
 * One person across wallet, CRM, People, and Advisor books.
 */

export type IdentityLinks = {
  platform_user_id?: string | null;
  crm_customer_id?: number | null;
  hr_employee_id?: number | null;
  advisor_person_id?: string | null;
  advisor_module?: string | null;
  email?: string | null;
};

export function normalizeEmail(raw?: string | null): string {
  return String(raw || '')
    .trim()
    .toLowerCase();
}

export function mergeIdentity(...parts: Array<IdentityLinks | null | undefined>): IdentityLinks {
  const out: IdentityLinks = {};
  for (const p of parts) {
    if (!p) continue;
    if (p.platform_user_id) out.platform_user_id = p.platform_user_id;
    if (p.crm_customer_id) out.crm_customer_id = Number(p.crm_customer_id);
    if (p.hr_employee_id) out.hr_employee_id = Number(p.hr_employee_id);
    if (p.advisor_person_id) out.advisor_person_id = p.advisor_person_id;
    if (p.advisor_module) out.advisor_module = p.advisor_module;
    if (p.email) out.email = normalizeEmail(p.email);
  }
  return out;
}

export function identityComplete(links: IdentityLinks): boolean {
  return Boolean(
    links.crm_customer_id &&
      (links.platform_user_id || links.hr_employee_id || links.advisor_person_id)
  );
}

export function emailsMatch(a?: string | null, b?: string | null): boolean {
  const x = normalizeEmail(a);
  const y = normalizeEmail(b);
  return Boolean(x && y && x === y);
}

export type ReconcileRow = {
  kind: 'customer' | 'employee' | 'advisor';
  id: string;
  name: string;
  email?: string | null;
  platform_user_id?: string | null;
  crm_customer_id?: number | null;
  hr_employee_id?: number | null;
};

/** Group rows that share email or an already-linked id. */
export function reconcileIdentityClusters(rows: ReconcileRow[]): ReconcileRow[][] {
  const parent = new Map<number, number>();
  const find = (i: number): number => {
    let p = parent.get(i) ?? i;
    while (p !== (parent.get(p) ?? p)) p = parent.get(p) ?? p;
    parent.set(i, p);
    return p;
  };
  const union = (a: number, b: number) => {
    const pa = find(a);
    const pb = find(b);
    if (pa !== pb) parent.set(pa, pb);
  };

  rows.forEach((_, i) => parent.set(i, i));

  const byEmail = new Map<string, number>();
  const byPlatform = new Map<string, number>();
  const byCrm = new Map<number, number>();
  const byHr = new Map<number, number>();

  rows.forEach((row, i) => {
    const email = normalizeEmail(row.email);
    if (email) {
      const prev = byEmail.get(email);
      if (prev != null) union(prev, i);
      else byEmail.set(email, i);
    }
    if (row.platform_user_id) {
      const prev = byPlatform.get(row.platform_user_id);
      if (prev != null) union(prev, i);
      else byPlatform.set(row.platform_user_id, i);
    }
    if (row.crm_customer_id) {
      const prev = byCrm.get(row.crm_customer_id);
      if (prev != null) union(prev, i);
      else byCrm.set(row.crm_customer_id, i);
    }
    if (row.hr_employee_id) {
      const prev = byHr.get(row.hr_employee_id);
      if (prev != null) union(prev, i);
      else byHr.set(row.hr_employee_id, i);
    }
  });

  const groups = new Map<number, ReconcileRow[]>();
  rows.forEach((row, i) => {
    const root = find(i);
    const list = groups.get(root) || [];
    list.push(row);
    groups.set(root, list);
  });
  return [...groups.values()].filter((g) => g.length > 1);
}
