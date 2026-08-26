/**
 * One household on the SA Member wallet.
 * Profile + family live on platform_b2c_profiles and are stamped onto
 * every gym / clinic desk this person links — no recapture.
 */
import type { NextRequest } from 'next/server';
import {
  normalizeFamilyList,
  upsertFamilyMember,
  removeFamilyMember,
  type FamilyMember,
} from '@/lib/services/family-members';
import type { B2cMembership, B2cProfile } from '@/lib/b2c/types';
import {
  ensureB2cProfile,
  loadB2cProfile,
  loadB2cProfileByEmail,
  saveB2cProfile,
} from '@/lib/b2c/profile-store';
import { emailsMatch, phonesMatch } from '@/lib/b2c/member-app';
import {
  loadWalletCompany,
  saveWalletCompanyMeta,
} from '@/lib/b2c/load-company';
import {
  readFitgraphFromMetadata,
  writeFitgraphToMetadata,
} from '@/lib/fitness/fitgraph';
import {
  readPhysiographFromMetadata,
  writePhysiographToMetadata,
} from '@/lib/clinic/physiograph';
import {
  readDentalgraphFromMetadata,
  writeDentalgraphToMetadata,
} from '@/lib/dental/dentalgraph';
import {
  readMedicalgraphFromMetadata,
  writeMedicalgraphToMetadata,
} from '@/lib/clinic/medicalgraph';
import {
  readPsychiatrygraphFromMetadata,
  writePsychiatrygraphToMetadata,
} from '@/lib/clinic/psychiatrygraph';
import {
  readVetgraphFromMetadata,
  writeVetgraphToMetadata,
} from '@/lib/clinic/vetgraph';
import { identityFromProfile } from '@/lib/b2c/identity';
import { linkPlatformUserId } from '@/lib/messaging/link-platform-user';
import type { PersonIdentityVerification } from '@/lib/identity/person-verification';
import {
  formatAddress,
  formatEmergencyContact,
  healthFromPassport,
  parseMemberPassport,
  passportFromProfileMeta,
  type MemberPassport,
} from '@/lib/b2c/member-passport';
import { emptyMedicalRecord } from '@/lib/clinic/patient-medical';

export type WalletHouseholdSnapshot = {
  full_name: string | null;
  email: string | null;
  phone: string | null;
  photo_url: string | null;
  city: string | null;
  id_number: string | null;
  family: FamilyMember[];
  identity?: PersonIdentityVerification | null;
  passport: MemberPassport;
};

export type DeskPerson = {
  id: string;
  name?: string;
  email?: string;
  phone?: string;
  photo_url?: string;
  id_number?: string;
  family?: FamilyMember[];
  medical?: { id_number?: string; [k: string]: unknown } | null;
  identity?: PersonIdentityVerification | null;
  date_of_birth?: string | null;
  next_of_kin?: string;
  next_of_kin_phone?: string;
  next_of_kin_relationship?: string;
  emergency_contact?: string;
  passport?: MemberPassport;
  notes?: string;
  health?: import('@/lib/health/body-map').PersonHealthProfile;
  popia_consent_at?: string | null;
  platform_user_id?: string | null;
  updated_at?: string;
};

export type DeskKind = 'gym' | 'physio' | 'dental' | 'medical' | 'psychiatry' | 'vet';

const DESK_KINDS: DeskKind[] = [
  'gym',
  'physio',
  'dental',
  'medical',
  'psychiatry',
];

export function isPlaceholderName(name?: string | null): boolean {
  const n = String(name || '').trim();
  if (!n) return true;
  const lower = n.toLowerCase();
  if (lower === 'member' || lower === 'patient' || lower === 'customer') {
    return true;
  }
  if (n.includes('@')) return true;
  return false;
}

export function familyKey(m: FamilyMember): string {
  return [
    String(m.name || '')
      .trim()
      .toLowerCase(),
    String(m.date_of_birth || '').slice(0, 10),
    String(m.relationship || '').toLowerCase(),
  ].join('|');
}

