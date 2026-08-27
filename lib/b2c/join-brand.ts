/**
 * Link a personal SA Member wallet to any company on the platform.
 * Always creates a CRM customer (the account). Advisor desks the
 * company actually runs are attached as extra cards (gym, hire, clinic).
 */
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { emailsMatch, phonesMatch } from '@/lib/b2c/member-app';
import { linkPlatformUserId } from '@/lib/messaging/link-platform-user';
import {
  ensureB2cProfile,
  saveB2cProfile,
  upsertMembership,
} from '@/lib/b2c/profile-store';
import { indexBrandPerson } from '@/lib/b2c/directory';
import type { B2cCapability, B2cMembership, B2cMembershipKind } from '@/lib/b2c/types';
import {
  detectCompanyModules,
  hasPersonalWalletDesk,
  hasMetaModule,
  isHiddenPersonalWalletCompany,
  walletModulesForCompany,
} from '@/lib/b2c/company-modules';
import { shopHref } from '@/lib/b2c/wallet-accounts';
import {
  loadWalletCompany,
  saveWalletCompanyMeta,
  type WalletCompany,
} from '@/lib/b2c/load-company';
import {
  isOperatorCompany,
  loadBusinessWorkspaceSummary,
} from '@/lib/b2c/workspace';
import {
  refreshWalletHousehold,
  stampSnapshotOnPerson,
} from '@/lib/b2c/wallet-household';
import {
  readFitgraphFromMetadata,
  writeFitgraphToMetadata,
} from '@/lib/fitness/fitgraph';
import {
  linkGymPersonToPwa,
  preferredGymPwaLink,
  type GymPwaLink,
} from '@/lib/fitness/gym-pwa-roster';
import { appendJoinEvent } from '@/lib/fitness/member-profile';
import {
  applyWalletToHirePortal,
  hireCustomerPortalPath,
  issueCustomerPortal,
  readHiregraphFromMetadata,
  writeHiregraphToMetadata,
} from '@/lib/hire/hiregraph';
import { identityFromProfile } from '@/lib/b2c/identity';
import {
  issueRetailCustomerPortal,
  newRetailId,
  readRetailgraphFromMetadata,
  retailCustomerPortalPath,
  writeRetailgraphToMetadata,
} from '@/lib/retail/retailgraph';
import {
  issuePatientPortalToken as issuePhysioToken,
  newId as newPhysioId,
  readPhysiographFromMetadata,
  writePhysiographToMetadata,
} from '@/lib/clinic/physiograph';
import {
  issueDentalPatientPortalToken,
  newId as newDentalId,
  readDentalgraphFromMetadata,
  writeDentalgraphToMetadata,
} from '@/lib/dental/dentalgraph';
import {
  issuePatientPortalToken as issueMedicalToken,
  newId as newMedicalId,
  readMedicalgraphFromMetadata,
  writeMedicalgraphToMetadata,
} from '@/lib/clinic/medicalgraph';
import {
  issuePatientPortalToken as issuePsychiatryToken,
  newId as newPsychiatryId,
  readPsychiatrygraphFromMetadata,
  writePsychiatrygraphToMetadata,
} from '@/lib/clinic/psychiatrygraph';
import {
  issuePatientPortalToken as issueVetToken,
  newId as newVetId,
  readVetgraphFromMetadata,
  writeVetgraphToMetadata,
} from '@/lib/clinic/vetgraph';
import {
  markPatientJoined,
  newDeskNotice,
  pushDeskNotice,
} from '@/lib/services/advisor-member-calendar';

export type JoinKind = B2cMembershipKind;

type CompanyRow = WalletCompany;

const loadCompany = loadWalletCompany;
const saveMeta = saveWalletCompanyMeta;

function personMatch(
  person: { email?: string | null; phone?: string | null; platform_user_id?: string | null },
  email: string | null,
  phone: string | null,
  userId: string
) {
  if (person.platform_user_id && person.platform_user_id === userId) return true;
  return emailsMatch(person.email, email) || phonesMatch(person.phone, phone);
}

