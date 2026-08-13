/**
 * Resolve a portal / invite token into a B2C membership card and
 * stamp platform_user_id on the company-side person record.
 *
 * Advisors: Hire · Gym · Physio · Dental · Medical · Psychiatry
 */
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  findPortalByToken,
  hireCustomerPortalPath,
  parseCompanyIdFromHireCustomerToken,
  readHiregraphFromMetadata,
  writeHiregraphToMetadata,
} from '@/lib/hire/hiregraph';
import {
  parseCompanyIdFromToken,
  readFitgraphFromMetadata,
  writeFitgraphToMetadata,
  gymCheckinPath,
} from '@/lib/fitness/fitgraph';
import {
  parsePhysioCompanyIdFromToken,
  readPhysiographFromMetadata,
  writePhysiographToMetadata,
} from '@/lib/clinic/physiograph';
import {
  parseDentalCompanyIdFromToken,
  readDentalgraphFromMetadata,
  writeDentalgraphToMetadata,
} from '@/lib/dental/dentalgraph';
import {
  parseMedicalCompanyIdFromToken,
  readMedicalgraphFromMetadata,
  writeMedicalgraphToMetadata,
} from '@/lib/clinic/medicalgraph';
import {
  parsePsychiatryCompanyIdFromToken,
  readPsychiatrygraphFromMetadata,
  writePsychiatrygraphToMetadata,
} from '@/lib/clinic/psychiatrygraph';
import { linkPlatformUserId } from '@/lib/messaging/link-platform-user';
import type {
  B2cCapability,
  B2cMembership,
  B2cMembershipKind,
} from '@/lib/b2c/types';
import { indexBrandPerson } from '@/lib/b2c/directory';
import {
  loadWalletCompany,
  saveWalletCompanyMeta,
} from '@/lib/b2c/load-company';

export type LinkTokenResult =
  | {
      ok: true;
      membership: Omit<B2cMembership, 'id' | 'linked_at'>;
      brand: string;
    }
  | { ok: false; error: string };

const loadCompany = loadWalletCompany;
const saveMeta = saveWalletCompanyMeta;

