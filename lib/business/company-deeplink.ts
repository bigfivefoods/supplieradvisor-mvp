/**
 * ?company=<id> deep link on /dashboard/select-company (e.g. from the Big Five Group leadership
 * portal's "Sign in to SupplierAdvisor®" cards). Only ever selects a company that is already in
 * the signed-in user's own list from /api/me/companies (active memberships); anything else falls
 * back to the normal picker.
 */
export function parseCompanyParam(raw: string | null | undefined): string | null {
  const v = String(raw ?? '').trim();
  if (!/^[1-9]\d{0,11}$/.test(v)) return null;
  return v;
}

export function findDeepLinkedCompany<T extends { id: string | number }>(
  companies: readonly T[],
  raw: string | null | undefined
): T | null {
  const id = parseCompanyParam(raw);
  if (!id) return null;
  return companies.find((c) => String(c.id) === id) ?? null;
}