export function mergeFamilyLists(
  local: FamilyMember[] | undefined | null,
  incoming: FamilyMember[] | undefined | null
): FamilyMember[] {
  const a = normalizeFamilyList(local);
  const b = normalizeFamilyList(incoming);
  const out = [...a];
  for (const member of b) {
    const byId = out.findIndex((x) => x.id === member.id);
    if (byId >= 0) {
      out[byId] = pickRicherFamily(out[byId], member);
      continue;
    }
    const byKey = out.findIndex((x) => familyKey(x) === familyKey(member));
    if (byKey >= 0) {
      out[byKey] = pickRicherFamily(out[byKey], {
        ...member,
        id: out[byKey].id,
      });
      continue;
    }
    out.push(member);
  }
  return out;
}

function pickRicherFamily(keep: FamilyMember, other: FamilyMember): FamilyMember {
  const pick = (a?: string, b?: string) => (a && String(a).trim() ? a : b);
  return {
    ...keep,
    name: pick(keep.name, other.name) || keep.name,
    relationship: pick(String(keep.relationship), String(other.relationship)) ||
      keep.relationship,
    date_of_birth: pick(keep.date_of_birth || undefined, other.date_of_birth || undefined) ||
      keep.date_of_birth,
    id_number: pick(keep.id_number, other.id_number),
    phone: pick(keep.phone, other.phone),
    email: pick(keep.email, other.email),
    notes: pick(keep.notes, other.notes),
    is_minor: keep.is_minor ?? other.is_minor,
    active: keep.active !== false && other.active !== false,
    created_at: keep.created_at || other.created_at,
    updated_at:
      keep.updated_at && other.updated_at
        ? keep.updated_at > other.updated_at
          ? keep.updated_at
          : other.updated_at
        : keep.updated_at || other.updated_at,
  };
}

export function familyFingerprint(
  list: FamilyMember[] | undefined | null
): string {
  return JSON.stringify(
    normalizeFamilyList(list)
      .map((m) => ({
        id: m.id,
        name: m.name,
        relationship: m.relationship,
        date_of_birth: m.date_of_birth || '',
        id_number: m.id_number || '',
        phone: m.phone || '',
        email: m.email || '',
        notes: m.notes || '',
        active: m.active !== false,
      }))
      .sort((x, y) => x.id.localeCompare(y.id))
  );
}

export function snapshotFromProfile(
  profile: B2cProfile
): WalletHouseholdSnapshot {
  const family = normalizeFamilyList(
    profile.family ?? profile.metadata?.family
  );
  return {
    full_name: profile.full_name || null,
    email: profile.email || null,
    phone: profile.phone || null,
    photo_url: profile.photo_url || null,
    city: profile.city || null,
    id_number: profile.id_number || null,
    family,
    identity: identityFromProfile(profile),
    passport: passportFromProfileMeta(profile.metadata, {
      city: profile.city,
    }),
  };
}