function brandFromCompany(company: CompanyRow, hint?: string | null): string {
  const kind = String(hint || '').toLowerCase();
  if (kind === 'gym' || hasMetaModule(company.meta, 'fitgraph')) {
    return (
      readFitgraphFromMetadata(company.meta).settings?.brand_name || company.name
    );
  }
  if (kind === 'hire' || hasMetaModule(company.meta, 'hiregraph')) {
    return (
      readHiregraphFromMetadata(company.meta).settings?.brand_name || company.name
    );
  }
  if (kind === 'retail' || hasMetaModule(company.meta, 'retailgraph')) {
    return (
      readRetailgraphFromMetadata(company.meta).settings?.brand_name ||
      company.name
    );
  }
  if (kind === 'physio' || hasMetaModule(company.meta, 'physiograph')) {
    return (
      readPhysiographFromMetadata(company.meta).settings?.brand_name ||
      company.name
    );
  }
  if (kind === 'dental' || hasMetaModule(company.meta, 'dentalgraph')) {
    return (
      readDentalgraphFromMetadata(company.meta).settings?.brand_name ||
      company.name
    );
  }
  if (kind === 'medical' || hasMetaModule(company.meta, 'medicalgraph')) {
    return (
      readMedicalgraphFromMetadata(company.meta).settings?.brand_name ||
      company.name
    );
  }
  if (kind === 'vet' || hasMetaModule(company.meta, 'vetgraph')) {
    return (
      readVetgraphFromMetadata(company.meta).settings?.brand_name ||
      company.name
    );
  }
  if (kind === 'psychiatry' || hasMetaModule(company.meta, 'psychiatrygraph')) {
    return (
      readPsychiatrygraphFromMetadata(company.meta).settings?.brand_name ||
      company.name
    );
  }
  return company.name;
}

export async function previewBrandJoin(opts: {
  companyId: number;
  kind?: string | null;
}): Promise<{
  company_id: number;
  company_name: string;
  brand: string;
  kind: string;
  modules: B2cMembershipKind[];
} | null> {
  const company = await loadCompany(opts.companyId);
  if (!company) return null;
  const modules = walletModulesForCompany(company.meta);
  return {
    company_id: company.id,
    company_name: company.name,
    brand: brandFromCompany(company, opts.kind),
    kind: String(opts.kind || modules.find((k) => k !== 'account') || 'account').toLowerCase(),
    modules,
  };
}

export async function acceptBrandJoin(opts: {
  userId: string;
  companyId: number;
  kind?: string | null;
  email?: string | null;
  full_name?: string | null;
  phone?: string | null;
}): Promise<{
  membership: B2cMembership;
  already: boolean;
  brand: string;
  modules: B2cMembershipKind[];
  profile: Awaited<ReturnType<typeof ensureB2cProfile>>;
}> {
  const company = await loadCompany(opts.companyId);
  if (!company) {
    throw new Error('That brand could not be found');
  }
  const workspace = await loadBusinessWorkspaceSummary(opts.userId).catch(
    () => null
  );
  const theyOperate = Boolean(
    workspace && isOperatorCompany(workspace, company.id)
  );
  if (
    isHiddenPersonalWalletCompany({
      company_id: company.id,
      name: company.name,
    })
  ) {
    throw new Error(
      `${company.name} is a company you operate. Open it from Switch to business — it is not added to your personal member app.`
    );
  }
  if (theyOperate && !hasPersonalWalletDesk(company.meta)) {
    throw new Error(
      `${company.name} is a company you operate. Open it from Switch to business. Link it here only if you also use it as a member (gym, clinic or hire).`
    );
  }
  let profile = await ensureB2cProfile(opts.userId, {
    email: opts.email,
    full_name: opts.full_name,
    phone: opts.phone,
  });
  try {
    profile = await refreshWalletHousehold(profile, {
      extraCompanyIds: workspace?.businesses?.map((b) => b.id) || [],
      push: false,
    });
  } catch {
    /* harvest is best-effort — still create the desk record */
  }
  const email = opts.email || profile.email || null;
  const phone = opts.phone || profile.phone || null;
  const displayName =
    opts.full_name || profile.full_name || email?.split('@')[0] || 'Member';
  const brand = brandFromCompany(company, opts.kind);
  const had = (profile.memberships || []).filter(
    (m) => m.active !== false && m.company_id === company.id
  );
  const ctx = {
    company,
    userId: opts.userId,
    email,
    phone,
    displayName,
  };

  const modules = detectCompanyModules(company.meta);
  const account = await ensureAccountLink({
    ...ctx,
    profile,
    brand,
    card: !theyOperate,
  });
  profile = account.profile;

  if (modules.includes('gym')) {
    const r = await joinGym({ ...ctx, profile });
    profile = r.profile;
  }
  if (modules.includes('hire')) {
    const r = await joinHire({ ...ctx, profile });
    profile = r.profile;
  }
  if (modules.includes('retail')) {
    const r = await joinRetail({ ...ctx, profile });
    profile = r.profile;
  }
  for (const clinic of ['physio', 'dental', 'medical', 'psychiatry', 'vet'] as const) {
    if (!modules.includes(clinic)) continue;
    const r = await joinClinic({ ...ctx, profile, kind: clinic });
    profile = r.profile;
  }

  const linked = (profile.memberships || []).filter(
    (m) => m.active !== false && m.company_id === company.id
  );
  const preferredKind = String(opts.kind || '').toLowerCase();
  const membership =
    linked.find((m) => m.kind === preferredKind) ||
    linked.find((m) => m.kind === 'gym') ||
    linked.find((m) => m.kind !== 'account') ||
    linked[0];
  if (!membership) {
    throw new Error('Could not link your wallet to this business');
  }
  return {
    membership,
    already: had.length > 0 && linked.length <= had.length,
    brand,
    modules: linked.map((m) => m.kind),
    profile,
  };
}

