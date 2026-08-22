/**
 * Roster sign-in for a company PWA: name + email on the gym/clinic/hire file.
 * New people create an account on the PWA launcher and join via /api/b2c/join.
 */
import { loadAdvisorStoreForPublicToken } from '@/lib/business/advisor-store-resolve';
import { saveAdvisorModuleStore } from '@/lib/business/company-data';
import { namesMatchForPortalSignIn } from '@/lib/fitness/fitgraph';
import {
  ADVISOR_PWA_INDEX_KEYS,
  advisorPwaMemberOpenPath,
  isAdvisorPwaModule,
  type AdvisorPwaModule,
} from '@/lib/advisors/member-pwa';

type RosterPerson = {
  id: string;
  name?: string;
  email?: string;
  invite_email?: string | null;
  active?: boolean;
  portal_token?: string | null;
};

function rosterEmails(person: RosterPerson): string[] {
  return [person.email, person.invite_email]
    .map((v) => String(v || '').trim().toLowerCase())
    .filter((v) => v.includes('@'));
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
        rosterEmails(p).includes(email) &&
        namesMatchForPortalSignIn(p.name, name)
    ) || null
  );
}

export type AdvisorPwaSignInOk = {
  ok: true;
  name: string;
  portal_token: string;
  path: string;
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

  if (moduleKey === 'hiregraph') {
    return signInHire({ token, name, email });
  }
  if (moduleKey === 'fitgraph') {
    return signInGym({ token, name, email });
  }
  return signInClinic({ module: moduleKey, token, name, email });
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

  const supabase = getSupabaseServer();
  const { data: rows } = await supabase
    .from('customers')
    .select('id, trading_name, legal_name, contact_name, email, status')
    .eq('profile_id', loaded.companyId)
    .limit(500);

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
    path: advisorPwaMemberOpenPath('hiregraph', portalToken),
  };
}

async function signInGym(opts: {
  token: string;
  name: string;
  email: string;
}): Promise<AdvisorPwaSignInOk | AdvisorPwaSignInErr> {
  const {
    FITGRAPH_META_KEY,
    FITGRAPH_PUBLIC_TOKEN_KEY,
    findClientForPortalSignIn,
    issueClientPortalToken,
    parseCompanyIdFromToken,
    readFitgraphFromMetadata,
    writeFitgraphToMetadata,
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
  const client = findClientForPortalSignIn(loaded.store, {
    name: opts.name,
    email: opts.email,
  });
  if (!client) {
    return {
      ok: false,
      status: 404,
      error:
        'We could not find that member. Use the name and email on your gym profile, or create an account to join.',
    };
  }
  let portalToken = String(client.portal_token || '').trim();
  if (!portalToken) {
    portalToken = issueClientPortalToken(loaded.companyId);
    const idx = loaded.store.clients.findIndex((c) => c.id === client.id);
    if (idx >= 0) {
      loaded.store.clients[idx] = {
        ...loaded.store.clients[idx],
        portal_token: portalToken,
      };
      await saveAdvisorModuleStore(
        loaded.companyId,
        FITGRAPH_META_KEY,
        loaded.store,
        writeFitgraphToMetadata
      );
    }
  }
  return {
    ok: true,
    name: String(client.name || 'Member').trim().split(/\s+/)[0],
    portal_token: portalToken,
    path: advisorPwaMemberOpenPath('fitgraph', portalToken),
  };
}

async function signInClinic(opts: {
  module: Exclude<AdvisorPwaModule, 'hiregraph' | 'retailgraph' | 'fitgraph'>;
  token: string;
  name: string;
  email: string;
}): Promise<AdvisorPwaSignInOk | AdvisorPwaSignInErr> {
  const loaded = await loadClinicStore(opts.module, opts.token);
  if (!loaded) {
    return { ok: false, status: 404, error: 'Practice not found' };
  }
  const person = findRosterPersonForSignIn(loaded.patients, {
    name: opts.name,
    email: opts.email,
  });
  if (!person) {
    return {
      ok: false,
      status: 404,
      error:
        'We could not find that patient. Use the name and email on your file, or create an account to join this app.',
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
    path: advisorPwaMemberOpenPath(opts.module, portalToken),
  };
}

async function loadClinicStore(
  moduleKey: Exclude<AdvisorPwaModule, 'hiregraph' | 'retailgraph' | 'fitgraph'>,
  token: string
): Promise<{
  companyId: number;
  patients: RosterPerson[];
  issueToken: (companyId: number) => string;
  save: (portalToken: string, idx: number) => Promise<void>;
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
      issueToken: m.issuePatientPortalToken,
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
      issueToken: m.issueDentalPatientPortalToken,
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
      issueToken: m.issuePatientPortalToken,
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
    issueToken: m.issuePatientPortalToken,
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
  };
}
