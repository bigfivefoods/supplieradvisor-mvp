/**
 * Mirror service-module care threads (FitAdvisor / clinics) into a member's
 * in-app company Messages inbox once they are on the SupplierAdvisor system.
 *
 * Delivery priority:
 *  1) platform_user_id (system user) → company memberships for that user
 *  2) email match only as fallback when not yet linked to a system user
 *
 * Messages themselves live on the service store (fitgraph.threads etc.) and
 * member/patient portals read them by store person id. This fan-out is the
 * dashboard Messages view for users who also have a company workspace.
 */
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  appendCompanyMessage,
  createCompanyThread,
  readCompanyInbox,
  upsertThread,
  writeCompanyInbox,
  type CompanyMsgParticipant,
} from '@/lib/messaging/company-inbox';
import type { ServiceThread } from '@/lib/messaging/service-inbox';
import { getCanonicalUserId } from '@/lib/auth/identity';

export type ServiceModuleId =
  | 'fitgraph'
  | 'physiograph'
  | 'dentalgraph'
  | 'psychiatrygraph'
  | 'medicalgraph';

type ClientLike = {
  id: string;
  name?: string;
  email?: string | null;
  invite_email?: string | null;
  /** System user id once they are on SupplierAdvisor */
  platform_user_id?: string | null;
};

function normalizeEmail(raw: string | null | undefined): string | null {
  const e = String(raw || '')
    .toLowerCase()
    .trim();
  if (!e || !e.includes('@')) return null;
  return e;
}

function normalizeUserId(raw: string | null | undefined): string | null {
  const u = getCanonicalUserId(raw);
  return u || null;
}

/**
 * Find company profile ids where this platform user is an active team member
 * (or owns the profile).
 */
export async function resolveCompanyIdsForPlatformUser(
  userId: string
): Promise<number[]> {
  const uid = normalizeUserId(userId);
  if (!uid) return [];
  const supabase = getSupabaseServer();
  const ids = new Set<number>();

  const variants = [
    uid,
    uid.replace(/^did:privy:/i, ''),
    uid.startsWith('did:privy:') ? uid : `did:privy:${uid}`,
  ];

  const { data: byMember } = await supabase
    .from('business_users')
    .select('profile_id, user_id')
    .eq('status', 'active')
    .limit(500);
  for (const m of byMember || []) {
    const mu = String(m.user_id || '');
    if (
      variants.some(
        (v) =>
          mu === v ||
          mu.toLowerCase() === v.toLowerCase() ||
          mu.endsWith(v.replace(/^did:privy:/i, '')) ||
          v.endsWith(mu.replace(/^did:privy:/i, ''))
      )
    ) {
      const n = Number(m.profile_id);
      if (Number.isFinite(n) && n > 0) ids.add(n);
    }
  }

  const { data: byOwner } = await supabase
    .from('profiles')
    .select('id, user_id')
    .limit(200);
  for (const p of byOwner || []) {
    const pu = String(p.user_id || '');
    if (
      variants.some(
        (v) =>
          pu === v ||
          pu.toLowerCase() === v.toLowerCase() ||
          pu.endsWith(v.replace(/^did:privy:/i, '')) ||
          v.endsWith(pu.replace(/^did:privy:/i, ''))
      )
    ) {
      const n = Number(p.id);
      if (Number.isFinite(n) && n > 0) ids.add(n);
    }
  }

  return [...ids];
}

/**
 * Legacy email lookup — only for people not yet linked to a system user.
 */
export async function resolveCompanyIdsForEmail(
  email: string
): Promise<number[]> {
  const normalized = normalizeEmail(email);
  if (!normalized) return [];
  const supabase = getSupabaseServer();
  const ids = new Set<number>();

  const { data: byProfile } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', normalized)
    .limit(20);
  for (const p of byProfile || []) {
    const n = Number(p.id);
    if (Number.isFinite(n) && n > 0) ids.add(n);
  }

  const { data: byMember } = await supabase
    .from('business_users')
    .select('profile_id')
    .eq('status', 'active')
    .or(
      `email.eq."${normalized.replace(/"/g, '')}",invited_email.eq."${normalized.replace(/"/g, '')}"`
    )
    .limit(40);
  for (const m of byMember || []) {
    const n = Number(m.profile_id);
    if (Number.isFinite(n) && n > 0) ids.add(n);
  }

  return [...ids];
}