async function ensureAccountLink(opts: {
  company: CompanyRow;
  profile: Awaited<ReturnType<typeof ensureB2cProfile>>;
  userId: string;
  email: string | null;
  phone: string | null;
  displayName: string;
  brand: string;
  /** Always true for the wallet model — the account is the company link. */
  card: boolean;
}) {
  const supabase = getSupabaseServer();
  let crmId: number | null = null;
  if (opts.email) {
    const { data } = await supabase
      .from('customers')
      .select('id')
      .eq('profile_id', opts.company.id)
      .ilike('email', opts.email)
      .maybeSingle();
    if (data?.id) crmId = Number(data.id);
  }
  if (!crmId) {
    const payload = {
      profile_id: opts.company.id,
      trading_name: opts.displayName,
      contact_name: opts.displayName,
      email: opts.email,
      phone: opts.phone,
      status: 'active',
      customer_type: 'consumer',
      source: 'sa_member_wallet',
      updated_at: new Date().toISOString(),
    };
    const ins = await supabase.from('customers').insert(payload).select('id').single();
    if (ins.error) {
      const retry = await supabase
        .from('customers')
        .insert({
          profile_id: opts.company.id,
          trading_name: opts.displayName,
          email: opts.email,
          status: 'active',
        })
        .select('id')
        .single();
      if (retry.data?.id) crmId = Number(retry.data.id);
    } else if (ins.data?.id) {
      crmId = Number(ins.data.id);
    }
  }

  if (!opts.card) return { profile: opts.profile };

  const caps: B2cCapability[] = ['order', 'review', 'track'];
  const portalPath = shopHref(opts.company.id);
  const membership = {
    kind: 'account' as const,
    company_id: opts.company.id,
    company_name: opts.company.name,
    brand: opts.brand,
    portal_token: null,
    portal_path: portalPath,
    checkin_path: null,
    ref_id: crmId ? String(crmId) : `acct_${opts.company.id}`,
    ref_label: opts.displayName,
    email: opts.email,
    capabilities: caps,
    active: true,
  };
  const next = upsertMembership(opts.profile, membership);
  await saveB2cProfile(next);
  void indexBrandPerson({
    kind: 'account',
    companyId: opts.company.id,
    companyName: opts.company.name,
    brand: opts.brand,
    refId: membership.ref_id,
    refLabel: opts.displayName,
    email: opts.email,
    phone: opts.phone,
    portalPath,
    capabilities: caps,
  });
  return { profile: next };
}

