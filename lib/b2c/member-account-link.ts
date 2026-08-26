/**
 * Attach an Advisor charge to the client's SA Member wallet and notify them.
 */
import { logoUrlFromSettings } from '@/lib/business/company-logo';
import {
  loadB2cProfile,
  loadB2cProfileByEmail,
  saveB2cProfile,
  upsertMembership,
} from '@/lib/b2c/profile-store';
import { attachInvoiceToCharge } from '@/lib/b2c/member-account-ar';
import { notifyMemberOfAdvisorInvoice } from '@/lib/b2c/member-account-notify';
import {
  MODULE_TO_KIND,
  type AdvisorAccountModule,
  type MemberAccountCharge,
} from '@/lib/b2c/member-account-types';
import type { WalletCompany } from '@/lib/b2c/load-company';
import {
  issuePatientPortalToken as issuePhysioToken,
  readPhysiographFromMetadata,
  writePhysiographToMetadata,
} from '@/lib/clinic/physiograph';
import {
  issueDentalPatientPortalToken,
  readDentalgraphFromMetadata,
  writeDentalgraphToMetadata,
} from '@/lib/dental/dentalgraph';
import {
  issuePatientPortalToken as issueMedicalToken,
  readMedicalgraphFromMetadata,
  writeMedicalgraphToMetadata,
} from '@/lib/clinic/medicalgraph';
import {
  issuePatientPortalToken as issueVetToken,
  readVetgraphFromMetadata,
  writeVetgraphToMetadata,
} from '@/lib/clinic/vetgraph';
import {
  issuePatientPortalToken as issuePsychiatryToken,
  readPsychiatrygraphFromMetadata,
  writePsychiatrygraphToMetadata,
} from '@/lib/clinic/psychiatrygraph';
import {
  issueClientPortalToken,
  readFitgraphFromMetadata,
  writeFitgraphToMetadata,
} from '@/lib/fitness/fitgraph';
import { readHiregraphFromMetadata } from '@/lib/hire/hiregraph';
import { readRetailgraphFromMetadata } from '@/lib/retail/retailgraph';

type DeskPerson = {
  id: string;
  name?: string;
  email?: string | null;
  platform_user_id?: string | null;
  portal_token?: string | null;
};

function brandAndLogo(
  module: AdvisorAccountModule,
  meta: Record<string, unknown>,
  fallback: string
): { brand: string; logoUrl: string | null } {
  const settings = (() => {
    if (module === 'physiograph')
      return readPhysiographFromMetadata(meta).settings;
    if (module === 'dentalgraph')
      return readDentalgraphFromMetadata(meta).settings;
    if (module === 'medicalgraph')
      return readMedicalgraphFromMetadata(meta).settings;
    if (module === 'vetgraph') return readVetgraphFromMetadata(meta).settings;
    if (module === 'psychiatrygraph')
      return readPsychiatrygraphFromMetadata(meta).settings;
    if (module === 'fitgraph') return readFitgraphFromMetadata(meta).settings;
    if (module === 'hiregraph') return readHiregraphFromMetadata(meta).settings;
    if (module === 'retailgraph')
      return readRetailgraphFromMetadata(meta).settings;
    return null;
  })() as { brand_name?: string | null; company_logo_url?: string | null } | null;
  return {
    brand: String(settings?.brand_name || fallback),
    logoUrl: logoUrlFromSettings(settings),
  };
}

function asDeskPerson(p: {
  id: string;
  name?: string;
  email?: string | null;
  platform_user_id?: string | null;
  portal_token?: string | null;
} | null | undefined): DeskPerson | null {
  if (!p) return null;
  return {
    id: p.id,
    name: p.name,
    email: p.email || null,
    platform_user_id: p.platform_user_id || null,
    portal_token: p.portal_token || null,
  };
}