/** Resolve in-app delivery targets for a service person */
export async function resolveInAppCompanyIdsForPerson(
  person: ClientLike
): Promise<{ companyIds: number[]; via: 'platform_user' | 'email' | 'none' }> {
  const uid = normalizeUserId(person.platform_user_id);
  if (uid) {
    const ids = await resolveCompanyIdsForPlatformUser(uid);
    if (ids.length) return { companyIds: ids, via: 'platform_user' };
  }
  const email =
    normalizeEmail(person.email) || normalizeEmail(person.invite_email);
  if (email) {
    const ids = await resolveCompanyIdsForEmail(email);
    if (ids.length) return { companyIds: ids, via: 'email' };
  }
  return { companyIds: [], via: 'none' };
}

function stableServiceThreadId(
  gymCompanyId: number,
  serviceThreadId: string
): string {
  return `svc_${gymCompanyId}_${serviceThreadId}`;
}

function lastServiceMessage(thread: ServiceThread) {
  const msgs = thread.messages || [];
  return msgs[msgs.length - 1] || null;
}

function mapServiceAuthor(
  serviceThread: ServiceThread,
  gymCompanyId: number,
  gymName: string
): CompanyMsgParticipant {
  const last = lastServiceMessage(serviceThread);
  const role = last?.author_role || 'desk';
  const name =
    last?.author_name ||
    (role === 'coach'
      ? 'Coach'
      : role === 'practitioner'
        ? 'Practitioner'
        : gymName);
  return {
    kind: 'company',
    ref_id: String(gymCompanyId),
    company_id: gymCompanyId,
    name: `${name} · ${gymName}`,
    role_label:
      role === 'coach' || role === 'practitioner' || role === 'desk'
        ? role
        : 'care',
  };
}

export function shouldFanOutServiceMessage(action: string): boolean {
  return (
    action === 'message_create_thread' ||
    action === 'create_thread' ||
    action === 'message_start' ||
    action === 'message_post' ||
    action === 'post_message' ||
    action === 'message_reply'
  );
}

/**
 * After a service thread is created or updated, mirror the latest staff
 * message into each member/patient's in-app company inbox(es).
 * Prefer platform_user_id; email only if not linked to a system user yet.
 */
