/**
 * Roster sign-in for a company PWA: name + email on the gym/clinic/hire file.
 * New people create an account on the PWA launcher and join via /api/b2c/join.
 */
import { loadAdvisorStoreForPublicToken } from '@/lib/business/advisor-store-resolve';
import { saveAdvisorModuleStore } from '@/lib/business/company-data';
import { namesMatchForPortalSignIn } from '@/lib/fitness/fitgraph';
import {
  ADVISOR_PWA_INDEX_KEYS,
  advisorPwaOpenPath,
  isAdvisorPwaModule,
  type AdvisorPwaModule,
} from '@/lib/advisors/member-pwa';
import { isSafeFilterEmail } from '@/lib/security/email-filter';

type RosterPerson = {
  id: string;
  name?: string;
  email?: string;
  invite_email?: string | null;
  work_invite_email?: string | null;
  active?: boolean;
  end_date?: string | null;
  portal_token?: string | null;
};

function rosterEmails(person: RosterPerson): string[] {
  return [person.email, person.invite_email, person.work_invite_email]
    .map((v) => String(v || '').trim().toLowerCase())
    .filter((v) => v.includes('@'));
}

function staffEngagementIsLive(
  person: RosterPerson,
  todayIso?: string
): boolean {
  if (person.active === false) return false;
  const end = String(person.end_date || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(end)) return true;
  const today = String(todayIso || new Date().toISOString().slice(0, 10)).slice(
    0,
    10
  );
  return end >= today;
}

export function findRosterPersonForSignIn<T extends RosterPerson>(
  people: T[],
  lookup: { name?: string | null; email?: string | null }
): T | null {
  const email = String(lookup.email || '').trim().toLowerCase();
  const name = String(lookup.name || '').trim();
  if (!email || !email.includes('@') || !name) return null;
  return (
    (people || []).find(
      (p) =>
        p.active !== false &&
        !p.end_date &&
        rosterEmails(p).includes(email) &&
        namesMatchForPortalSignIn(p.name, name)
    ) || null
  );
}

/** Staff/coach/practitioner access — email on the practice file is the key. */
export function resolveAdvisorPwaLane(opts: {
  expectRole?: 'staff' | 'member' | null;
  hasStaff: boolean;
  hasMember: boolean;
  staffLabel: string;
  staffListLabel: string;
}): { ok: true; lane: 'staff' | 'member' } | { ok: false; error: string } {
  const expect =
    opts.expectRole === 'staff' || opts.expectRole === 'member'
      ? opts.expectRole
      : null;
  const staffWord = opts.staffLabel.toLowerCase();
  if (expect === 'staff') {
    if (opts.hasStaff) return { ok: true, lane: 'staff' };
    if (opts.hasMember) {
      return {
        ok: false,
        error: 'That email is an SA Member. Use SA Member access.',
      };
    }
    return {
      ok: false,
      error: `We could not find that ${staffWord}. Use the name and email on ${opts.staffListLabel} in this Advisor.`,
    };
  }
  if (expect === 'member') {
    if (opts.hasMember) return { ok: true, lane: 'member' };
    if (opts.hasStaff) {
      return {
        ok: false,
        error: `That email is a ${staffWord}. Use ${opts.staffLabel} access.`,
      };
    }
    return {
      ok: false,
      error:
        'We could not find that SA Member. Use the name and email on your file, or create an account to join.',
    };
  }
  if (opts.hasStaff) return { ok: true, lane: 'staff' };
  if (opts.hasMember) return { ok: true, lane: 'member' };
  return {
    ok: false,
    error: `We could not find that ${staffWord} or SA Member. Use the name and email on your file, or create an account to join.`,
  };
}

async function matchGymCompanyOwner(
  companyId: number,
  email: string
): Promise<{ name: string } | null> {
  const key = String(email || '').trim().toLowerCase();
  if (!key.includes('@')) return null;
  const { resolveCompanyEmails } = await import('@/lib/billing/company-emails');
  const { emails, tradingName } = await resolveCompanyEmails(companyId, {
    roleAllowlist: ['owner', 'admin'],
    limit: 20,
  });
  if (!emails.includes(key)) return null;
  return { name: tradingName || 'Owner' };
}