function gymLinkToMembership(
  company: CompanyRow,
  brand: string,
  link: GymPwaLink,
  email: string | null
) {
  return {
    kind: 'gym' as const,
    company_id: company.id,
    company_name: company.name,
    brand,
    portal_token: link.portal_token,
    portal_path: link.portal_path,
    checkin_path: link.checkin_path,
    ref_id: link.ref_id,
    ref_label: link.ref_label,
    email: link.email || email,
    capabilities: link.capabilities,
    active: true,
  };
}

function applyGymPwaLinks(opts: {
  company: CompanyRow;
  profile: Awaited<ReturnType<typeof ensureB2cProfile>>;
  brand: string;
  links: GymPwaLink[];
  email: string | null;
  phone: string | null;
}) {
  let next = opts.profile;
  for (const link of opts.links) {
    const membership = gymLinkToMembership(
      opts.company,
      opts.brand,
      link,
      opts.email
    );
    next = upsertMembership(next, membership);
    void indexBrandPerson({
      kind: 'gym',
      companyId: opts.company.id,
      companyName: opts.company.name,
      brand: opts.brand,
      refId: link.ref_id,
      refLabel: link.ref_label,
      email: link.email || opts.email,
      phone: link.phone || opts.phone,
      portalToken: link.portal_token,
      portalPath: link.portal_path,
      checkinPath: link.checkin_path,
      capabilities: link.capabilities,
    });
  }
  return next;
}

async function joinGym(opts: {
  company: CompanyRow;
  profile: Awaited<ReturnType<typeof ensureB2cProfile>>;
  userId: string;
  email: string | null;
  phone: string | null;
  displayName: string;
}) {
  const store = readFitgraphFromMetadata(opts.company.meta);
  const now = new Date().toISOString();
  const linked = linkGymPersonToPwa(store, {
    companyId: opts.company.id,
    email: opts.email,
    phone: opts.phone,
    userId: opts.userId,
    displayName: opts.displayName,
    createIfMissing: true,
    now,
  });
  const memberLink = linked.links.find((l) => l.role === 'member');
  const coachLink = linked.links.find((l) => l.role === 'coach');
  if (coachLink) {
    const coach = store.coaches.find((c) => c.id === coachLink.ref_id);
    if (coach) linkPlatformUserId(coach, opts.userId);
  }
  if (memberLink) {
    let client = store.clients.find((c) => c.id === memberLink.ref_id);
    if (client) {
      linkPlatformUserId(client, opts.userId);
      client = await stampSnapshotOnPerson(client, opts.profile);
      client.invite_status = 'accepted';
      client.invite_accepted_at = now;
      client.join_events = appendJoinEvent(client, {
        at: now,
        kind: linked.createdMember ? 'joined_pwa' : 'wallet_linked',
        title: linked.createdMember
          ? 'Joined from SA Member'
          : 'Linked SA Member wallet',
        source: 'pwa',
      });
      client.updated_at = now;
      const ci = store.clients.findIndex((c) => c.id === client!.id);
      if (ci >= 0) store.clients[ci] = client;
      if (linked.createdMember) {
        store.desk_notices = pushDeskNotice(
          store.desk_notices,
          newDeskNotice({
            kind: 'member_joined',
            person_id: client.id,
            person_name: client.name,
            email: client.email,
            phone: client.phone,
            source: 'pwa',
            note: 'New member from SA Member',
          })
        );
      }
    }
  }
  if (!linked.links.length) {
    throw new Error('Could not link your gym profile');
  }
  const meta = writeFitgraphToMetadata(opts.company.meta, store);
  await saveMeta(opts.company.id, meta);

  const brand = store.settings?.brand_name || opts.company.name;
  const next = applyGymPwaLinks({
    company: opts.company,
    profile: opts.profile,
    brand,
    links: linked.links,
    email: opts.email,
    phone: opts.phone,
  });
  await saveB2cProfile(next);
  const preferred = preferredGymPwaLink(linked.links)!;
  return {
    membership:
      next.memberships.find(
        (m) =>
          m.company_id === opts.company.id &&
          m.kind === 'gym' &&
          m.ref_id === preferred.ref_id
      ) || next.memberships[0],
    already: false,
    brand,
    profile: next,
  };
}