export function applySnapshotToPerson<T extends DeskPerson>(
  person: T,
  snap: WalletHouseholdSnapshot,
  opts?: { preferWallet?: boolean }
): { person: T; changed: boolean } {
  const prefer = opts?.preferWallet !== false;
  let changed = false;
  const next: T = { ...person };

  const walletName = snap.full_name?.trim() || '';
  if (walletName && !isPlaceholderName(walletName)) {
    if (isPlaceholderName(next.name) || (prefer && next.name !== walletName)) {
      next.name = walletName;
      changed = true;
    }
  }
  if (snap.email) {
    if (!next.email || (prefer && !emailsMatch(next.email, snap.email))) {
      next.email = snap.email;
      changed = true;
    }
  }
  if (snap.phone) {
    if (!next.phone || (prefer && !phonesMatch(next.phone, snap.phone))) {
      next.phone = snap.phone;
      changed = true;
    }
  }
  if (snap.photo_url) {
    if (!next.photo_url || (prefer && next.photo_url !== snap.photo_url)) {
      next.photo_url = snap.photo_url;
      changed = true;
    }
  }
  if (snap.id_number) {
    if (!next.id_number) {
      next.id_number = snap.id_number;
      changed = true;
    }
    if (next.medical && !next.medical.id_number) {
      next.medical = { ...next.medical, id_number: snap.id_number };
      changed = true;
    }
  }
  if (
    snap.identity &&
    snap.identity.status === 'verified' &&
    next.identity?.status !== 'verified'
  ) {
    next.identity = snap.identity;
    changed = true;
  }

  const nextFamily = prefer
    ? normalizeFamilyList(snap.family)
    : mergeFamilyLists(next.family, snap.family);
  if (familyFingerprint(next.family) !== familyFingerprint(nextFamily)) {
    next.family = nextFamily;
    changed = true;
  }

  const pass = snap.passport || parseMemberPassport(null);
  const emergency = formatEmergencyContact(pass);
  if (emergency && next.emergency_contact !== emergency) {
    next.emergency_contact = emergency;
    changed = true;
  }
  if (pass.share_health_with_advisors !== false) {
    const health = healthFromPassport(pass);
    const prevHealth = next.health || {};
    const healthSame =
      Boolean(prevHealth.injured) === Boolean(health.injured) &&
      String(prevHealth.injury_notes || '') === String(health.injury_notes || '') &&
      String(prevHealth.training_modifications || '') ===
        String(health.training_modifications || '') &&
      String(prevHealth.goals || '') === String(health.goals || '');
    if (!healthSame) {
      next.health = { ...prevHealth, ...health };
      changed = true;
    }
    const medical = {
      ...(emptyMedicalRecord() as Record<string, unknown>),
      ...(next.medical && typeof next.medical === 'object'
        ? next.medical
        : {}),
    };
    if (snap.id_number) medical.id_number = snap.id_number;
    if (pass.date_of_birth) medical.date_of_birth = pass.date_of_birth;
    if (pass.sex) medical.gender = pass.sex;
    const addr = formatAddress(pass);
    if (addr) medical.address = addr;
    if (pass.emergency_name) medical.next_of_kin = pass.emergency_name;
    if (pass.emergency_phone) medical.next_of_kin_phone = pass.emergency_phone;
    if (pass.gp_name) medical.gp_name = pass.gp_name;
    if (pass.gp_phone) medical.gp_phone = pass.gp_phone;
    if (pass.allergies) medical.allergies = pass.allergies;
    if (pass.chronic_conditions) medical.chronic_conditions = pass.chronic_conditions;
    if (pass.medications) medical.current_meds = pass.medications;
    medical.medical_aid = {
      ...((medical.medical_aid as object) || {}),
      ...(pass.medical_aid_scheme
        ? { scheme_name: pass.medical_aid_scheme }
        : {}),
      ...(pass.medical_aid_plan ? { plan_name: pass.medical_aid_plan } : {}),
      ...(pass.medical_aid_number
        ? { membership_number: pass.medical_aid_number }
        : {}),
      ...(pass.medical_aid_dependent
        ? { dependent_code: pass.medical_aid_dependent }
        : {}),
    };
    if (JSON.stringify(next.medical || {}) !== JSON.stringify(medical)) {
      next.medical = medical;
      changed = true;
    }
  }
  const hasPassport = Object.values(pass).some(
    (v) => v != null && v !== '' && v !== false
  );
  if (hasPassport) {
    const prevPass = JSON.stringify(next.passport || {});
    const nextPass = JSON.stringify({ ...(next.passport || {}), ...pass });
    if (prevPass !== nextPass) {
      next.passport = { ...(next.passport || {}), ...pass };
      changed = true;
    }
  }
  if (pass.date_of_birth && next.date_of_birth !== pass.date_of_birth) {
    next.date_of_birth = pass.date_of_birth;
    changed = true;
  }
  if (pass.emergency_name && next.next_of_kin !== pass.emergency_name) {
    next.next_of_kin = pass.emergency_name;
    changed = true;
  }
  if (pass.emergency_phone && next.next_of_kin_phone !== pass.emergency_phone) {
    next.next_of_kin_phone = pass.emergency_phone;
    changed = true;
  }
  if (
    pass.emergency_relationship &&
    next.next_of_kin_relationship !== pass.emergency_relationship
  ) {
    next.next_of_kin_relationship = pass.emergency_relationship;
    changed = true;
  }
  if (pass.popia_consent && !next.popia_consent_at) {
    next.popia_consent_at = new Date().toISOString();
    changed = true;
  }

  if (changed) next.updated_at = new Date().toISOString();
  return { person: next, changed };
}

export function absorbPersonIntoSnapshot(
  snap: WalletHouseholdSnapshot,
  person: DeskPerson
): WalletHouseholdSnapshot {
  const next: WalletHouseholdSnapshot = { ...snap, family: [...snap.family] };
  if (!next.full_name && !isPlaceholderName(person.name)) {
    next.full_name = person.name || null;
  }
  if (!next.email && person.email) next.email = person.email;
  if (!next.phone && person.phone) next.phone = person.phone;
  if (!next.photo_url && person.photo_url) next.photo_url = person.photo_url;
  const personId = person.id_number || person.medical?.id_number;
  if (!next.id_number && personId) next.id_number = String(personId);
  if (
    person.identity?.status === 'verified' &&
    next.identity?.status !== 'verified'
  ) {
    next.identity = person.identity;
  }
  next.family = mergeFamilyLists(next.family, person.family);
  return next;
}