function findDeskPerson(
  module: AdvisorAccountModule,
  meta: Record<string, unknown>,
  refId: string
): DeskPerson | null {
  if (module === 'fitgraph') {
    return asDeskPerson(
      (readFitgraphFromMetadata(meta).clients || []).find((c) => c.id === refId)
    );
  }
  if (module === 'retailgraph') {
    const c = (readRetailgraphFromMetadata(meta).customers || []).find(
      (x) => x.id === refId
    );
    return c ? { id: c.id, name: c.name, email: c.email || null } : null;
  }
  if (module === 'physiograph') {
    return asDeskPerson(
      (readPhysiographFromMetadata(meta).patients || []).find((p) => p.id === refId)
    );
  }
  if (module === 'dentalgraph') {
    return asDeskPerson(
      (readDentalgraphFromMetadata(meta).patients || []).find((p) => p.id === refId)
    );
  }
  if (module === 'medicalgraph') {
    return asDeskPerson(
      (readMedicalgraphFromMetadata(meta).patients || []).find((p) => p.id === refId)
    );
  }
  if (module === 'vetgraph') {
    return asDeskPerson(
      (readVetgraphFromMetadata(meta).patients || []).find((p) => p.id === refId)
    );
  }
  if (module === 'psychiatrygraph') {
    return asDeskPerson(
      (readPsychiatrygraphFromMetadata(meta).patients || []).find(
        (p) => p.id === refId
      )
    );
  }
  return null;
}

function stampPatientFields(
  person: {
    platform_user_id?: string | null;
    portal_token?: string | null;
  },
  userId: string | null,
  issue: () => string
): string | null {
  if (userId && !person.platform_user_id) person.platform_user_id = userId;
  if (!person.portal_token) person.portal_token = issue();
  return person.portal_token || null;
}

function stampDeskPerson(
  module: AdvisorAccountModule,
  companyId: number,
  meta: Record<string, unknown>,
  refId: string,
  userId: string | null
): { meta: Record<string, unknown>; token: string | null } {
  if (module === 'fitgraph') {
    const store = readFitgraphFromMetadata(meta);
    const person = (store.clients || []).find((c) => c.id === refId);
    if (!person) return { meta, token: null };
    const token = stampPatientFields(person, userId, () =>
      issueClientPortalToken(companyId)
    );
    return { meta: writeFitgraphToMetadata(meta, store), token };
  }
  if (module === 'physiograph') {
    const store = readPhysiographFromMetadata(meta);
    const person = (store.patients || []).find((p) => p.id === refId);
    if (!person) return { meta, token: null };
    const token = stampPatientFields(person, userId, () =>
      issuePhysioToken(companyId)
    );
    return { meta: writePhysiographToMetadata(meta, store), token };
  }
  if (module === 'dentalgraph') {
    const store = readDentalgraphFromMetadata(meta);
    const person = (store.patients || []).find((p) => p.id === refId);
    if (!person) return { meta, token: null };
    const token = stampPatientFields(person, userId, () =>
      issueDentalPatientPortalToken(companyId)
    );
    return { meta: writeDentalgraphToMetadata(meta, store), token };
  }
  if (module === 'medicalgraph') {
    const store = readMedicalgraphFromMetadata(meta);
    const person = (store.patients || []).find((p) => p.id === refId);
    if (!person) return { meta, token: null };
    const token = stampPatientFields(person, userId, () =>
      issueMedicalToken(companyId)
    );
    return { meta: writeMedicalgraphToMetadata(meta, store), token };
  }
  if (module === 'vetgraph') {
    const store = readVetgraphFromMetadata(meta);
    const person = (store.patients || []).find((p) => p.id === refId);
    if (!person) return { meta, token: null };
    const token = stampPatientFields(person, userId, () =>
      issueVetToken(companyId)
    );
    return { meta: writeVetgraphToMetadata(meta, store), token };
  }
  if (module === 'psychiatrygraph') {
    const store = readPsychiatrygraphFromMetadata(meta);
    const person = (store.patients || []).find((p) => p.id === refId);
    if (!person) return { meta, token: null };
    const token = stampPatientFields(person, userId, () =>
      issuePsychiatryToken(companyId)
    );
    return { meta: writePsychiatrygraphToMetadata(meta, store), token };
  }
  return { meta, token: null };
}

function memberPortalPath(
  module: AdvisorAccountModule,
  token: string | null
): string {
  if (!token) return '/me?tab=account';
  if (module === 'hiregraph') return '/me?tab=account';
  if (module === 'retailgraph') return '/me?tab=account';
  return `/member/${module}/${encodeURIComponent(token)}`;
}

