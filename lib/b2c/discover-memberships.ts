/**
 * Attach Advisor memberships when the logged-in person's email/phone
 * matches Core CRM, gym clients or clinic patients.
 */
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  emailsMatch,
  phonesMatch,
} from '@/lib/b2c/member-app';
import {
  hireCustomerPortalPath,
  issueCustomerPortal,
  readHiregraphFromMetadata,
  writeHiregraphToMetadata,
} from '@/lib/hire/hiregraph';
import {
  gymCheckinPath,
  readFitgraphFromMetadata,
  writeFitgraphToMetadata,
} from '@/lib/fitness/fitgraph';
import { readPhysiographFromMetadata } from '@/lib/clinic/physiograph';
import { readDentalgraphFromMetadata } from '@/lib/dental/dentalgraph';
import { readMedicalgraphFromMetadata } from '@/lib/clinic/medicalgraph';
import { readPsychiatrygraphFromMetadata } from '@/lib/clinic/psychiatrygraph';
import { linkPlatformUserId } from '@/lib/messaging/link-platform-user';
import type { B2cProfile } from '@/lib/b2c/types';
import { upsertMembership } from '@/lib/b2c/profile-store';
import {
  findDirectoryEntries,
  indexBrandPerson,
  membershipFromDirectory,
} from '@/lib/b2c/directory';
import { hasMetaModule } from '@/lib/b2c/company-modules';
import { shopHref } from '@/lib/b2c/wallet-accounts';
import {
  loadWalletCompany,
  saveWalletCompanyMeta,
  type WalletCompany,
} from '@/lib/b2c/load-company';

type CompanyRow = WalletCompany;

const loadCompany = loadWalletCompany;
const saveMeta = saveWalletCompanyMeta;

function personMatch(
  person: { email?: string | null; phone?: string | null },
  email: string | null,
  phone: string | null
) {
  return emailsMatch(person.email, email) || phonesMatch(person.phone, phone);
}

