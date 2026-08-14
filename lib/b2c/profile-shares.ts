/**
 * Member-consented profile sharing between Advisor desks.
 *
 * A gym can ask to share a member with a connected physio (or one clinic
 * with another). Nothing is visible until the member consents in SA Member.
 * Grants live on the member's wallet; the receiving company keeps an index.
 */
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  loadB2cProfile,
  loadB2cProfileByEmail,
  saveB2cProfile,
} from '@/lib/b2c/profile-store';
import type { B2cProfile } from '@/lib/b2c/types';
import {
  detectCompanyModules,
  hasConsumerDesk,
  isConsumerMembershipKind,
} from '@/lib/b2c/company-modules';
import {
  loadWalletCompany,
  saveWalletCompanyMeta,
} from '@/lib/b2c/load-company';
import { findConnectionBetween } from '@/lib/connections/sync';
import { readFitgraphFromMetadata } from '@/lib/fitness/fitgraph';
import { readPhysiographFromMetadata } from '@/lib/clinic/physiograph';
import { readDentalgraphFromMetadata } from '@/lib/dental/dentalgraph';
import { readMedicalgraphFromMetadata } from '@/lib/clinic/medicalgraph';
import { readPsychiatrygraphFromMetadata } from '@/lib/clinic/psychiatrygraph';
import { buildPatientMedicalShare } from '@/lib/clinic/medical-share';
import { healthSummaryLabel } from '@/lib/health/body-map';
import {
  isAdvisorShareKind,
  type AdvisorShareKind,
  type AdvisorSharePeer,
  type ProfileShare,
  type ProfileShareSnapshot,
  type ProfileShareStatus,
} from '@/lib/b2c/profile-share-types';

export type {
  AdvisorShareKind,
  AdvisorSharePeer,
  ProfileShare,
  ProfileShareSnapshot,
  ProfileShareStatus,
} from '@/lib/b2c/profile-share-types';
export {
  ADVISOR_SHARE_KINDS,
  SHARE_KIND_LABEL,
  isAdvisorShareKind,
} from '@/lib/b2c/profile-share-types';

const MEMBER_KEY = 'profile_shares';
const INBOUND_KEY = 'inbound_profile_shares';