export function applySnapshotToProfile(
  profile: B2cProfile,
  snap: WalletHouseholdSnapshot
): B2cProfile {
  const metadata = { ...(profile.metadata || {}) };
  if (snap.identity) metadata.identity = snap.identity;
  metadata.family = snap.family;
  if (snap.city != null) metadata.city = snap.city;
  if (snap.id_number != null) metadata.id_number = snap.id_number;
  if (snap.passport) metadata.passport = snap.passport;
  return {
    ...profile,
    full_name: snap.full_name ?? profile.full_name,
    email: snap.email ?? profile.email,
    phone: snap.phone ?? profile.phone,
    photo_url: snap.photo_url ?? profile.photo_url,
    city: snap.city ?? profile.city,
    id_number: snap.id_number ?? profile.id_number,
    family: snap.family,
    metadata,
  };
}

function snapshotEquals(
  a: WalletHouseholdSnapshot,
  b: WalletHouseholdSnapshot
): boolean {
  return (
    a.full_name === b.full_name &&
    a.email === b.email &&
    a.phone === b.phone &&
    a.photo_url === b.photo_url &&
    a.city === b.city &&
    a.id_number === b.id_number &&
    familyFingerprint(a.family) === familyFingerprint(b.family) &&
    (a.identity?.status || '') === (b.identity?.status || '')
  );
}

function membershipDeskKind(m: B2cMembership): DeskKind | null {
  if (m.kind === 'gym') return 'gym';
  if (
    m.kind === 'physio' ||
    m.kind === 'dental' ||
    m.kind === 'medical' ||
    m.kind === 'psychiatry' ||
    m.kind === 'vet'
  ) {
    return m.kind;
  }
  return null;
}

type DeskBundle = {
  kind: DeskKind;
  people: DeskPerson[];
  write: (people: DeskPerson[]) => Record<string, unknown>;
};

function deskBundle(
  meta: Record<string, unknown>,
  kind: DeskKind
): DeskBundle {
  if (kind === 'gym') {
    const store = readFitgraphFromMetadata(meta);
    return {
      kind,
      people: (store.clients || []) as DeskPerson[],
      write: (people) => {
        store.clients = people as typeof store.clients;
        return writeFitgraphToMetadata(meta, store);
      },
    };
  }
  if (kind === 'physio') {
    const store = readPhysiographFromMetadata(meta);
    return {
      kind,
      people: (store.patients || []) as DeskPerson[],
      write: (people) => {
        store.patients = people as typeof store.patients;
        return writePhysiographToMetadata(meta, store);
      },
    };
  }
  if (kind === 'dental') {
    const store = readDentalgraphFromMetadata(meta);
    return {
      kind,
      people: (store.patients || []) as DeskPerson[],
      write: (people) => {
        store.patients = people as typeof store.patients;
        return writeDentalgraphToMetadata(meta, store);
      },
    };
  }
  if (kind === 'medical') {
    const store = readMedicalgraphFromMetadata(meta);
    return {
      kind,
      people: (store.patients || []) as DeskPerson[],
      write: (people) => {
        store.patients = people as typeof store.patients;
        return writeMedicalgraphToMetadata(meta, store);
      },
    };
  }
  if (kind === 'vet') {
    const store = readVetgraphFromMetadata(meta);
    return {
      kind,
      people: (store.patients || []) as DeskPerson[],
      write: (people) => {
        store.patients = people as typeof store.patients;
        return writeVetgraphToMetadata(meta, store);
      },
    };
  }
  const store = readPsychiatrygraphFromMetadata(meta);
  return {
    kind,
    people: (store.patients || []) as DeskPerson[],
    write: (people) => {
      store.patients = people as typeof store.patients;
      return writePsychiatrygraphToMetadata(meta, store);
    },
  };
}