export function findStaffForPortalSignIn<T extends RosterPerson>(
  people: T[],
  lookup: { name?: string | null; email?: string | null }
): T | null {
  const email = String(lookup.email || '').trim().toLowerCase();
  if (!email || !email.includes('@')) return null;
  const name = String(lookup.name || '').trim();
  const hits = (people || []).filter(
    (p) => staffEngagementIsLive(p) && rosterEmails(p).includes(email)
  );
  if (!hits.length) return null;
  if (hits.length === 1) return hits[0];
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (
      hits.find((p) => namesMatchForPortalSignIn(p.name, name)) || hits[0]
    );
  }
  return hits[0];
}

export type AdvisorPwaSignInOk = {
  ok: true;
  name: string;
  portal_token: string;
  path: string;
  role?: 'member' | 'coach' | 'owner' | 'patient' | 'customer' | 'practitioner';
};

export type AdvisorPwaSignInErr = {
  ok: false;
  status: number;
  error: string;
};

export async function signInAdvisorPwaMember(opts: {
  module: string;
  token: string;
  name: string;
  email: string;
  expectRole?: 'staff' | 'member' | null;
}): Promise<AdvisorPwaSignInOk | AdvisorPwaSignInErr> {
  const moduleKey = String(opts.module || '').trim();
  const token = String(opts.token || '').trim();
  const name = String(opts.name || '').trim();
  const email = String(opts.email || '').trim();
  if (!isAdvisorPwaModule(moduleKey) || token.length < 8) {
    return { ok: false, status: 404, error: 'Not found' };
  }
  if (!name || !email) {
    return {
      ok: false,
      status: 400,
      error: 'Enter the name and email on your profile at this business.',
    };
  }
  if (moduleKey === 'retailgraph') {
    return {
      ok: false,
      status: 400,
      error:
        'Create an account on this app to join — roster sign-in is for gym, clinic and hire customers.',
    };
  }

  const expectRole =
    opts.expectRole === 'staff' || opts.expectRole === 'member'
      ? opts.expectRole
      : null;
  if (moduleKey === 'hiregraph') {
    return signInHire({ token, name, email });
  }
  if (moduleKey === 'fitgraph') {
    return signInGym({ token, name, email, expectRole });
  }
  return signInClinic({ module: moduleKey, token, name, email, expectRole });
}

