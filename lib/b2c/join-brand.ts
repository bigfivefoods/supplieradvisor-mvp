/**
 * Accept a desk / poster QR invite and become a member of that brand.
 * Scan → sign in → Accept → gym client / clinic patient / hire customer + SA Member card.
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

type CompanyRow = {
  id: number;
  name: string;
  meta: Record<string, unknown>;
};

async function loadCompany(companyId: number): Promise<CompanyRow | null> {
  const supabase = getSupabaseServer();
  const { data } = await supabase
    .from('profiles')
    .select('id, trading_name, legal_name, company_name, name, metadata')
    .eq('id', companyId)
    .maybeSingle();
  if (!data) return null;
  const meta =
    data.metadata && typeof data.metadata === 'object'
      ? { ...(data.metadata as Record<string, unknown>) }
      : {};
  return {
    id: Number(data.id),
    name: String(
      data.trading_name ||
        data.legal_name ||
        data.company_name ||
        data.name ||
        `Company #${data.id}`
    ),
    meta,
  };
}

async function saveMeta(companyId: number, meta: Record<string, unknown>) {
  const supabase = getSupabaseServer();
  await supabase
    .from('profiles')
    .update({ metadata: meta, updated_at: new Date().toISOString() })
    .eq('id', companyId);
}

function personMatch(
  person: { email?: string | null; phone?: string | null; platform_user_id?: string | null },
  email: string | null,
  phone: string | null,
  userId: string
) {
  if (person.platform_user_id && person.platform_user_id === userId) return true;
  return emailsMatch(person.email, email) || phonesMatch(person.phone, phone);
}

export async function previewBrandJoin(opts: {
  companyId: number;
  kind?: string | null;
}): Promise<{
  company_id: number;
  company_name: string;
  brand: string;
  kind: string;
} | null> {
  const company = await loadCompany(opts.companyId);
  if (!company) return null;
  const kind = String(opts.kind || 'gym').toLowerCase();
  let brand = company.name;
  if (kind === 'gym') {
    brand = readFitgraphFromMetadata(company.meta).settings?.brand_name || brand;
  } else if (kind === 'hire') {
    brand = readHiregraphFromMetadata(company.meta).settings?.brand_name || brand;
  } else if (kind === 'physio') {
    brand =
      readPhysiographFromMetadata(company.meta).settings?.brand_name || brand;
  } else if (kind === 'dental') {
    brand =
      readDentalgraphFromMetadata(company.meta).settings?.brand_name || brand;
  } else if (kind === 'medical') {
    brand =
      readMedicalgraphFromMetadata(company.meta).settings?.brand_name || brand;
  } else if (kind === 'psychiatry') {
    brand =
      readPsychiatrygraphFromMetadata(company.meta).settings?.brand_name ||
      brand;
  }
  return {
    company_id: company.id,
    company_name: company.name,
    brand,
    kind,
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
  profile: Awaited<ReturnType<typeof ensureB2cProfile>>;
}> {
  const company = await loadCompany(opts.companyId);
  if (!company) {
    throw new Error('That brand could not be found');
  }
  const kind = String(opts.kind || 'gym').toLowerCase();
  const profile = await ensureB2cProfile(opts.userId, {
    email: opts.email,
    full_name: opts.full_name,
    phone: opts.phone,
  });
  const email = opts.email || profile.email || null;
  const phone = opts.phone || profile.phone || null;
  const displayName =
    opts.full_name || profile.full_name || email?.split('@')[0] || 'Member';

  const existing = (profile.memberships || []).find(
    (m) =>
      m.active !== false &&
      m.company_id === company.id &&
      (m.kind === kind || (!opts.kind && m.kind === 'gym'))
  );
  if (existing) {
    return {
      membership: existing,
      already: true,
      brand: existing.brand || company.name,
      profile,
    };
  }

  if (kind === 'gym') {
    return joinGym({ company, profile, userId: opts.userId, email, phone, displayName });
  }
  if (kind === 'hire') {
    return joinHire({ company, profile, userId: opts.userId, email, phone, displayName });
  }
  if (['physio', 'dental', 'medical', 'psychiatry'].includes(kind)) {
    return joinClinic({
      company,
      profile,
      userId: opts.userId,
      email,
      phone,
      displayName,
      kind: kind as 'physio' | 'dental' | 'medical' | 'psychiatry',
    });
  }
  throw new Error('This invite is not a gym, clinic or hire brand');
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
    store.patients = patients;
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
      person,
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
    store.patients = patients;
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
      person,
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
    store.patients = patients;
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
      person,
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
  store.patients = patients;
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
    person,
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