type ClinicPerson = {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  portal_token?: string | null;
  platform_user_id?: string | null;
  active?: boolean;
  source?: string;
  joined_via?: string;
  desk_join_status?: string | null;
};

function upsertClinicPatient<T extends ClinicPerson>(
  patients: T[],
  opts: {
    userId: string;
    email: string | null;
    phone: string | null;
    displayName: string;
    newId: () => string;
    issueToken: () => string;
  }
): { patients: T[]; person: T; created: boolean; newlyLinked: boolean } {
  const now = new Date().toISOString();
  let person = patients.find(
    (p) =>
      p.active !== false &&
      personMatch(p, opts.email, opts.phone, opts.userId)
  );
  const created = !person;
  if (!person) {
    person = {
      id: opts.newId(),
      code: `P${Date.now().toString(36).slice(-5).toUpperCase()}`,
      name: opts.displayName,
      email: opts.email || undefined,
      phone: opts.phone || undefined,
      status: 'active',
      active: true,
      created_at: now,
      updated_at: now,
    } as unknown as T;
    patients = [...patients, person];
  }
  const newlyLinked = !person.platform_user_id;
  if (!person.portal_token) person.portal_token = opts.issueToken();
  linkPlatformUserId(person, opts.userId);
  if (opts.email && !person.email) person.email = opts.email;
  if (opts.phone && !person.phone) person.phone = opts.phone;
  const pi = patients.findIndex((p) => p.id === person!.id);
  if (pi >= 0) patients[pi] = person;
  return { patients, person, created, newlyLinked };
}

function recordClinicJoin<T extends {
  patients: ClinicPerson[];
  desk_notices?: import('@/lib/services/advisor-member-calendar').DeskMemberNotice[];
  settings?: { require_accept_join?: boolean } | null;
}>(
  store: T,
  person: ClinicPerson,
  flags: { created: boolean; newlyLinked: boolean }
): T {
  if (!flags.created && !flags.newlyLinked) return store;
  markPatientJoined(person, store.settings?.require_accept_join === true);
  store.patients = store.patients.map((p) =>
    p.id === person.id ? person : p
  );
  store.desk_notices = pushDeskNotice(
    store.desk_notices,
    newDeskNotice({
      kind: 'member_joined',
      person_id: person.id,
      person_name: person.name,
      email: person.email,
      phone: person.phone,
      source: 'pwa',
      note: flags.created
        ? 'New patient from SA Member — accept them on Patients'
        : 'Linked their SA Member wallet',
    })
  );
  return store;
}

async function finishClinicJoin(opts: {
  company: CompanyRow;
  profile: Awaited<ReturnType<typeof ensureB2cProfile>>;
  kind: 'physio' | 'dental' | 'medical' | 'psychiatry' | 'vet';
  path: string;
  brand: string;
  person: ClinicPerson;
  email: string | null;
  phone: string | null;
}) {
  const token = opts.person.portal_token;
  if (!token) throw new Error('Could not issue a patient portal');
  const caps: B2cCapability[] = ['book', 'track', 'messages', 'review', 'kyc'];
  const membership = {
    kind: opts.kind,
    company_id: opts.company.id,
    company_name: opts.company.name,
    brand: opts.brand,
    portal_token: token,
    portal_path: `/member/${opts.path}/${encodeURIComponent(token)}`,
    checkin_path: null,
    ref_id: opts.person.id,
    ref_label: opts.person.name,
    email: opts.person.email || opts.email,
    capabilities: caps,
    active: true,
  };
  const next = upsertMembership(opts.profile, membership);
  await saveB2cProfile(next);
  void indexBrandPerson({
    kind: opts.kind,
    companyId: opts.company.id,
    companyName: opts.company.name,
    brand: opts.brand,
    refId: opts.person.id,
    refLabel: opts.person.name,
    email: opts.person.email || opts.email,
    phone: opts.person.phone || opts.phone,
    portalToken: token,
    portalPath: membership.portal_path,
    capabilities: caps,
  });
  return {
    membership:
      next.memberships.find(
        (m) => m.company_id === opts.company.id && m.kind === opts.kind
      ) || next.memberships[0],
    already: false,
    brand: opts.brand,
    profile: next,
  };
}