async function signInHire(opts: {
  token: string;
  name: string;
  email: string;
}): Promise<AdvisorPwaSignInOk | AdvisorPwaSignInErr> {
  const {
    HIREGRAPH_META_KEY,
    HIREGRAPH_PUBLIC_TOKEN_KEY,
    issueCustomerPortal,
    parseCompanyIdFromHirePublicToken,
    readHiregraphFromMetadata,
    writeHiregraphToMetadata,
  } = await import('@/lib/hire/hiregraph');
  const { getSupabaseServer } = await import('@/lib/supabase/server-client');

  const loaded = await loadAdvisorStoreForPublicToken({
    token: opts.token,
    moduleKey: HIREGRAPH_META_KEY,
    read: readHiregraphFromMetadata,
    parseCompanyId: parseCompanyIdFromHirePublicToken,
    indexKeys: [HIREGRAPH_PUBLIC_TOKEN_KEY],
  });
  if (!loaded || loaded.store.settings?.public_token !== opts.token) {
    return { ok: false, status: 404, error: 'Hire desk not found' };
  }

  const lookupEmail = opts.email.trim().toLowerCase();
  if (!isSafeFilterEmail(lookupEmail)) {
    return { ok: false, status: 400, error: 'Enter a valid email.' };
  }

  const supabase = getSupabaseServer();
  const portalIds: number[] = [];
  for (const [id, portal] of Object.entries(
    loaded.store.customer_portals || {}
  )) {
    const emails = [portal?.invite_email, portal?.preferred_email]
      .map((v) => String(v || '').trim().toLowerCase())
      .filter((v) => v.includes('@'));
    if (!emails.includes(lookupEmail)) continue;
    const n = Number(id);
    if (Number.isFinite(n) && n > 0) portalIds.push(n);
  }

  let byEmailQuery = supabase
    .from('customers')
    .select('id, trading_name, legal_name, contact_name, email, status')
    .eq('profile_id', loaded.companyId);
  byEmailQuery = lookupEmail.includes('_')
    ? byEmailQuery.in('email', [...new Set([lookupEmail, opts.email.trim()])])
    : byEmailQuery.ilike('email', lookupEmail);
  const { data: byEmail } = await byEmailQuery.limit(20);

  let byPortal: typeof byEmail = [];
  if (portalIds.length) {
    const extra = await supabase
      .from('customers')
      .select('id, trading_name, legal_name, contact_name, email, status')
      .eq('profile_id', loaded.companyId)
      .in('id', portalIds.slice(0, 20));
    byPortal = extra.data || [];
  }

  const seen = new Set<number>();
  const rows = [...(byEmail || []), ...(byPortal || [])].filter((c) => {
    const id = Number(c.id);
    if (!Number.isFinite(id) || seen.has(id)) return false;
    seen.add(id);
    return true;
  });

  const people: RosterPerson[] = [];
  for (const c of rows || []) {
    const portal = loaded.store.customer_portals?.[String(c.id)];
    const emails = {
      email: c.email ? String(c.email) : '',
      invite_email: portal?.invite_email || portal?.preferred_email || null,
      active: String(c.status || 'active').toLowerCase() !== 'blocked',
      portal_token: portal?.portal_token || null,
    };
    const names = [
      c.contact_name,
      c.trading_name,
      c.legal_name,
    ]
      .map((v) => String(v || '').trim())
      .filter(Boolean);
    const unique = [...new Set(names)];
    for (const name of unique.length ? unique : ['']) {
      people.push({
        id: String(c.id),
        name,
        ...emails,
      });
    }
  }

  const person = findRosterPersonForSignIn(people, {
    name: opts.name,
    email: opts.email,
  });
  if (!person) {
    return {
      ok: false,
      status: 404,
      error:
        'We could not find that customer. Use the name and email on your hire file, or create an account to join this app.',
    };
  }

  const crmId = Number(person.id);
  if (!Number.isFinite(crmId) || crmId <= 0) {
    return { ok: false, status: 404, error: 'Customer record is incomplete' };
  }
  let store = loaded.store;
  let portalToken = String(person.portal_token || '').trim();
  if (!portalToken) {
    const issued = issueCustomerPortal(store, crmId, {
      companyId: loaded.companyId,
      invite_email: opts.email,
    });
    store = issued.store;
    portalToken = issued.portal.portal_token;
    await saveAdvisorModuleStore(
      loaded.companyId,
      HIREGRAPH_META_KEY,
      store,
      writeHiregraphToMetadata
    );
  }

  return {
    ok: true,
    name: String(person.name || 'Customer').trim().split(/\s+/)[0],
    portal_token: portalToken,
    path: advisorPwaOpenPath('hiregraph', portalToken),
    role: 'customer',
  };
}

