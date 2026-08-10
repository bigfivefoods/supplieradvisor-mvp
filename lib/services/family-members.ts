/**
 * Family / household members on member & patient portal profiles.
 * Typical case: parent email on the account, kids listed as family.
 */

export const FAMILY_RELATIONSHIPS = [
  'child',
  'spouse',
  'partner',
  'parent',
  'guardian',
  'sibling',
  'grandparent',
  'grandchild',
  'other',
] as const;

export type FamilyRelationship = (typeof FAMILY_RELATIONSHIPS)[number] | string;

export type FamilyMember = {
  id: string;
  name: string;
  relationship: FamilyRelationship;
  /** YYYY-MM-DD */
  date_of_birth?: string | null;
  id_number?: string;
  phone?: string;
  email?: string;
  notes?: string;
  /** Explicit flag — also inferred from DOB when under 18 */
  is_minor?: boolean;
  active?: boolean;
  created_at: string;
  updated_at: string;
};

export function newFamilyId(): string {
  return `fam_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function relationshipLabel(rel: string | undefined): string {
  const r = String(rel || 'other').toLowerCase();
  const map: Record<string, string> = {
    child: 'Child',
    spouse: 'Spouse',
    partner: 'Partner',
    parent: 'Parent',
    guardian: 'Guardian',
    sibling: 'Sibling',
    grandparent: 'Grandparent',
    grandchild: 'Grandchild',
    other: 'Family',
  };
  return map[r] || rel || 'Family';
}

/** Age in full years from YYYY-MM-DD, or null */
export function ageFromDob(dob: string | null | undefined): number | null {
  if (!dob || !/^\d{4}-\d{2}-\d{2}/.test(dob)) return null;
  const d = new Date(dob.slice(0, 10) + 'T12:00:00');
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age -= 1;
  return age >= 0 && age < 150 ? age : null;
}

export function inferIsMinor(
  dob: string | null | undefined,
  explicit?: boolean
): boolean {
  if (explicit === true) return true;
  if (explicit === false) return false;
  const age = ageFromDob(dob);
  if (age == null) return false;
  return age < 18;
}

export function normalizeFamilyList(raw: unknown): FamilyMember[] {
  if (!Array.isArray(raw)) return [];
  const out: FamilyMember[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    const name = String(o.name || '').trim();
    if (!name) continue;
    const id = o.id ? String(o.id) : newFamilyId();
    const dob = o.date_of_birth
      ? String(o.date_of_birth).slice(0, 10)
      : null;
    const is_minor = inferIsMinor(
      dob,
      o.is_minor === true ? true : o.is_minor === false ? false : undefined
    );
    out.push({
      id,
      name,
      relationship: String(o.relationship || 'child'),
      date_of_birth: dob,
      id_number: o.id_number ? String(o.id_number).trim() : undefined,
      phone: o.phone ? String(o.phone).trim() : undefined,
      email: o.email ? String(o.email).toLowerCase().trim() : undefined,
      notes: o.notes ? String(o.notes).trim() : undefined,
      is_minor,
      active: o.active !== false,
      created_at: o.created_at
        ? String(o.created_at)
        : new Date().toISOString(),
      updated_at: o.updated_at
        ? String(o.updated_at)
        : new Date().toISOString(),
    });
  }
  return out;
}

/**
 * Upsert a family member onto a list (mutates copy).
 * Pass record without id to create.
 */
export function upsertFamilyMember(
  list: FamilyMember[] | undefined | null,
  patch: Record<string, unknown>,
  now = new Date().toISOString()
): { list: FamilyMember[]; member: FamilyMember; error?: string } {
  const prev = normalizeFamilyList(list);
  const name = String(patch.name || '').trim();
  if (!name) {
    return {
      list: prev,
      member: prev[0] || {
        id: '',
        name: '',
        relationship: 'child',
        created_at: now,
        updated_at: now,
      },
      error: 'Name is required for a family member',
    };
  }
  const id = patch.id ? String(patch.id) : newFamilyId();
  const i = prev.findIndex((m) => m.id === id);
  const existing = i >= 0 ? prev[i] : null;
  const dob =
    patch.date_of_birth !== undefined
      ? patch.date_of_birth
        ? String(patch.date_of_birth).slice(0, 10)
        : null
      : existing?.date_of_birth ?? null;
  const is_minor = inferIsMinor(
    dob,
    patch.is_minor === true
      ? true
      : patch.is_minor === false
        ? false
        : existing?.is_minor
  );
  const member: FamilyMember = {
    id,
    name,
    relationship: String(
      patch.relationship !== undefined
        ? patch.relationship
        : existing?.relationship || 'child'
    ),
    date_of_birth: dob,
    id_number:
      patch.id_number !== undefined
        ? patch.id_number
          ? String(patch.id_number).trim()
          : undefined
        : existing?.id_number,
    phone:
      patch.phone !== undefined
        ? patch.phone
          ? String(patch.phone).trim()
          : undefined
        : existing?.phone,
    email:
      patch.email !== undefined
        ? patch.email
          ? String(patch.email).toLowerCase().trim()
          : undefined
        : existing?.email,
    notes:
      patch.notes !== undefined
        ? patch.notes
          ? String(patch.notes).trim()
          : undefined
        : existing?.notes,
    is_minor,
    active:
      patch.active !== undefined
        ? patch.active !== false
        : existing?.active !== false,
    created_at: existing?.created_at || now,
    updated_at: now,
  };
  if (i >= 0) {
    const next = [...prev];
    next[i] = member;
    return { list: next, member };
  }
  return { list: [...prev, member], member };
}

export function removeFamilyMember(
  list: FamilyMember[] | undefined | null,
  id: string
): FamilyMember[] {
  return normalizeFamilyList(list).filter((m) => m.id !== id);
}

/** Safe portal payload (all fields — no secrets) */
export function portalFamilyView(
  list: FamilyMember[] | undefined | null
): Array<FamilyMember & { age?: number | null; relationship_label: string }> {
  return normalizeFamilyList(list)
    .filter((m) => m.active !== false)
    .map((m) => ({
      ...m,
      age: ageFromDob(m.date_of_birth),
      relationship_label: relationshipLabel(m.relationship),
    }));
}