async function joinClinic(opts: {
  company: CompanyRow;
  profile: Awaited<ReturnType<typeof ensureB2cProfile>>;
  userId: string;
  email: string | null;
  phone: string | null;
  displayName: string;
  kind: 'physio' | 'dental' | 'medical' | 'psychiatry' | 'vet';
}) {
  const shared = {
    userId: opts.userId,
    email: opts.email,
    phone: opts.phone,
    displayName: opts.displayName,
  };

  if (opts.kind === 'physio') {
    const store = readPhysiographFromMetadata(opts.company.meta);
    const { patients, person, created, newlyLinked } = upsertClinicPatient(
      store.patients || [],
      {
        ...shared,
        newId: () => newPhysioId('pat'),
        issueToken: () => issuePhysioToken(opts.company.id),
      }
    );
    const stamped = await stampSnapshotOnPerson(person, opts.profile);
    store.patients = patients.map((p) => (p.id === stamped.id ? stamped : p));
    recordClinicJoin(store, stamped, { created, newlyLinked });
    await saveMeta(
      opts.company.id,
      writePhysiographToMetadata(opts.company.meta, store)
    );
    return finishClinicJoin({
      company: opts.company,
      profile: opts.profile,
      kind: 'physio',
      path: 'physiograph',
      brand: store.settings?.brand_name || opts.company.name,
      person: stamped,
      email: opts.email,
      phone: opts.phone,
    });
  }

  if (opts.kind === 'dental') {
    const store = readDentalgraphFromMetadata(opts.company.meta);
    const { patients, person, created, newlyLinked } = upsertClinicPatient(
      store.patients || [],
      {
        ...shared,
        newId: () => newDentalId('pat'),
        issueToken: () => issueDentalPatientPortalToken(opts.company.id),
      }
    );
    const stamped = await stampSnapshotOnPerson(person, opts.profile);
    store.patients = patients.map((p) => (p.id === stamped.id ? stamped : p));
    recordClinicJoin(store, stamped, { created, newlyLinked });
    await saveMeta(
      opts.company.id,
      writeDentalgraphToMetadata(opts.company.meta, store)
    );
    return finishClinicJoin({
      company: opts.company,
      profile: opts.profile,
      kind: 'dental',
      path: 'dentalgraph',
      brand: store.settings?.brand_name || opts.company.name,
      person: stamped,
      email: opts.email,
      phone: opts.phone,
    });
  }

  if (opts.kind === 'medical') {
    const store = readMedicalgraphFromMetadata(opts.company.meta);
    const { patients, person, created, newlyLinked } = upsertClinicPatient(
      store.patients || [],
      {
        ...shared,
        newId: () => newMedicalId('pat'),
        issueToken: () => issueMedicalToken(opts.company.id),
      }
    );
    const stamped = await stampSnapshotOnPerson(person, opts.profile);
    store.patients = patients.map((p) => (p.id === stamped.id ? stamped : p));
    recordClinicJoin(store, stamped, { created, newlyLinked });
    await saveMeta(
      opts.company.id,
      writeMedicalgraphToMetadata(opts.company.meta, store)
    );
    return finishClinicJoin({
      company: opts.company,
      profile: opts.profile,
      kind: 'medical',
      path: 'medicalgraph',
      brand: store.settings?.brand_name || opts.company.name,
      person: stamped,
      email: opts.email,
      phone: opts.phone,
    });
  }

  if (opts.kind === 'vet') {
    const store = readVetgraphFromMetadata(opts.company.meta);
    const { patients, person, created, newlyLinked } = upsertClinicPatient(
      store.patients || [],
      {
        ...shared,
        newId: () => newVetId('pat'),
        issueToken: () => issueVetToken(opts.company.id),
      }
    );
    const stamped = await stampSnapshotOnPerson(person, opts.profile);
    store.patients = patients.map((p) => (p.id === stamped.id ? stamped : p));
    recordClinicJoin(store, stamped, { created, newlyLinked });
    await saveMeta(
      opts.company.id,
      writeVetgraphToMetadata(opts.company.meta, store)
    );
    return finishClinicJoin({
      company: opts.company,
      profile: opts.profile,
      kind: 'vet',
      path: 'vetgraph',
      brand: store.settings?.brand_name || opts.company.name,
      person: stamped,
      email: opts.email,
      phone: opts.phone,
    });
  }

  const store = readPsychiatrygraphFromMetadata(opts.company.meta);
  const { patients, person, created, newlyLinked } = upsertClinicPatient(
    store.patients || [],
    {
      ...shared,
      newId: () => newPsychiatryId('pat'),
      issueToken: () => issuePsychiatryToken(opts.company.id),
    }
  );
  const stamped = await stampSnapshotOnPerson(person, opts.profile);
  store.patients = patients.map((p) => (p.id === stamped.id ? stamped : p));
  recordClinicJoin(store, stamped, { created, newlyLinked });
  await saveMeta(
    opts.company.id,
    writePsychiatrygraphToMetadata(opts.company.meta, store)
  );
  return finishClinicJoin({
    company: opts.company,
    profile: opts.profile,
    kind: 'psychiatry',
    path: 'psychiatrygraph',
    brand: store.settings?.brand_name || opts.company.name,
    person: stamped,
    email: opts.email,
    phone: opts.phone,
  });
}