function extractTokenFromUrl(raw: string): string {
  let token = String(raw || '').trim();
  if (!token) return '';
  const patterns = [
    /\/hire\/([^/?#]+)/i,
    /\/member\/fitgraph\/([^/?#]+)/i,
    /\/member\/physiograph\/([^/?#]+)/i,
    /\/member\/dentalgraph\/([^/?#]+)/i,
    /\/member\/medicalgraph\/([^/?#]+)/i,
    /\/member\/psychiatrygraph\/([^/?#]+)/i,
    /\/join\/member\/[^/]+\/([^/?#]+)/i,
  ];
  for (const re of patterns) {
    const m = token.match(re);
    if (m) return decodeURIComponent(m[1]);
  }
  return token;
}

const CLINIC_CAPS: B2cCapability[] = [
  'book',
  'track',
  'messages',
  'review',
  'kyc',
];

type PersonLike = {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  portal_token?: string | null;
  active?: boolean;
  platform_user_id?: string | null;
};

async function linkClinicPatient(opts: {
  token: string;
  platformUserId: string;
  kind: B2cMembershipKind;
  path: string;
  label: string;
  companyId: number | null;
  patients: PersonLike[];
  brand: string;
  companyName: string;
  companyIdNum: number;
  meta: Record<string, unknown>;
  write: (
    meta: Record<string, unknown>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    store: any
  ) => Record<string, unknown>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  store: any;
}): Promise<LinkTokenResult> {
  if (opts.companyId == null || !Number.isFinite(opts.companyId)) {
    return { ok: false, error: `Invalid ${opts.label} portal token` };
  }
  const patient = opts.patients.find(
    (p) => p.portal_token === opts.token && p.active !== false
  );
  if (!patient) {
    return {
      ok: false,
      error: `${opts.label} patient portal not found or revoked`,
    };
  }
  linkPlatformUserId(patient, opts.platformUserId);
  const idx = opts.store.patients.findIndex(
    (p: PersonLike) => p.id === patient.id
  );
  if (idx >= 0) opts.store.patients[idx] = patient;
  const nextMeta = opts.write(opts.meta, opts.store);
  await saveMeta(opts.companyIdNum, nextMeta);

  const membership = {
    kind: opts.kind,
    company_id: opts.companyIdNum,
    company_name: opts.companyName,
    brand: opts.brand,
    portal_token: opts.token,
    portal_path: `/member/${opts.path}/${encodeURIComponent(opts.token)}`,
    checkin_path: null,
    ref_id: patient.id,
    ref_label: patient.name,
    email: patient.email || null,
    capabilities: CLINIC_CAPS,
    active: true,
  };
  void indexBrandPerson({
    kind: opts.kind,
    companyId: opts.companyIdNum,
    companyName: opts.companyName,
    brand: opts.brand,
    refId: patient.id,
    refLabel: patient.name,
    email: patient.email || null,
    phone: patient.phone || null,
    portalToken: opts.token,
    portalPath: membership.portal_path,
    capabilities: CLINIC_CAPS,
  });

  return {
    ok: true,
    brand: opts.brand,
    membership,
  };
}

export async function resolveAndLinkPortalToken(
  rawToken: string,
  platformUserId: string
): Promise<LinkTokenResult> {
  const token = extractTokenFromUrl(rawToken);
  if (!token || token.length < 8) {
    return { ok: false, error: 'Token required' };
  }

  if (token.startsWith('coach_') || token.startsWith('clin_')) {
    return {
      ok: false,
      error:
        'That is a staff/coach portal. SA Member is for customers, members and patients only.',
    };
  }

  // ── HireAdvisor ──────────────────────────────────────────────────
  if (
    token.startsWith('hire_cust_') ||
    parseCompanyIdFromHireCustomerToken(token)
  ) {
    const companyId = parseCompanyIdFromHireCustomerToken(token);
    if (!companyId) return { ok: false, error: 'Invalid hire portal token' };
    const company = await loadCompany(companyId);
    if (!company) return { ok: false, error: 'Company not found' };

    let store = readHiregraphFromMetadata(company.meta);
    const portal = findPortalByToken(store, token);
    if (!portal) {
      return { ok: false, error: 'Hire portal not found or revoked' };
    }

    const supabase = getSupabaseServer();
    const { data: cust } = await supabase
      .from('customers')
      .select('id, trading_name, legal_name, contact_name, email')
      .eq('profile_id', companyId)
      .eq('id', portal.crm_customer_id)
      .maybeSingle();

    const customerName = String(
      cust?.trading_name ||
        cust?.legal_name ||
        cust?.contact_name ||
        portal.preferred_email ||
        `Customer #${portal.crm_customer_id}`
    );
    const brand = store.settings?.brand_name || company.name;
    const key = String(portal.crm_customer_id);
    store = {
      ...store,
      customer_portals: {
        ...(store.customer_portals || {}),
        [key]: {
          ...portal,
          last_seen_at: new Date().toISOString(),
          active: true,
        },
      },
    };
    const nextMeta = writeHiregraphToMetadata(company.meta, store);
    const b2cIndex =
      nextMeta.hiregraph_b2c_users &&
      typeof nextMeta.hiregraph_b2c_users === 'object'
        ? { ...(nextMeta.hiregraph_b2c_users as Record<string, string>) }
        : {};
    b2cIndex[key] = platformUserId;
    nextMeta.hiregraph_b2c_users = b2cIndex;
    await saveMeta(companyId, nextMeta);

    const membership = {
      kind: 'hire' as const,
      company_id: companyId,
      company_name: company.name,
      brand,
      portal_token: token,
      portal_path: hireCustomerPortalPath(token),
      checkin_path: null,
      ref_id: String(portal.crm_customer_id),
      ref_label: customerName,
      email: portal.preferred_email || cust?.email || null,
      capabilities: ['order', 'book', 'track', 'kyc', 'review'] as B2cCapability[],
      active: true,
    };
    void indexBrandPerson({
      kind: 'hire',
      companyId,
      companyName: company.name,
      brand,
      refId: String(portal.crm_customer_id),
      refLabel: customerName,
      email: portal.preferred_email || cust?.email || null,
      portalToken: token,
      portalPath: membership.portal_path,
      capabilities: ['order', 'book', 'track', 'kyc', 'review'],
    });

    return {
      ok: true,
      brand,
      membership,
    };
  }

  // ── PhysioAdvisor ────────────────────────────────────────────────
  if (token.startsWith('ppat_') || token.startsWith('pg_')) {
    const companyId = parsePhysioCompanyIdFromToken(token);
    if (!companyId) return { ok: false, error: 'Invalid physio portal token' };
    const company = await loadCompany(companyId);
    if (!company) return { ok: false, error: 'Company not found' };
    const store = readPhysiographFromMetadata(company.meta);
    return linkClinicPatient({
      token,
      platformUserId,
      kind: 'physio',
      path: 'physiograph',
      label: 'Physio',
      companyId,
      companyIdNum: company.id,
      companyName: company.name,
      brand: store.settings?.brand_name || company.name,
      patients: store.patients || [],
      meta: company.meta,
      store,
      write: writePhysiographToMetadata,
    });
  }

  // ── DentalAdvisor ────────────────────────────────────────────────
  if (token.startsWith('dpat_') || token.startsWith('dg_')) {
    const companyId = parseDentalCompanyIdFromToken(token);
    if (!companyId) return { ok: false, error: 'Invalid dental portal token' };
    const company = await loadCompany(companyId);
    if (!company) return { ok: false, error: 'Company not found' };
    const store = readDentalgraphFromMetadata(company.meta);
    return linkClinicPatient({
      token,
      platformUserId,
      kind: 'dental',
      path: 'dentalgraph',
      label: 'Dental',
      companyId,
      companyIdNum: company.id,
      companyName: company.name,
      brand: store.settings?.brand_name || company.name,
      patients: store.patients || [],
      meta: company.meta,
      store,
      write: writeDentalgraphToMetadata,
    });
  }

  // ── MedicalAdvisor ───────────────────────────────────────────────
  if (token.startsWith('medp_') || token.startsWith('medg_')) {
    const companyId = parseMedicalCompanyIdFromToken(token);
    if (!companyId) return { ok: false, error: 'Invalid medical portal token' };
    const company = await loadCompany(companyId);
    if (!company) return { ok: false, error: 'Company not found' };
    const store = readMedicalgraphFromMetadata(company.meta);
    return linkClinicPatient({
      token,
      platformUserId,
      kind: 'medical',
      path: 'medicalgraph',
      label: 'Medical',
      companyId,
      companyIdNum: company.id,
      companyName: company.name,
      brand: store.settings?.brand_name || company.name,
      patients: store.patients || [],
      meta: company.meta,
      store,
      write: writeMedicalgraphToMetadata,
    });
  }

  // ── PsychiatryAdvisor ────────────────────────────────────────────
  if (token.startsWith('psyp_') || token.startsWith('psyg_')) {
    const companyId = parsePsychiatryCompanyIdFromToken(token);
    if (!companyId) {
      return { ok: false, error: 'Invalid psychiatry portal token' };
    }
    const company = await loadCompany(companyId);
    if (!company) return { ok: false, error: 'Company not found' };
    const store = readPsychiatrygraphFromMetadata(company.meta);
    return linkClinicPatient({
      token,
      platformUserId,
      kind: 'psychiatry',
      path: 'psychiatrygraph',
      label: 'Psychiatry',
      companyId,
      companyIdNum: company.id,
      companyName: company.name,
      brand: store.settings?.brand_name || company.name,
      patients: store.patients || [],
      meta: company.meta,
      store,
      write: writePsychiatrygraphToMetadata,
    });
  }

  // ── GymAdvisor ───────────────────────────────────────────────────
  if (token.startsWith('member_') || parseCompanyIdFromToken(token) != null) {
    let companyId = parseCompanyIdFromToken(token);
    if (companyId == null && token.startsWith('member_')) {
      const m = /^member_(\d+)_/.exec(token);
      if (m) companyId = Number(m[1]);
    }
    if (companyId != null && Number.isFinite(companyId)) {
      const company = await loadCompany(companyId);
      if (!company) return { ok: false, error: 'Company not found' };
      const store = readFitgraphFromMetadata(company.meta);
      const client = store.clients.find(
        (c) => c.portal_token === token && c.active !== false
      );
      if (!client) {
        if (token.startsWith('fg_')) {
          return {
            ok: false,
            error:
              'Gym door QR is for check-in on site. Link your personal member portal first.',
          };
        }
        return { ok: false, error: 'Gym member portal not found' };
      }
      linkPlatformUserId(client, platformUserId);
      const ci = store.clients.findIndex((c) => c.id === client.id);
      if (ci >= 0) store.clients[ci] = client;
      await saveMeta(companyId, writeFitgraphToMetadata(company.meta, store));

      const brand = store.settings?.brand_name || company.name;
      const membership = {
        kind: 'gym' as const,
        company_id: companyId,
        company_name: company.name,
        brand,
        portal_token: token,
        portal_path: `/member/fitgraph/${encodeURIComponent(token)}`,
        checkin_path: store.settings?.public_token
          ? gymCheckinPath(store.settings.public_token)
          : null,
        ref_id: client.id,
        ref_label: client.name,
        email: client.email || null,
        capabilities: ['book', 'checkin', 'messages', 'review', 'track'] as B2cCapability[],
        active: true,
      };
      void indexBrandPerson({
        kind: 'gym',
        companyId,
        companyName: company.name,
        brand,
        refId: client.id,
        refLabel: client.name,
        email: client.email || null,
        phone: client.phone || null,
        portalToken: token,
        portalPath: membership.portal_path,
        checkinPath: membership.checkin_path,
        capabilities: ['book', 'checkin', 'messages', 'review', 'track'],
      });
      return {
        ok: true,
        brand,
        membership,
      };
    }
  }

  if (token.startsWith('fg_')) {
    return {
      ok: false,
      error:
        'Gym door QR is for check-in on site. Link your personal member portal first.',
    };
  }

  return {
    ok: false,
    error:
      'Unrecognised link. Paste a Hire, Gym, Physio, Dental, Medical or Psychiatry patient/member portal URL.',
  };
}

export function kindLabel(kind: B2cMembershipKind | string): string {
  switch (kind) {
    case 'hire':
      return 'Hire';
    case 'gym':
      return 'Gym';
    case 'physio':
      return 'Physio';
    case 'dental':
      return 'Dental';
    case 'medical':
      return 'Medical';
    case 'psychiatry':
      return 'Psychiatry';
    case 'account':
      return 'Account';
    default:
      return 'Membership';
  }
}

export const B2C_ADVISOR_KINDS: B2cMembershipKind[] = [
  'hire',
  'gym',
  'physio',
  'dental',
  'medical',
  'psychiatry',
];