async function signInGym(opts: {
  token: string;
  name: string;
  email: string;
  expectRole?: 'staff' | 'member' | null;
}): Promise<AdvisorPwaSignInOk | AdvisorPwaSignInErr> {
  const {
    FITGRAPH_META_KEY,
    FITGRAPH_PUBLIC_TOKEN_KEY,
    findClientForPortalSignIn,
    findCoachForPortalSignIn,
    ensureClientPortalToken,
    ensureCoachPortalToken,
    parseCompanyIdFromToken,
    readFitgraphFromMetadata,
  } = await import('@/lib/fitness/fitgraph');
  const loaded = await loadAdvisorStoreForPublicToken({
    token: opts.token,
    moduleKey: FITGRAPH_META_KEY,
    read: readFitgraphFromMetadata,
    parseCompanyId: parseCompanyIdFromToken,
    indexKeys: [FITGRAPH_PUBLIC_TOKEN_KEY],
  });
  if (!loaded || loaded.store.settings?.public_token !== opts.token) {
    return { ok: false, status: 404, error: 'Gym not found' };
  }
  const coach = findCoachForPortalSignIn(loaded.store, {
    name: opts.name,
    email: opts.email,
  });
  const client = findClientForPortalSignIn(loaded.store, {
    name: opts.name,
    email: opts.email,
  });
  const owner = await matchGymCompanyOwner(loaded.companyId, opts.email);
  const lane = resolveAdvisorPwaLane({
    expectRole: opts.expectRole,
    hasStaff: Boolean(coach) || Boolean(owner),
    hasMember: Boolean(client),
    staffLabel: 'Coach',
    staffListLabel: 'Coaches',
  });
  if (!lane.ok) {
    return { ok: false, status: 404, error: lane.error };
  }
  if (lane.lane === 'staff' && !coach && owner) {
    return {
      ok: true,
      name: String(opts.name || owner.name || 'Owner').trim().split(/\s+/)[0],
      portal_token: loaded.store.settings?.public_token || opts.token,
      path: '/dashboard/fitgraph',
      role: 'owner',
    };
  }
  if (lane.lane === 'staff' && coach) {
    let portalToken = String(coach.portal_token || '').trim();
    if (!portalToken) {
      portalToken = ensureCoachPortalToken(coach, loaded.companyId);
      const idx = loaded.store.coaches.findIndex((c) => c.id === coach.id);
      if (idx >= 0) {
        loaded.store.coaches[idx] = {
          ...loaded.store.coaches[idx],
          portal_token: portalToken,
          can_manage_classes: true,
        };
        const { saveFitgraphMerged } = await import(
          '@/lib/fitness/fitgraph-io'
        );
        await saveFitgraphMerged(loaded.companyId, loaded.store);
      }
    }
    return {
      ok: true,
      name: String(coach.name || 'Coach').trim().split(/\s+/)[0],
      portal_token: portalToken,
      path: advisorPwaOpenPath('fitgraph', portalToken),
      role: 'coach',
    };
  }
  if (!client) {
    return {
      ok: false,
      status: 404,
      error:
        'We could not find that SA Member. Use the name and email on your gym file, or create an account to join.',
    };
  }
  let portalToken = String(client.portal_token || '').trim();
  if (!portalToken) {
    portalToken = ensureClientPortalToken(client, loaded.companyId);
    const idx = loaded.store.clients.findIndex((c) => c.id === client.id);
    if (idx >= 0) {
      loaded.store.clients[idx] = {
        ...loaded.store.clients[idx],
        portal_token: portalToken,
      };
      const { saveFitgraphMerged } = await import(
        '@/lib/fitness/fitgraph-io'
      );
      await saveFitgraphMerged(loaded.companyId, loaded.store);
    }
  }
  return {
    ok: true,
    name: String(client.name || 'Member').trim().split(/\s+/)[0],
    portal_token: portalToken,
    path: advisorPwaOpenPath('fitgraph', portalToken),
    role: 'member',
  };
}

async function signInClinic(opts: {
  module: Exclude<AdvisorPwaModule, 'hiregraph' | 'retailgraph' | 'fitgraph'>;
  token: string;
  name: string;
  email: string;
  expectRole?: 'staff' | 'member' | null;
}): Promise<AdvisorPwaSignInOk | AdvisorPwaSignInErr> {
  const loaded = await loadClinicStore(opts.module, opts.token);
  if (!loaded) {
    return { ok: false, status: 404, error: 'Practice not found' };
  }
  const staff = findStaffForPortalSignIn(loaded.practitioners, {
    name: opts.name,
    email: opts.email,
  });
  const person = findRosterPersonForSignIn(loaded.patients, {
    name: opts.name,
    email: opts.email,
  });
  const staffLabel = opts.module === 'dentalgraph' ? 'Clinician' : 'Practitioner';
  const lane = resolveAdvisorPwaLane({
    expectRole: opts.expectRole,
    hasStaff: Boolean(staff),
    hasMember: Boolean(person),
    staffLabel,
    staffListLabel: opts.module === 'dentalgraph' ? 'Staff' : 'Practitioners',
  });
  if (!lane.ok) {
    return { ok: false, status: 404, error: lane.error };
  }
  if (lane.lane === 'staff' && staff) {
    let portalToken = String(staff.portal_token || '').trim();
    if (!portalToken) {
      portalToken = loaded.issueStaffToken(loaded.companyId);
      const idx = loaded.practitioners.findIndex((p) => p.id === staff.id);
      if (idx >= 0) {
        loaded.practitioners[idx] = {
          ...loaded.practitioners[idx],
          portal_token: portalToken,
        };
        await loaded.saveStaff(portalToken, idx);
      }
    }
    return {
      ok: true,
      name: String(staff.name || 'Practitioner').trim().split(/\s+/)[0],
      portal_token: portalToken,
      path: advisorPwaOpenPath(opts.module, portalToken),
      role: 'practitioner',
    };
  }
  if (!person) {
    return {
      ok: false,
      status: 404,
      error:
        'We could not find that SA Member. Use the name and email on your file, or create an account to join this app.',
    };
  }
  let portalToken = String(person.portal_token || '').trim();
  if (!portalToken) {
    portalToken = loaded.issueToken(loaded.companyId);
    const idx = loaded.patients.findIndex((p) => p.id === person.id);
    if (idx >= 0) {
      loaded.patients[idx] = { ...loaded.patients[idx], portal_token: portalToken };
      await loaded.save(portalToken, idx);
    }
  }
  return {
    ok: true,
    name: String(person.name || 'Patient').trim().split(/\s+/)[0],
    portal_token: portalToken,
    path: advisorPwaOpenPath(opts.module, portalToken),
    role: 'patient',
  };
}