function matchDeskPerson(
  people: DeskPerson[],
  opts: {
    refId?: string | null;
    userId?: string | null;
    email?: string | null;
    phone?: string | null;
  }
): DeskPerson | null {
  if (opts.refId) {
    const hit = people.find((p) => p.id === opts.refId);
    if (hit) return hit;
  }
  if (opts.userId) {
    const hit = people.find((p) => p.platform_user_id === opts.userId);
    if (hit) return hit;
  }
  return (
    people.find(
      (p) =>
        emailsMatch(p.email, opts.email) || phonesMatch(p.phone, opts.phone)
    ) || null
  );
}

export async function refreshWalletHousehold(
  profile: B2cProfile,
  opts?: {
    extraCompanyIds?: number[];
    push?: boolean;
  }
): Promise<B2cProfile> {
  let snap = snapshotFromProfile(profile);
  const seen = new Set<string>();

  const targets: Array<{
    companyId: number;
    kind?: DeskKind;
    refId?: string | null;
  }> = [];

  for (const m of profile.memberships || []) {
    if (m.active === false) continue;
    const kind = membershipDeskKind(m);
    if (!kind) continue;
    targets.push({
      companyId: m.company_id,
      kind,
      refId: m.ref_id,
    });
  }
  for (const id of opts?.extraCompanyIds || []) {
    if (!Number.isFinite(id) || id <= 0) continue;
    targets.push({ companyId: id });
  }

  for (const t of targets) {
    const company = await loadWalletCompany(t.companyId);
    if (!company) continue;
    const kinds = t.kind ? [t.kind] : DESK_KINDS;
    for (const kind of kinds) {
      const key = `${company.id}:${kind}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const bundle = deskBundle(company.meta, kind);
      const person = matchDeskPerson(bundle.people, {
        refId: t.refId,
        userId: profile.user_id,
        email: profile.email,
        phone: profile.phone,
      });
      if (!person) continue;
      snap = absorbPersonIntoSnapshot(snap, person);
    }
  }

  const next = applySnapshotToProfile(profile, snap);
  const dirty = !snapshotEquals(snapshotFromProfile(profile), snap);
  if (dirty) await saveB2cProfile(next);
  if (opts?.push) {
    await pushHouseholdToLinkedDesks(next, opts.extraCompanyIds);
  }
  return next;
}

export async function pushHouseholdToLinkedDesks(
  profile: B2cProfile,
  extraCompanyIds?: number[]
): Promise<number> {
  const snap = snapshotFromProfile(profile);
  const seen = new Set<string>();
  let stamped = 0;

  const targets: Array<{
    companyId: number;
    kind?: DeskKind;
    refId?: string | null;
  }> = [];
  for (const m of profile.memberships || []) {
    if (m.active === false) continue;
    const kind = membershipDeskKind(m);
    if (!kind) continue;
    targets.push({ companyId: m.company_id, kind, refId: m.ref_id });
  }
  for (const id of extraCompanyIds || []) {
    if (Number.isFinite(id) && id > 0) targets.push({ companyId: id });
  }

  for (const t of targets) {
    const company = await loadWalletCompany(t.companyId);
    if (!company) continue;
    const kinds = t.kind ? [t.kind] : DESK_KINDS;
    let meta = company.meta;
    let companyDirty = false;
    for (const kind of kinds) {
      const key = `${company.id}:${kind}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const bundle = deskBundle(meta, kind);
      const person = matchDeskPerson(bundle.people, {
        refId: t.refId,
        userId: profile.user_id,
        email: snap.email,
        phone: snap.phone,
      });
      if (!person) continue;
      const applied = applySnapshotToPerson(person, snap, {
        preferWallet: true,
      });
      if (!applied.changed) continue;
      const idx = bundle.people.findIndex((p) => p.id === person.id);
      if (idx < 0) continue;
      const people = [...bundle.people];
      people[idx] = applied.person;
      meta = bundle.write(people);
      companyDirty = true;
      stamped += 1;
    }
    if (companyDirty) await saveWalletCompanyMeta(company.id, meta);
  }
  return stamped;
}

export async function stampSnapshotOnPerson<T extends DeskPerson>(
  person: T,
  profile: B2cProfile
): Promise<T> {
  const snap = snapshotFromProfile(profile);
  return applySnapshotToPerson(person, snap, { preferWallet: true }).person;
}

async function resolveWalletProfile(opts: {
  userId?: string | null;
  email?: string | null;
}): Promise<B2cProfile | null> {
  if (opts.userId) {
    const byId = await loadB2cProfile(opts.userId);
    if (byId) return byId;
  }
  if (opts.email) return loadB2cProfileByEmail(opts.email);
  return null;
}