async function joinHire(opts: {
  company: CompanyRow;
  profile: Awaited<ReturnType<typeof ensureB2cProfile>>;
  userId: string;
  email: string | null;
  phone: string | null;
  displayName: string;
}) {
  const supabase = getSupabaseServer();
  let crmId: number | null = null;
  let existingCrm: {
    id: number;
    email?: string | null;
    phone?: string | null;
    contact_name?: string | null;
    trading_name?: string | null;
  } | null = null;
  if (opts.email) {
    const { data } = await supabase
      .from('customers')
      .select('id, email, phone, contact_name, trading_name')
      .eq('profile_id', opts.company.id)
      .ilike('email', opts.email)
      .maybeSingle();
    if (data?.id) {
      crmId = Number(data.id);
      existingCrm = {
        id: crmId,
        email: data.email,
        phone: data.phone,
        contact_name: data.contact_name,
        trading_name: data.trading_name,
      };
    }
  }
  if (!crmId) {
    const payload = {
      profile_id: opts.company.id,
      trading_name: opts.displayName,
      contact_name: opts.displayName,
      email: opts.email,
      phone: opts.phone,
      status: 'active',
      customer_type: 'consumer',
      source: 'member_app_qr',
      updated_at: new Date().toISOString(),
    };
    const ins = await supabase.from('customers').insert(payload).select('id').single();
    if (ins.error) {
      const retry = await supabase
        .from('customers')
        .insert({
          profile_id: opts.company.id,
          trading_name: opts.displayName,
          email: opts.email,
          status: 'active',
        })
        .select('id')
        .single();
      if (retry.error || !retry.data) {
        throw new Error(ins.error.message || 'Could not add you as a customer');
      }
      crmId = Number(retry.data.id);
    } else {
      crmId = Number(ins.data.id);
    }
  } else if (existingCrm) {
    const patch: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (opts.displayName && !String(existingCrm.contact_name || '').trim()) {
      patch.contact_name = opts.displayName;
    }
    if (opts.phone && !String(existingCrm.phone || '').trim()) {
      patch.phone = opts.phone;
    }
    if (opts.email && !String(existingCrm.email || '').trim()) {
      patch.email = opts.email;
    }
    if (Object.keys(patch).length > 1) {
      await supabase.from('customers').update(patch).eq('id', crmId);
    }
  }

  let store = readHiregraphFromMetadata(opts.company.meta);
  const issued = issueCustomerPortal(store, crmId, {
    companyId: opts.company.id,
    invite_email: opts.email,
  });
  store = issued.store;
  const stamped = applyWalletToHirePortal(store, crmId, {
    user_id: opts.userId,
    full_name: opts.displayName,
    email: opts.email,
    phone: opts.phone,
    photo_url: opts.profile.photo_url,
    city: opts.profile.city,
    id_number: opts.profile.id_number,
    identity: identityFromProfile(opts.profile),
  });
  store = stamped.store;
  await saveMeta(
    opts.company.id,
    writeHiregraphToMetadata(opts.company.meta, store)
  );

  const brand = store.settings?.brand_name || opts.company.name;
  const caps: B2cCapability[] = ['order', 'book', 'track', 'kyc', 'review'];
  const membership = {
    kind: 'hire' as const,
    company_id: opts.company.id,
    company_name: opts.company.name,
    brand,
    portal_token: issued.portal.portal_token,
    portal_path: hireCustomerPortalPath(issued.portal.portal_token),
    checkin_path: null,
    ref_id: String(crmId),
    ref_label: opts.displayName,
    email: opts.email,
    capabilities: caps,
    active: true,
  };
  const next = upsertMembership(opts.profile, membership);
  await saveB2cProfile(next);
  void indexBrandPerson({
    kind: 'hire',
    companyId: opts.company.id,
    companyName: opts.company.name,
    brand,
    refId: String(crmId),
    refLabel: opts.displayName,
    email: opts.email,
    phone: opts.phone,
    portalToken: issued.portal.portal_token,
    portalPath: membership.portal_path,
    capabilities: caps,
  });
  return {
    membership: next.memberships.find(
      (m) => m.company_id === opts.company.id && m.kind === 'hire'
    ) || next.memberships[0],
    already: false,
    brand,
    profile: next,
  };
}