export async function fanOutServiceThreadToMemberCompanies(opts: {
  gymCompanyId: number;
  gymName: string;
  module: ServiceModuleId;
  serviceThread: ServiceThread;
  people: ClientLike[];
}): Promise<{
  delivered: number;
  companyIds: number[];
  via: Array<'platform_user' | 'email' | 'none'>;
}> {
  const { gymCompanyId, gymName, module, serviceThread, people } = opts;
  const last = lastServiceMessage(serviceThread);
  if (!last || !String(last.body || '').trim()) {
    return { delivered: 0, companyIds: [], via: [] };
  }

  const staffRoles = new Set(['desk', 'coach', 'practitioner']);
  if (!staffRoles.has(String(last.author_role || ''))) {
    return { delivered: 0, companyIds: [], via: [] };
  }

  const memberRoles = new Set(['member', 'patient']);
  const memberParticipants = (serviceThread.participants || []).filter((p) =>
    memberRoles.has(String(p.role))
  );
  if (!memberParticipants.length) {
    return { delivered: 0, companyIds: [], via: [] };
  }

  const peopleById = new Map(people.map((p) => [String(p.id), p]));
  const author = mapServiceAuthor(serviceThread, gymCompanyId, gymName);
  const threadKey = stableServiceThreadId(gymCompanyId, serviceThread.id);
  const subject = serviceThread.subject || `Care · ${gymName}`;

  const deliveredCompanies = new Set<number>();
  const vias: Array<'platform_user' | 'email' | 'none'> = [];
  const supabase = getSupabaseServer();

  for (const mp of memberParticipants) {
    const person = peopleById.get(String(mp.ref_id));
    if (!person) {
      vias.push('none');
      continue;
    }

    const resolved = await resolveInAppCompanyIdsForPerson(person);
    vias.push(resolved.via);
    if (!resolved.companyIds.length) continue;

    const memberRef =
      normalizeUserId(person.platform_user_id) ||
      normalizeEmail(person.email) ||
      normalizeEmail(person.invite_email) ||
      person.id;

    for (const memberCompanyId of resolved.companyIds) {
      if (memberCompanyId === gymCompanyId) continue;
      if (deliveredCompanies.has(memberCompanyId)) continue;

      try {
        const { data: prof } = await supabase
          .from('profiles')
          .select('id, trading_name, legal_name, metadata')
          .eq('id', memberCompanyId)
          .maybeSingle();
        if (!prof) continue;

        const meta =
          prof.metadata && typeof prof.metadata === 'object'
            ? { ...(prof.metadata as Record<string, unknown>) }
            : {};
        const inbox = readCompanyInbox(meta);
        let threads = inbox.threads || [];

        const memberDesk: CompanyMsgParticipant = {
          kind: 'desk',
          ref_id: 'desk',
          company_id: memberCompanyId,
          name: String(prof.trading_name || prof.legal_name || 'Your company'),
        };
        const memberPerson: CompanyMsgParticipant = {
          kind: 'user',
          ref_id: memberRef,
          company_id: memberCompanyId,
          name: person?.name || memberRef,
          role_label: 'member',
        };

        const existing = threads.find(
          (t) =>
            t.id === threadKey ||
            (t.service_thread_id === serviceThread.id &&
              t.peer_company_id === gymCompanyId)
        );

        if (existing) {
          const lastCompany = existing.messages[existing.messages.length - 1];
          if (
            lastCompany &&
            lastCompany.body === last.body &&
            lastCompany.author.company_id === gymCompanyId &&
            Math.abs(
              Date.parse(lastCompany.created_at) - Date.parse(last.created_at)
            ) < 5000
          ) {
            deliveredCompanies.add(memberCompanyId);
            continue;
          }
          const updated = appendCompanyMessage(
            {
              ...existing,
              subject: subject || existing.subject,
              service_module: module,
              service_thread_id: serviceThread.id,
              peer_company_id: gymCompanyId,
              peer_company_name: gymName,
            },
            last.body,
            author,
            last.created_at || new Date().toISOString()
          );
          threads = upsertThread(threads, updated);
        } else {
          const created = createCompanyThread({
            id: threadKey,
            channel: 'service',
            subject,
            company_ids: [memberCompanyId, gymCompanyId],
            participants: [memberDesk, memberPerson, author],
            body: last.body,
            author,
            peer_company_id: gymCompanyId,
            peer_company_name: gymName,
            peer_relation: 'peer',
            service_module: module,
            service_thread_id: serviceThread.id,
            now: last.created_at || new Date().toISOString(),
          });
          threads = upsertThread(threads, created);
        }

        const nextMeta = writeCompanyInbox(meta, { threads });
        const { error } = await supabase
          .from('profiles')
          .update({
            metadata: nextMeta,
            updated_at: new Date().toISOString(),
          })
          .eq('id', memberCompanyId);
        if (error) {
          console.warn(
            '[service-to-company] save failed',
            memberCompanyId,
            error.message
          );
          continue;
        }
        deliveredCompanies.add(memberCompanyId);
      } catch (e) {
        console.warn('[service-to-company] fan-out error', e);
      }
    }
  }

  return {
    delivered: deliveredCompanies.size,
    companyIds: [...deliveredCompanies],
    via: vias,
  };
}