function newShareId() {
  return `psh_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function readMemberShares(profile: B2cProfile): ProfileShare[] {
  const raw = profile.metadata?.[MEMBER_KEY];
  if (!Array.isArray(raw)) return [];
  return raw.filter(isShare);
}

function isShare(v: unknown): v is ProfileShare {
  if (!v || typeof v !== 'object') return false;
  const o = v as ProfileShare;
  return (
    Boolean(o.id) &&
    Number.isFinite(Number(o.from_company_id)) &&
    Number.isFinite(Number(o.to_company_id)) &&
    isAdvisorShareKind(o.from_kind) &&
    isAdvisorShareKind(o.to_kind)
  );
}

export function writeMemberShares(
  profile: B2cProfile,
  shares: ProfileShare[]
): B2cProfile {
  return {
    ...profile,
    metadata: { ...(profile.metadata || {}), [MEMBER_KEY]: shares },
  };
}

type InboundIndex = {
  share_id: string;
  member_user_id: string;
  from_company_id: number;
  from_company_name: string;
  from_kind: AdvisorShareKind;
  from_ref_id: string;
  member_name: string;
  status: ProfileShareStatus;
};

function readInbound(meta: Record<string, unknown>): InboundIndex[] {
  const raw = meta[INBOUND_KEY];
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (v): v is InboundIndex =>
      Boolean(v && typeof v === 'object' && (v as InboundIndex).share_id)
  );
}

async function upsertInbound(share: ProfileShare, memberUserId: string, memberName: string) {
  const dest = await loadWalletCompany(share.to_company_id);
  if (!dest) return;
  const list = readInbound(dest.meta).filter((r) => r.share_id !== share.id);
  list.unshift({
    share_id: share.id,
    member_user_id: memberUserId,
    from_company_id: share.from_company_id,
    from_company_name: share.from_company_name,
    from_kind: share.from_kind,
    from_ref_id: share.from_ref_id,
    member_name: memberName,
    status: share.status,
  });
  dest.meta[INBOUND_KEY] = list.slice(0, 200);
  await saveWalletCompanyMeta(dest.id, dest.meta);
}

export async function findMemberForDeskPerson(opts: {
  companyId: number;
  kind: AdvisorShareKind;
  refId: string;
  platformUserId?: string | null;
  email?: string | null;
}): Promise<B2cProfile | null> {
  if (opts.platformUserId) {
    const byUser = await loadB2cProfile(opts.platformUserId);
    if (byUser) return byUser;
  }
  if (opts.email) {
    const byEmail = await loadB2cProfileByEmail(opts.email);
    if (byEmail) return byEmail;
  }
  return null;
}

export async function companiesAreAssociated(
  a: number,
  b: number
): Promise<boolean> {
  if (a === b) return false;
  const edge = await findConnectionBetween(a, b);
  return String(edge?.status || '') === 'accepted';
}

export async function listAcceptedAdvisorPeers(
  companyId: number
): Promise<AdvisorSharePeer[]> {
  const supabase = getSupabaseServer();
  const { data } = await supabase
    .from('business_connections')
    .select('requester_profile_id, requestee_profile_id, status')
    .or(
      `requester_profile_id.eq.${companyId},requestee_profile_id.eq.${companyId}`
    )
    .eq('status', 'accepted')
    .limit(200);
  const ids = new Set<number>();
  for (const row of data || []) {
    const req = Number(row.requester_profile_id);
    const rec = Number(row.requestee_profile_id);
    if (req === companyId && rec !== companyId) ids.add(rec);
    if (rec === companyId && req !== companyId) ids.add(req);
  }
  if (!ids.size) return [];
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, trading_name, legal_name, metadata')
    .in('id', [...ids]);
  const peers: AdvisorSharePeer[] = [];
  for (const p of profiles || []) {
    const meta =
      p.metadata && typeof p.metadata === 'object'
        ? (p.metadata as Record<string, unknown>)
        : {};
    if (!hasConsumerDesk(meta)) continue;
    const kinds = detectCompanyModules(meta).filter(isAdvisorShareKind);
    if (!kinds.length) continue;
    peers.push({
      company_id: Number(p.id),
      name: String(p.trading_name || p.legal_name || `Company #${p.id}`),
      kinds,
    });
  }
  return peers.sort((a, b) => a.name.localeCompare(b.name));
}

function maskId(id?: string | null) {
  const v = String(id || '').trim();
  if (v.length < 4) return undefined;
  return `••••${v.slice(-4)}`;
}

export async function buildShareSnapshot(opts: {
  companyId: number;
  kind: AdvisorShareKind;
  refId: string;
}): Promise<ProfileShareSnapshot | null> {
  const company = await loadWalletCompany(opts.companyId);
  if (!company) return null;
  const brand = company.name;
  const now = new Date().toISOString();

  if (opts.kind === 'gym') {
    const store = readFitgraphFromMetadata(company.meta);
    const client = store.clients.find((c) => c.id === opts.refId);
    if (!client) return null;
    return {
      name: client.name,
      email: client.email,
      phone: client.phone,
      id_hint: maskId(client.id_number),
      brand,
      kind: 'gym',
      health: client.health ? healthSummaryLabel(client.health) : undefined,
      captured_at: now,
    };
  }

  const store =
    opts.kind === 'physio'
      ? readPhysiographFromMetadata(company.meta)
      : opts.kind === 'dental'
        ? readDentalgraphFromMetadata(company.meta)
        : opts.kind === 'medical'
          ? readMedicalgraphFromMetadata(company.meta)
          : readPsychiatrygraphFromMetadata(company.meta);
  const patient = (store.patients || []).find((p) => p.id === opts.refId);
  if (!patient) return null;
  const medical = buildPatientMedicalShare(patient);
  const health =
    'clinical' in patient && patient.clinical
      ? healthSummaryLabel(patient.clinical)
      : undefined;
  return {
    name: patient.name,
    email: patient.email,
    phone: patient.phone,
    id_hint: maskId(
      (patient as { id_number?: string }).id_number ||
        patient.medical?.id_number
    ),
    brand,
    kind: opts.kind,
    health,
    medical,
    captured_at: now,
  };
}