async function joinRetail(opts: {
  company: CompanyRow;
  profile: Awaited<ReturnType<typeof ensureB2cProfile>>;
  userId: string;
  email: string | null;
  phone: string | null;
  displayName: string;
}) {
  let store = readRetailgraphFromMetadata(opts.company.meta);
  const existing = store.customers.find(
    (c) =>
      (opts.email &&
        String(c.email || '').toLowerCase() === opts.email.toLowerCase()) ||
      (opts.phone && c.phone && c.phone === opts.phone)
  );
  const customer = existing || {
    id: newRetailId('cus'),
    name: opts.displayName,
    email: opts.email,
    phone: opts.phone,
  };
  if (!existing) {
    store = {
      ...store,
      customers: [customer, ...store.customers],
    };
  }
  const issued = issueRetailCustomerPortal(store, customer.id, {
    companyId: opts.company.id,
  });
  store = issued.store;
  await saveMeta(
    opts.company.id,
    writeRetailgraphToMetadata(opts.company.meta, store)
  );
  const brand = store.settings?.brand_name || opts.company.name;
  const caps: B2cCapability[] = ['order', 'review'];
  const membership = {
    kind: 'retail' as const,
    company_id: opts.company.id,
    company_name: opts.company.name,
    brand,
    portal_token: issued.customer.portal_token || null,
    portal_path: issued.customer.portal_token
      ? retailCustomerPortalPath(issued.customer.portal_token)
      : '/me',
    checkin_path: null,
    ref_id: issued.customer.id,
    ref_label: issued.customer.name || opts.displayName,
    email: issued.customer.email || opts.email,
    capabilities: caps,
    active: true,
  };
  const next = upsertMembership(opts.profile, membership);
  await saveB2cProfile(next);
  void indexBrandPerson({
    kind: 'retail',
    companyId: opts.company.id,
    companyName: opts.company.name,
    brand,
    refId: issued.customer.id,
    refLabel: issued.customer.name || opts.displayName,
    email: issued.customer.email || opts.email,
    phone: issued.customer.phone || opts.phone,
    portalToken: issued.customer.portal_token || null,
    portalPath: membership.portal_path,
    capabilities: caps,
  });
  return {
    membership:
      next.memberships.find(
        (m) => m.company_id === opts.company.id && m.kind === 'retail'
      ) || next.memberships[0],
    already: Boolean(existing),
    brand,
    profile: next,
  };
}