export async function attachChargeToSaMember(opts: {
  company: WalletCompany;
  module: AdvisorAccountModule;
  charge: MemberAccountCharge;
}): Promise<{
  charge: MemberAccountCharge;
  meta: Record<string, unknown>;
  brand: string;
  logoUrl: string | null;
  portalPath: string;
}> {
  let meta = opts.company.meta;
  const look = brandAndLogo(opts.module, meta, opts.company.name);
  const person = findDeskPerson(opts.module, meta, opts.charge.ref_id);
  const email = String(
    opts.charge.member_email || person?.email || ''
  )
    .trim()
    .toLowerCase();
  const uidHint = String(
    opts.charge.member_user_id || person?.platform_user_id || ''
  ).trim();

  let profile = uidHint ? await loadB2cProfile(uidHint) : null;
  if (!profile && email.includes('@')) {
    profile = await loadB2cProfileByEmail(email);
  }

  const stamped = stampDeskPerson(
    opts.module,
    opts.company.id,
    meta,
    opts.charge.ref_id,
    profile?.user_id || uidHint || null
  );
  meta = stamped.meta;
  const token = stamped.token || person?.portal_token || null;
  const portalPath = memberPortalPath(opts.module, token);

  let charge: MemberAccountCharge = {
    ...opts.charge,
    member_email: email.includes('@') ? email : opts.charge.member_email || null,
    member_user_id:
      profile?.user_id || uidHint || opts.charge.member_user_id || null,
  };

  if (profile) {
    const kind = MODULE_TO_KIND[opts.module];
    const already = (profile.memberships || []).some(
      (m) =>
        m.company_id === opts.company.id &&
        m.kind === kind &&
        m.active !== false
    );
    if (!already) {
      const next = upsertMembership(profile, {
        kind,
        company_id: opts.company.id,
        company_name: opts.company.name,
        brand: look.brand,
        portal_token: token,
        portal_path: portalPath,
        ref_id: charge.ref_id,
        ref_label: charge.member_name,
        email: charge.member_email,
        capabilities: ['book', 'track', 'messages', 'review'],
      });
      await saveB2cProfile(next);
    }
  }

  return {
    charge,
    meta,
    brand: look.brand,
    logoUrl: look.logoUrl,
    portalPath,
  };
}

export async function publishAdvisorCharge(opts: {
  company: WalletCompany;
  module: AdvisorAccountModule;
  charge: MemberAccountCharge;
}): Promise<{
  charge: MemberAccountCharge;
  meta: Record<string, unknown>;
  emailed: boolean;
}> {
  let charge = await attachInvoiceToCharge(opts.company.id, opts.charge);
  let meta = opts.company.meta;
  let brand = opts.company.name;
  let logoUrl: string | null = null;
  let portalPath = '/me?tab=account';
  try {
    const linked = await attachChargeToSaMember({
      company: { ...opts.company, meta },
      module: opts.module,
      charge,
    });
    charge = linked.charge;
    meta = linked.meta;
    brand = linked.brand;
    logoUrl = linked.logoUrl;
    portalPath = linked.portalPath;
  } catch (e) {
    console.warn('[member-account] link member', e);
  }
  let emailed = false;
  try {
    const n = await notifyMemberOfAdvisorInvoice({
      companyId: opts.company.id,
      companyName: opts.company.name,
      brand,
      logoUrl,
      module: opts.module,
      charge,
      portalPath,
    });
    emailed = n.emailed;
  } catch (e) {
    console.warn('[member-account] notify member', e);
  }
  return { charge, meta, emailed };
}

export function chargeRaisedMessage(
  charge: MemberAccountCharge,
  emailed: boolean
): string {
  const inv = charge.invoice_number ? ` · ${charge.invoice_number}` : '';
  if (emailed && charge.member_email) {
    return charge.invoice_number
      ? `${charge.invoice_number} emailed to ${charge.member_email}`
      : `Invoice emailed to ${charge.member_email}`;
  }
  return `Charged ${charge.member_name}${inv}`;
}