export async function requestProfileShare(opts: {
  profile: B2cProfile;
  fromCompanyId: number;
  fromKind: AdvisorShareKind;
  fromRefId: string;
  toCompanyId: number;
  toKind: AdvisorShareKind;
  requestedBy: 'member' | 'desk';
  note?: string | null;
}): Promise<{ ok: true; share: ProfileShare } | { ok: false; error: string }> {
  if (opts.fromCompanyId === opts.toCompanyId) {
    return { ok: false, error: 'Pick a different Advisor to share with' };
  }
  const linkedFrom = (opts.profile.memberships || []).some(
    (m) =>
      m.active !== false &&
      m.company_id === opts.fromCompanyId &&
      m.kind === opts.fromKind &&
      m.ref_id === opts.fromRefId
  );
  const memberHasFrom = linkedFrom || opts.requestedBy === 'desk';
  if (!memberHasFrom) {
    return { ok: false, error: 'That profile is not on this member wallet' };
  }

  const associated = await companiesAreAssociated(
    opts.fromCompanyId,
    opts.toCompanyId
  );
  const memberHasTo = (opts.profile.memberships || []).some(
    (m) =>
      m.active !== false &&
      m.company_id === opts.toCompanyId &&
      isConsumerMembershipKind(m.kind)
  );
  if (!associated && !memberHasTo && opts.requestedBy === 'desk') {
    return {
      ok: false,
      error:
        'Connect with that Advisor in Network first, or the member must already use both desks',
    };
  }
  if (!associated && !memberHasTo && opts.requestedBy === 'member') {
    return {
      ok: false,
      error: 'Link both Advisors in your wallet, or ask them to connect first',
    };
  }

  const fromCo = await loadWalletCompany(opts.fromCompanyId);
  const toCo = await loadWalletCompany(opts.toCompanyId);
  if (!fromCo || !toCo) {
    return { ok: false, error: 'That Advisor could not be found' };
  }

  const existing = readMemberShares(opts.profile).find(
    (s) =>
      s.from_company_id === opts.fromCompanyId &&
      s.from_ref_id === opts.fromRefId &&
      s.to_company_id === opts.toCompanyId &&
      s.to_kind === opts.toKind &&
      (s.status === 'pending' || s.status === 'active')
  );
  if (existing) {
    return { ok: false, error: 'A share request for this pair already exists' };
  }

  const autoConsent = opts.requestedBy === 'member';
  const snapshot = autoConsent
    ? await buildShareSnapshot({
        companyId: opts.fromCompanyId,
        kind: opts.fromKind,
        refId: opts.fromRefId,
      })
    : null;

  const share: ProfileShare = {
    id: newShareId(),
    from_company_id: opts.fromCompanyId,
    from_company_name: fromCo.name,
    from_kind: opts.fromKind,
    from_ref_id: opts.fromRefId,
    to_company_id: opts.toCompanyId,
    to_company_name: toCo.name,
    to_kind: opts.toKind,
    status: autoConsent ? 'active' : 'pending',
    requested_by: opts.requestedBy,
    requested_at: new Date().toISOString(),
    decided_at: autoConsent ? new Date().toISOString() : null,
    note: opts.note || null,
    snapshot,
  };

  const next = writeMemberShares(opts.profile, [
    share,
    ...readMemberShares(opts.profile),
  ]);
  await saveB2cProfile(next);
  await upsertInbound(
    share,
    opts.profile.user_id,
    opts.profile.full_name || snapshot?.name || 'Member'
  );
  return { ok: true, share };
}