export async function discoverAndAttachMemberships(
  profile: B2cProfile,
  opts: {
    email?: string | null;
    phone?: string | null;
    platformUserId: string;
    /** Companies this person operates — skip generic CRM account cards. */
    skipCompanyIds?: number[];
  }
): Promise<{ profile: B2cProfile; attached: number }> {
  const email = opts.email?.trim().toLowerCase() || profile.email || null;
  const phone = opts.phone || profile.phone || null;
  if (!email && !phone) return { profile, attached: 0 };
  const operated = new Set(
    (opts.skipCompanyIds || []).filter((id) => Number.isFinite(id) && id > 0)
  );

  const supabase = getSupabaseServer();
  let crmRows: Array<{
    id: number;
    profile_id: number;
    trading_name?: string | null;
    legal_name?: string | null;
    contact_name?: string | null;
    email?: string | null;
    phone?: string | null;
  }> = [];

  if (email) {
    const { data } = await supabase
      .from('customers')
      .select(
        'id, profile_id, trading_name, legal_name, contact_name, email, phone'
      )
      .ilike('email', email)
      .limit(40);
    crmRows = (data || []) as typeof crmRows;
  }

  if (phone && phonesMatch(phone, phone)) {
    const digits = String(phone).replace(/\D/g, '');
    const tail = digits.slice(-9);
    if (tail.length >= 7) {
      const { data } = await supabase
        .from('customers')
        .select(
          'id, profile_id, trading_name, legal_name, contact_name, email, phone'
        )
        .ilike('phone', `%${tail}`)
        .limit(40);
      for (const row of data || []) {
        if (!crmRows.some((r) => r.id === row.id)) {
          crmRows.push(row as (typeof crmRows)[number]);
        }
      }
    }
  }

  const companyIds = new Set<number>();
  for (const row of crmRows) {
    if (row.profile_id) companyIds.add(Number(row.profile_id));
  }

  // Gym / dental / clinic people are often not Core CRM customers of that
  // brand — look them up from the personal directory too.
  const directory = await findDirectoryEntries(email, phone);
  for (const entry of directory) {
    if (entry.company_id) companyIds.add(entry.company_id);
  }

  let attached = 0;
  let next = profile;

  for (const companyId of companyIds) {
    const company = await loadCompany(companyId);
    if (!company) continue;
    const theyOperate = operated.has(companyId);

    // CRM customer → wallet account. Skip if they operate this company
    // (owner email matching CRM is not "I shop here").
    const companyCrm = crmRows.filter((r) => Number(r.profile_id) === companyId);
    if (!theyOperate) for (const crm of companyCrm) {
      const before = next.memberships.length;
      next = upsertMembership(next, {
        kind: 'account',
        company_id: companyId,
        company_name: company.name,
        brand: company.name,
        portal_token: null,
        portal_path: shopHref(companyId),
        checkin_path: null,
        ref_id: String(crm.id),
        ref_label: String(
          crm.trading_name || crm.legal_name || crm.contact_name || crm.email
        ),
        email: crm.email || email,
        capabilities: ['order', 'review', 'track'],
        active: true,
      });
      if (next.memberships.length > before) attached += 1;
    }

    // Hire — only if this company actually runs HireAdvisor.
    // Owner email on CRM is not "I hire from my own desk".
    const hasHire = hasMetaModule(company.meta, 'hiregraph');
    let hireStore =
      hasHire && !theyOperate ? readHiregraphFromMetadata(company.meta) : null;
    let hireDirty = false;
    if (hasHire && hireStore && !theyOperate) {
      for (const crm of companyCrm) {
        if (!personMatch(crm, email, phone) && email) {
          // already selected by query
        }
        let portal = hireStore.customer_portals?.[String(crm.id)];
        if (!portal?.portal_token || portal.active === false) {
          const issued = issueCustomerPortal(hireStore, Number(crm.id), {
            companyId,
            invite_email: crm.email || email,
          });
          hireStore = issued.store;
          portal = issued.portal;
          hireDirty = true;
        }
        const brand = hireStore.settings?.brand_name || company.name;
        const before = next.memberships.length;
        next = upsertMembership(next, {
          kind: 'hire',
          company_id: companyId,
          company_name: company.name,
          brand,
          portal_token: portal.portal_token,
          portal_path: hireCustomerPortalPath(portal.portal_token),
          checkin_path: null,
          ref_id: String(crm.id),
          ref_label: String(
            crm.trading_name || crm.legal_name || crm.contact_name || crm.email
          ),
          email: crm.email || email,
          capabilities: ['order', 'book', 'track', 'kyc', 'review'],
          active: true,
        });
        if (next.memberships.length > before) {
          attached += 1;
        }
        void indexBrandPerson({
          kind: 'hire',
          companyId,
          companyName: company.name,
          brand,
          refId: String(crm.id),
          refLabel: String(
            crm.trading_name || crm.legal_name || crm.contact_name || crm.email
          ),
          email: crm.email || email,
          phone: crm.phone || phone,
          portalToken: portal.portal_token,
          portalPath: hireCustomerPortalPath(portal.portal_token),
          capabilities: ['order', 'book', 'track', 'kyc', 'review'],
        });
      }
    }
    if (hireDirty && hireStore) {
      company.meta = writeHiregraphToMetadata(company.meta, hireStore);
    }

    // Gym
    const fit = readFitgraphFromMetadata(company.meta);
    const client = (fit.clients || []).find(
      (c) => c.active !== false && personMatch(c, email, phone)
    );
    if (client?.portal_token) {
      linkPlatformUserId(client, opts.platformUserId);
      const ci = fit.clients.findIndex((c) => c.id === client.id);
      if (ci >= 0) fit.clients[ci] = client;
      company.meta = writeFitgraphToMetadata(company.meta, fit);
      next = upsertMembership(next, {
        kind: 'gym',
        company_id: companyId,
        company_name: company.name,
        brand: fit.settings?.brand_name || company.name,
        portal_token: client.portal_token,
        portal_path: `/member/fitgraph/${encodeURIComponent(client.portal_token)}`,
        checkin_path: fit.settings?.public_token
          ? gymCheckinPath(fit.settings.public_token)
          : null,
        ref_id: client.id,
        ref_label: client.name,
        email: client.email || email,
        capabilities: ['book', 'checkin', 'messages', 'review', 'track'],
        active: true,
      });
      attached += 1;
      void indexBrandPerson({
        kind: 'gym',
        companyId,
        companyName: company.name,
        brand: fit.settings?.brand_name || company.name,
        refId: client.id,
        refLabel: client.name,
        email: client.email || email,
        phone: client.phone || phone,
        portalToken: client.portal_token,
        portalPath: `/member/fitgraph/${encodeURIComponent(client.portal_token)}`,
        checkinPath: fit.settings?.public_token
          ? gymCheckinPath(fit.settings.public_token)
          : null,
        capabilities: ['book', 'checkin', 'messages', 'review', 'track'],
      });
    }

    // Clinics
    const clinics: Array<{
      kind: 'physio' | 'dental' | 'medical' | 'psychiatry';
      path: string;
      patients: Array<{
        id: string;
        name: string;
        email?: string;
        phone?: string;
        portal_token?: string | null;
        active?: boolean;
      }>;
    }> = [
      {
        kind: 'physio',
        path: 'physiograph',
        patients: readPhysiographFromMetadata(company.meta).patients || [],
      },
      {
        kind: 'dental',
        path: 'dentalgraph',
        patients: readDentalgraphFromMetadata(company.meta).patients || [],
      },
      {
        kind: 'medical',
        path: 'medicalgraph',
        patients: readMedicalgraphFromMetadata(company.meta).patients || [],
      },
      {
        kind: 'psychiatry',
        path: 'psychiatrygraph',
        patients: readPsychiatrygraphFromMetadata(company.meta).patients || [],
      },
    ];
    for (const clinic of clinics) {
      const p = clinic.patients.find(
        (x) => x.active !== false && personMatch(x, email, phone) && x.portal_token
      );
      if (!p?.portal_token) continue;
      next = upsertMembership(next, {
        kind: clinic.kind,
        company_id: companyId,
        company_name: company.name,
        brand: company.name,
        portal_token: p.portal_token,
        portal_path: `/member/${clinic.path}/${encodeURIComponent(p.portal_token)}`,
        checkin_path: null,
        ref_id: p.id,
        ref_label: p.name,
        email: p.email || email,
        capabilities: ['book', 'track', 'messages', 'review', 'kyc'],
        active: true,
      });
      attached += 1;
      void indexBrandPerson({
        kind: clinic.kind,
        companyId,
        companyName: company.name,
        brand: company.name,
        refId: p.id,
        refLabel: p.name,
        email: p.email || email,
        phone: p.phone || phone,
        portalToken: p.portal_token,
        portalPath: `/member/${clinic.path}/${encodeURIComponent(p.portal_token)}`,
        capabilities: ['book', 'track', 'messages', 'review', 'kyc'],
      });
    }

    await saveMeta(companyId, company.meta);
  }

  // Directory fallback — attach gym/dental even if the company scan missed them
  for (const entry of directory) {
    const already = next.memberships.some(
      (m) =>
        m.kind === entry.kind &&
        m.company_id === entry.company_id &&
        m.ref_id === entry.ref_id &&
        m.active !== false
    );
    if (already || !entry.portal_path) continue;
    if (operated.has(entry.company_id) && entry.kind === 'account') continue;
    next = upsertMembership(next, membershipFromDirectory(entry));
    attached += 1;
  }

  return { profile: next, attached };
}