async function loadClinicStore(
  moduleKey: Exclude<AdvisorPwaModule, 'hiregraph' | 'retailgraph' | 'fitgraph'>,
  token: string
): Promise<{
  companyId: number;
  patients: RosterPerson[];
  practitioners: RosterPerson[];
  issueToken: (companyId: number) => string;
  issueStaffToken: (companyId: number) => string;
  save: (portalToken: string, idx: number) => Promise<void>;
  saveStaff: (portalToken: string, idx: number) => Promise<void>;
} | null> {
  const indexKeys = ADVISOR_PWA_INDEX_KEYS[moduleKey];

  if (moduleKey === 'physiograph') {
    const m = await import('@/lib/clinic/physiograph');
    const loaded = await loadAdvisorStoreForPublicToken({
      token,
      moduleKey: m.PHYSIOGRAPH_META_KEY,
      read: m.readPhysiographFromMetadata,
      parseCompanyId: m.parsePhysioCompanyIdFromToken,
      indexKeys,
    });
    if (!loaded || loaded.store.settings?.public_token !== token) return null;
    return {
      companyId: loaded.companyId,
      patients: loaded.store.patients || [],
      practitioners: loaded.store.practitioners || [],
      issueToken: m.issuePatientPortalToken,
      issueStaffToken: m.issuePractitionerPortalToken,
      save: async (portalToken, idx) => {
        loaded.store.patients[idx] = {
          ...loaded.store.patients[idx],
          portal_token: portalToken,
        };
        await saveAdvisorModuleStore(
          loaded.companyId,
          m.PHYSIOGRAPH_META_KEY,
          loaded.store,
          m.writePhysiographToMetadata
        );
      },
      saveStaff: async (portalToken, idx) => {
        loaded.store.practitioners[idx] = {
          ...loaded.store.practitioners[idx],
          portal_token: portalToken,
          can_manage: true,
        };
        await saveAdvisorModuleStore(
          loaded.companyId,
          m.PHYSIOGRAPH_META_KEY,
          loaded.store,
          m.writePhysiographToMetadata
        );
      },
    };
  }

  if (moduleKey === 'dentalgraph') {
    const m = await import('@/lib/dental/dentalgraph');
    const loaded = await loadAdvisorStoreForPublicToken({
      token,
      moduleKey: m.DENTALGRAPH_META_KEY,
      read: m.readDentalgraphFromMetadata,
      parseCompanyId: m.parseDentalCompanyIdFromToken,
      indexKeys,
    });
    if (!loaded || loaded.store.settings?.public_token !== token) return null;
    return {
      companyId: loaded.companyId,
      patients: loaded.store.patients || [],
      practitioners: loaded.store.staff || [],
      issueToken: m.issueDentalPatientPortalToken,
      issueStaffToken: m.issueDentalStaffPortalToken,
      save: async (portalToken, idx) => {
        loaded.store.patients[idx] = {
          ...loaded.store.patients[idx],
          portal_token: portalToken,
        };
        await saveAdvisorModuleStore(
          loaded.companyId,
          m.DENTALGRAPH_META_KEY,
          loaded.store,
          m.writeDentalgraphToMetadata
        );
      },
      saveStaff: async (portalToken, idx) => {
        loaded.store.staff[idx] = {
          ...loaded.store.staff[idx],
          portal_token: portalToken,
        };
        await saveAdvisorModuleStore(
          loaded.companyId,
          m.DENTALGRAPH_META_KEY,
          loaded.store,
          m.writeDentalgraphToMetadata
        );
      },
    };
  }

  if (moduleKey === 'medicalgraph') {
    const m = await import('@/lib/clinic/medicalgraph');
    const loaded = await loadAdvisorStoreForPublicToken({
      token,
      moduleKey: m.MEDICALGRAPH_META_KEY,
      read: m.readMedicalgraphFromMetadata,
      parseCompanyId: m.parseMedicalCompanyIdFromToken,
      indexKeys,
    });
    if (!loaded || loaded.store.settings?.public_token !== token) return null;
    return {
      companyId: loaded.companyId,
      patients: loaded.store.patients || [],
      practitioners: loaded.store.practitioners || [],
      issueToken: m.issuePatientPortalToken,
      issueStaffToken: m.issuePractitionerPortalToken,
      save: async (portalToken, idx) => {
        loaded.store.patients[idx] = {
          ...loaded.store.patients[idx],
          portal_token: portalToken,
        };
        await saveAdvisorModuleStore(
          loaded.companyId,
          m.MEDICALGRAPH_META_KEY,
          loaded.store,
          m.writeMedicalgraphToMetadata
        );
      },
      saveStaff: async (portalToken, idx) => {
        loaded.store.practitioners[idx] = {
          ...loaded.store.practitioners[idx],
          portal_token: portalToken,
          can_manage: true,
        };
        await saveAdvisorModuleStore(
          loaded.companyId,
          m.MEDICALGRAPH_META_KEY,
          loaded.store,
          m.writeMedicalgraphToMetadata
        );
      },
    };
  }

  if (moduleKey === 'vetgraph') {
    const m = await import('@/lib/clinic/vetgraph');
    const loaded = await loadAdvisorStoreForPublicToken({
      token,
      moduleKey: m.VETGRAPH_META_KEY,
      read: m.readVetgraphFromMetadata,
      parseCompanyId: m.parseVetCompanyIdFromToken,
      indexKeys,
    });
    if (!loaded || loaded.store.settings?.public_token !== token) return null;
    return {
      companyId: loaded.companyId,
      patients: loaded.store.patients || [],
      practitioners: loaded.store.practitioners || [],
      issueToken: m.issuePatientPortalToken,
      issueStaffToken: m.issuePractitionerPortalToken,
      save: async (portalToken, idx) => {
        loaded.store.patients[idx] = {
          ...loaded.store.patients[idx],
          portal_token: portalToken,
        };
        await saveAdvisorModuleStore(
          loaded.companyId,
          m.VETGRAPH_META_KEY,
          loaded.store,
          m.writeVetgraphToMetadata
        );
      },
      saveStaff: async (portalToken, idx) => {
        loaded.store.practitioners[idx] = {
          ...loaded.store.practitioners[idx],
          portal_token: portalToken,
          can_manage: true,
        };
        await saveAdvisorModuleStore(
          loaded.companyId,
          m.VETGRAPH_META_KEY,
          loaded.store,
          m.writeVetgraphToMetadata
        );
      },
    };
  }

  const m = await import('@/lib/clinic/psychiatrygraph');
  const loaded = await loadAdvisorStoreForPublicToken({
    token,
    moduleKey: m.PSYCHIATRYGRAPH_META_KEY,
    read: m.readPsychiatrygraphFromMetadata,
    parseCompanyId: m.parsePsychiatryCompanyIdFromToken,
    indexKeys,
  });
  if (!loaded || loaded.store.settings?.public_token !== token) return null;
  return {
    companyId: loaded.companyId,
    patients: loaded.store.patients || [],
    practitioners: loaded.store.practitioners || [],
    issueToken: m.issuePatientPortalToken,
    issueStaffToken: m.issuePractitionerPortalToken,
    save: async (portalToken, idx) => {
      loaded.store.patients[idx] = {
        ...loaded.store.patients[idx],
        portal_token: portalToken,
      };
      await saveAdvisorModuleStore(
        loaded.companyId,
        m.PSYCHIATRYGRAPH_META_KEY,
        loaded.store,
        m.writePsychiatrygraphToMetadata
      );
    },
    saveStaff: async (portalToken, idx) => {
      loaded.store.practitioners[idx] = {
        ...loaded.store.practitioners[idx],
        portal_token: portalToken,
        can_manage: true,
      };
      await saveAdvisorModuleStore(
        loaded.companyId,
        m.PSYCHIATRYGRAPH_META_KEY,
        loaded.store,
        m.writePsychiatrygraphToMetadata
      );
    },
  };
}