export async function decideProfileShare(opts: {
  profile: B2cProfile;
  shareId: string;
  status: 'active' | 'declined' | 'revoked';
}): Promise<{ ok: true; share: ProfileShare } | { ok: false; error: string }> {
  const shares = readMemberShares(opts.profile);
  const i = shares.findIndex((s) => s.id === opts.shareId);
  if (i < 0) return { ok: false, error: 'Share request not found' };
  const prev = shares[i];
  if (opts.status === 'active' && prev.status !== 'pending') {
    return { ok: false, error: 'Only a pending request can be approved' };
  }
  if (opts.status === 'declined' && prev.status !== 'pending') {
    return { ok: false, error: 'Only a pending request can be declined' };
  }
  if (opts.status === 'revoked' && prev.status !== 'active') {
    return { ok: false, error: 'Only an active share can be revoked' };
  }
  const snapshot =
    opts.status === 'active'
      ? (await buildShareSnapshot({
          companyId: prev.from_company_id,
          kind: prev.from_kind,
          refId: prev.from_ref_id,
        })) || prev.snapshot
      : prev.snapshot;
  const share: ProfileShare = {
    ...prev,
    status: opts.status,
    decided_at: new Date().toISOString(),
    snapshot: opts.status === 'active' ? snapshot : prev.snapshot,
  };
  const nextList = [...shares];
  nextList[i] = share;
  await saveB2cProfile(writeMemberShares(opts.profile, nextList));
  await upsertInbound(
    share,
    opts.profile.user_id,
    opts.profile.full_name || snapshot?.name || 'Member'
  );
  return { ok: true, share };
}

export async function listIncomingShares(companyId: number): Promise<
  Array<
    InboundIndex & {
      snapshot: ProfileShareSnapshot | null;
    }
  >
> {
  const dest = await loadWalletCompany(companyId);
  if (!dest) return [];
  const rows = readInbound(dest.meta).filter(
    (r) => r.status === 'active' || r.status === 'pending'
  );
  const out: Array<InboundIndex & { snapshot: ProfileShareSnapshot | null }> =
    [];
  for (const row of rows) {
    const profile = await loadB2cProfile(row.member_user_id);
    const share = profile
      ? readMemberShares(profile).find((s) => s.id === row.share_id)
      : null;
    if (!share || (share.status !== 'active' && share.status !== 'pending')) {
      continue;
    }
    const snapshot =
      share.status === 'active'
        ? (await buildShareSnapshot({
            companyId: share.from_company_id,
            kind: share.from_kind,
            refId: share.from_ref_id,
          })) || share.snapshot || null
        : null;
    out.push({
      ...row,
      status: share.status,
      snapshot,
    });
  }
  return out;
}

export function sharesForPerson(
  profile: B2cProfile,
  companyId: number,
  refId: string
): ProfileShare[] {
  return readMemberShares(profile).filter(
    (s) => s.from_company_id === companyId && s.from_ref_id === refId
  );
}

export function memberShareTargets(profile: B2cProfile): Array<{
  company_id: number;
  name: string;
  kind: AdvisorShareKind;
  ref_id: string;
}> {
  const out: Array<{
    company_id: number;
    name: string;
    kind: AdvisorShareKind;
    ref_id: string;
  }> = [];
  for (const m of profile.memberships || []) {
    if (m.active === false) continue;
    if (!isAdvisorShareKind(m.kind)) continue;
    out.push({
      company_id: m.company_id,
      name: m.brand || m.company_name,
      kind: m.kind,
      ref_id: m.ref_id,
    });
  }
  return out;
}
