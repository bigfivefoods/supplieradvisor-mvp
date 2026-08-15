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
  hasConsumerDesk,
  hasMetaModule,
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
  gymCheckinPath,
  issueClientPortalToken,
  newId as newFitId,
  readFitgraphFromMetadata,
  writeFitgraphToMetadata,
} from '@/lib/fitness/fitgraph';
import {
  hireCustomerPortalPath,
  issueCustomerPortal,
  readHiregraphFromMetadata,
  writeHiregraphToMetadata,
} from '@/lib/hire/hiregraph';
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
  if (theyOperate && !hasConsumerDesk(company.meta)) {
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
  for (const clinic of ['physio', 'dental', 'medical', 'psychiatry'] as const) {
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

async function joinGym(opts: {
  company: CompanyRow;
  profile: Awaited<ReturnType<typeof ensureB2cProfile>>;
  userId: string;
  email: string | null;
  phone: string | null;
  displayName: string;
}) {
  const store = readFitgraphFromMetadata(opts.company.meta);
  let client = (store.clients || []).find(
    (c) =>
      c.active !== false &&
      personMatch(c, opts.email, opts.phone, opts.userId)
  );
  const now = new Date().toISOString();
  if (!client) {
    client = {
      id: newFitId('cli'),
      code: `M${Date.now().toString(36).slice(-5).toUpperCase()}`,
      name: opts.displayName,
      email: opts.email || undefined,
      phone: opts.phone || undefined,
      membership_status: 'active',
      start_date: now.slice(0, 10),
      active: true,
      created_at: now,
      updated_at: now,
    };
    store.clients = [...(store.clients || []), client];
  }
  if (!client.portal_token) {
    client.portal_token = issueClientPortalToken(opts.company.id);
  }
  linkPlatformUserId(client, opts.userId);
  if (opts.email && !client.email) client.email = opts.email;
  if (opts.phone && !client.phone) client.phone = opts.phone;
  if (!client.name) client.name = opts.displayName;
  client = await stampSnapshotOnPerson(client, opts.profile);
  client.invite_status = 'accepted';
  client.invite_accepted_at = now;
  client.updated_at = now;
  if (!client.created_at) client.created_at = now;
  const ci = store.clients.findIndex((c) => c.id === client!.id);
  if (ci >= 0) store.clients[ci] = client;
  const meta = writeFitgraphToMetadata(opts.company.meta, store);
  await saveMeta(opts.company.id, meta);

  const brand = store.settings?.brand_name || opts.company.name;
  const caps: B2cCapability[] = [
    'book',
    'checkin',
    'messages',
    'review',
    'track',
  ];
  const membership = {
    kind: 'gym' as const,
    company_id: opts.company.id,
    company_name: opts.company.name,
    brand,
    portal_token: client.portal_token,
    portal_path: `/member/fitgraph/${encodeURIComponent(client.portal_token!)}`,
    checkin_path: store.settings?.public_token
      ? gymCheckinPath(store.settings.public_token)
      : null,
    ref_id: client.id,
    ref_label: client.name,
    email: client.email || opts.email,
    capabilities: caps,
    active: true,
  };
  const next = upsertMembership(opts.profile, membership);
  await saveB2cProfile(next);
  void indexBrandPerson({
    kind: 'gym',
    companyId: opts.company.id,
    companyName: opts.company.name,
    brand,
    refId: client.id,
    refLabel: client.name,
    email: client.email || opts.email,
    phone: client.phone || opts.phone,
    portalToken: client.portal_token,
    portalPath: membership.portal_path,
    checkinPath: membership.checkin_path,
    capabilities: caps,
  });
  return {
    membership: next.memberships.find(
      (m) => m.company_id === opts.company.id && m.kind === 'gym'
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
): { patients: T[]; person: T } {
  const now = new Date().toISOString();
  let person = patients.find(
    (p) =>
      p.active !== false &&
      personMatch(p, opts.email, opts.phone, opts.userId)
  );
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
  if (!person.portal_token) person.portal_token = opts.issueToken();
  linkPlatformUserId(person, opts.userId);
  if (opts.email && !person.email) person.email = opts.email;
  if (opts.phone && !person.phone) person.phone = opts.phone;
  const pi = patients.findIndex((p) => p.id === person!.id);
  if (pi >= 0) patients[pi] = person;
  return { patients, person };
}

async function finishClinicJoin(opts: {
  company: CompanyRow;
  profile: Awaited<ReturnType<typeof ensureB2cProfile>>;
  kind: 'physio' | 'dental' | 'medical' | 'psychiatry';
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
  kind: 'physio' | 'dental' | 'medical' | 'psychiatry';
}) {
  const shared = {
    userId: opts.userId,
    email: opts.email,
    phone: opts.phone,
    displayName: opts.displayName,
  };

  if (opts.kind === 'physio') {
    const store = readPhysiographFromMetadata(opts.company.meta);
    const { patients, person } = upsertClinicPatient(store.patients || [], {
      ...shared,
      newId: () => newPhysioId('pat'),
      issueToken: () => issuePhysioToken(opts.company.id),
    });
    const stamped = await stampSnapshotOnPerson(person, opts.profile);
    store.patients = patients.map((p) => (p.id === stamped.id ? stamped : p));
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
    const { patients, person } = upsertClinicPatient(store.patients || [], {
      ...shared,
      newId: () => newDentalId('pat'),
      issueToken: () => issueDentalPatientPortalToken(opts.company.id),
    });
    const stamped = await stampSnapshotOnPerson(person, opts.profile);
    store.patients = patients.map((p) => (p.id === stamped.id ? stamped : p));
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
    const { patients, person } = upsertClinicPatient(store.patients || [], {
      ...shared,
      newId: () => newMedicalId('pat'),
      issueToken: () => issueMedicalToken(opts.company.id),
    });
    const stamped = await stampSnapshotOnPerson(person, opts.profile);
    store.patients = patients.map((p) => (p.id === stamped.id ? stamped : p));
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

  const store = readPsychiatrygraphFromMetadata(opts.company.meta);
  const { patients, person } = upsertClinicPatient(store.patients || [], {
    ...shared,
    newId: () => newPsychiatryId('pat'),
    issueToken: () => issuePsychiatryToken(opts.company.id),
  });
  const stamped = await stampSnapshotOnPerson(person, opts.profile);
  store.patients = patients.map((p) => (p.id === stamped.id ? stamped : p));
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
  if (opts.email) {
    const { data } = await supabase
      .from('customers')
      .select('id, email, phone, contact_name, trading_name')
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
  }

  let store = readHiregraphFromMetadata(opts.company.meta);
  const issued = issueCustomerPortal(store, crmId, {
    companyId: opts.company.id,
    invite_email: opts.email,
  });
  store = issued.store;
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