export async function hydratePersonFromWallet<T extends DeskPerson>(
  person: T,
  opts?: { userId?: string | null; email?: string | null }
): Promise<{ person: T; changed: boolean }> {
  const profile = await resolveWalletProfile({
    userId: opts?.userId || person.platform_user_id,
    email: opts?.email || person.email,
  });
  if (!profile) return { person, changed: false };
  const refreshed = await refreshWalletHousehold(profile, { push: false });
  const extra = absorbPersonIntoSnapshot(
    snapshotFromProfile(refreshed),
    person
  );
  const withDesk = applySnapshotToProfile(refreshed, extra);
  if (!snapshotEquals(snapshotFromProfile(refreshed), extra)) {
    await saveB2cProfile(withDesk);
  }
  return applySnapshotToPerson(person, extra, { preferWallet: true });
}

export async function maybeHydratePortalPerson<T extends DeskPerson>(
  request: NextRequest,
  person: T
): Promise<{ person: T; changed: boolean }> {
  let userId: string | null = person.platform_user_id || null;
  try {
    const { requireVerifiedUser, legacyPrivyFrom } = await import(
      '@/lib/auth/api-auth'
    );
    const gate = await requireVerifiedUser(request, {
      legacyPrivyUserId: legacyPrivyFrom(request),
    });
    if (gate.ok && gate.userId) userId = gate.userId;
  } catch {
    /* portal works without login */
  }
  let next = person;
  let changed = false;
  if (userId && next.platform_user_id !== userId) {
    linkPlatformUserId(next, userId);
    changed = true;
  }
  const hydrated = await hydratePersonFromWallet(next, {
    userId,
    email: next.email,
  });
  return {
    person: hydrated.person,
    changed: changed || hydrated.changed,
  };
}

/** Copy desk identity (including photo) onto the SA Member wallet profile. */
export function mergeDeskIdentityIntoProfile(
  profile: B2cProfile,
  person: DeskPerson
): B2cProfile {
  let next = { ...profile };
  if (person.name && !isPlaceholderName(person.name)) {
    next.full_name = person.name;
  }
  if (person.email) next.email = person.email;
  if (person.phone) next.phone = person.phone;
  if (person.photo_url) next.photo_url = person.photo_url;
  const id = person.id_number || person.medical?.id_number;
  if (id) next.id_number = String(id);
  if (person.identity) {
    next = {
      ...next,
      metadata: { ...(next.metadata || {}), identity: person.identity },
    };
  }
  return next;
}

export async function writeThroughPortalIdentity(
  person: DeskPerson
): Promise<void> {
  let profile = await resolveWalletProfile({
    userId: person.platform_user_id,
    email: person.email,
  });
  if (!profile && person.platform_user_id) {
    profile = await ensureB2cProfile(person.platform_user_id, {
      email: person.email || null,
      full_name: person.name || null,
      phone: person.phone || null,
    });
  }
  if (!profile) return;
  const next = mergeDeskIdentityIntoProfile(profile, person);
  await saveB2cProfile(next);
  await pushHouseholdToLinkedDesks(next);
}

export async function writeThroughFamilyUpsert(
  person: DeskPerson,
  member: FamilyMember
): Promise<void> {
  const profile = await resolveWalletProfile({
    userId: person.platform_user_id,
    email: person.email,
  });
  if (!profile) return;
  const { list } = upsertFamilyMember(
    snapshotFromProfile(profile).family,
    member as unknown as Record<string, unknown>
  );
  const next = applySnapshotToProfile(profile, {
    ...snapshotFromProfile(profile),
    family: list,
  });
  await saveB2cProfile(next);
  await pushHouseholdToLinkedDesks(next);
}

export async function writeThroughFamilyRemove(
  person: DeskPerson,
  memberId: string
): Promise<void> {
  const profile = await resolveWalletProfile({
    userId: person.platform_user_id,
    email: person.email,
  });
  if (!profile) return;
  const list = removeFamilyMember(snapshotFromProfile(profile).family, memberId);
  const next = applySnapshotToProfile(profile, {
    ...snapshotFromProfile(profile),
    family: list,
  });
  await saveB2cProfile(next);
  await pushHouseholdToLinkedDesks(next);
}
