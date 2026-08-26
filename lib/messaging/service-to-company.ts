/**
 * Mirror service-module care threads (GymAdvisor / clinics) into a member's
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
  type CompanyThread,
} from '@/lib/messaging/company-inbox';
import type { ServiceThread } from '@/lib/messaging/service-inbox';
import {
  getCanonicalUserId,
  userIdMatchVariants,
} from '@/lib/auth/identity';
import { upsertUserInboxThread } from '@/lib/messaging/user-inbox';

export type ServiceModuleId =
  | 'fitgraph'
  | 'physiograph'
  | 'dentalgraph'
  | 'psychiatrygraph'
  | 'medicalgraph'
  | 'vetgraph';

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
 * (or owns the profile). Uses indexed user_id lookups + id variants.
 */
export async function resolveCompanyIdsForPlatformUser(
  userId: string
): Promise<number[]> {
  const uid = normalizeUserId(userId);
  if (!uid) return [];
  const supabase = getSupabaseServer();
  const ids = new Set<number>();
  const variants = userIdMatchVariants(uid);

  const { data: byMember } = await supabase
    .from('business_users')
    .select('profile_id, user_id')
    .eq('status', 'active')
    .in('user_id', variants)
    .limit(100);
  for (const m of byMember || []) {
    const n = Number(m.profile_id);
    if (Number.isFinite(n) && n > 0) ids.add(n);
  }

  // Owner profiles (profiles.user_id)
  const { data: byOwner } = await supabase
    .from('profiles')
    .select('id, user_id')
    .in('user_id', variants)
    .limit(50);
  for (const p of byOwner || []) {
    const n = Number(p.id);
    if (Number.isFinite(n) && n > 0) ids.add(n);
  }

  return [...ids];
}

/**
 * Active platform user ids for members of a company (for trade fan-out).
 */
export async function resolvePlatformUserIdsForCompany(
  companyId: number
): Promise<string[]> {
  if (!Number.isFinite(companyId) || companyId <= 0) return [];
  const supabase = getSupabaseServer();
  const out = new Set<string>();

  const { data: members } = await supabase
    .from('business_users')
    .select('user_id')
    .eq('profile_id', companyId)
    .eq('status', 'active')
    .not('user_id', 'is', null)
    .limit(200);
  for (const m of members || []) {
    const u = normalizeUserId(m.user_id as string);
    if (u) out.add(u);
  }

  const { data: owner } = await supabase
    .from('profiles')
    .select('user_id')
    .eq('id', companyId)
    .maybeSingle();
  const ou = normalizeUserId(owner?.user_id as string | undefined);
  if (ou) out.add(ou);

  return [...out];
}

/**
 * Deliver a company thread copy into:
 *  1) personal user inbox (platform_user_inboxes) — always when user id known
 *  2) every company workspace inbox that user belongs to
 *
 * Call after any message that should be received system-wide by user id.
 */
export async function deliverThreadToPlatformUsers(opts: {
  thread: CompanyThread;
  userIds: string[];
  /** Skip writing into this company (already saved by caller) */
  skipCompanyId?: number | null;
}): Promise<{ users: number; companies: number }> {
  const userIds = [
    ...new Set(
      (opts.userIds || [])
        .map((u) => normalizeUserId(u))
        .filter(Boolean) as string[]
    ),
  ];
  if (!userIds.length) return { users: 0, companies: 0 };

  let users = 0;
  let companies = 0;
  const companyDone = new Set<number>();
  if (opts.skipCompanyId) companyDone.add(opts.skipCompanyId);

  const supabase = getSupabaseServer();

  for (const uid of userIds) {
    try {
      const personal = await upsertUserInboxThread(uid, opts.thread);
      if (personal.ok) users += 1;
    } catch (e) {
      console.warn('[deliver] user inbox', uid, e);
    }

    try {
      const companyIds = await resolveCompanyIdsForPlatformUser(uid);
      for (const companyId of companyIds) {
        if (companyDone.has(companyId)) continue;
        companyDone.add(companyId);
        try {
          const { data: prof } = await supabase
            .from('profiles')
            .select('id, metadata')
            .eq('id', companyId)
            .maybeSingle();
          if (!prof) continue;
          const meta =
            prof.metadata && typeof prof.metadata === 'object'
              ? { ...(prof.metadata as Record<string, unknown>) }
              : {};
          const inbox = readCompanyInbox(meta);
          const nextThreads = upsertThread(inbox.threads || [], opts.thread);
          const nextMeta = writeCompanyInbox(meta, { threads: nextThreads });
          const { error } = await supabase
            .from('profiles')
            .update({
              metadata: nextMeta,
              updated_at: new Date().toISOString(),
            })
            .eq('id', companyId);
          if (!error) companies += 1;
        } catch (e) {
          console.warn('[deliver] company inbox', companyId, e);
        }
      }
    } catch (e) {
      console.warn('[deliver] resolve companies', uid, e);
    }
  }

  return { users, companies };
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

/**
 * Resolve platform user id from an email local-part when it uniquely maps
 * to one active system user (e.g. craig@gym.com → craig@company.com).
 */
export async function resolvePlatformUserIdFromEmailLocal(
  email: string
): Promise<string | null> {
  const normalized = normalizeEmail(email);
  if (!normalized) return null;
  const local = normalized.split('@')[0] || '';
  if (local.length < 3) return null;
  const supabase = getSupabaseServer();
  // Match any business_users email with same local-part
  const { data: rows } = await supabase
    .from('business_users')
    .select('user_id, email, invited_email')
    .eq('status', 'active')
    .not('user_id', 'is', null)
    .or(
      `email.ilike."${local}@%",invited_email.ilike."${local}@%"`
    )
    .limit(40);

  const userIds = new Set<string>();
  for (const r of rows || []) {
    const e1 = normalizeEmail(r.email as string);
    const e2 = normalizeEmail(r.invited_email as string);
    const hit =
      (e1 && e1.split('@')[0] === local) ||
      (e2 && e2.split('@')[0] === local);
    if (!hit) continue;
    const u = normalizeUserId(r.user_id as string);
    if (u) userIds.add(u);
  }
  if (userIds.size === 1) return [...userIds][0];
  return null;
}

/** Resolve in-app delivery targets for a service person */
export async function resolveInAppCompanyIdsForPerson(
  person: ClientLike
): Promise<{
  companyIds: number[];
  via: 'platform_user' | 'email' | 'email_local' | 'none';
  platformUserId?: string | null;
}> {
  let uid = normalizeUserId(person.platform_user_id);
  if (uid) {
    const ids = await resolveCompanyIdsForPlatformUser(uid);
    if (ids.length) {
      return { companyIds: ids, via: 'platform_user', platformUserId: uid };
    }
  }
  const email =
    normalizeEmail(person.email) || normalizeEmail(person.invite_email);
  if (email) {
    const ids = await resolveCompanyIdsForEmail(email);
    if (ids.length) {
      return { companyIds: ids, via: 'email', platformUserId: uid };
    }
    // Same person, different email domains (gym portal vs company login)
    const inferred = await resolvePlatformUserIdFromEmailLocal(email);
    if (inferred) {
      const ids2 = await resolveCompanyIdsForPlatformUser(inferred);
      if (ids2.length) {
        return {
          companyIds: ids2,
          via: 'email_local',
          platformUserId: inferred,
        };
      }
    }
  }
  return { companyIds: [], via: 'none', platformUserId: uid };
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
  userIds: string[];
  via: Array<'platform_user' | 'email' | 'email_local' | 'none'>;
}> {
  const { gymCompanyId, gymName, module, serviceThread, people } = opts;
  const last = lastServiceMessage(serviceThread);
  if (!last || !String(last.body || '').trim()) {
    return { delivered: 0, companyIds: [], userIds: [], via: [] };
  }

  const staffRoles = new Set(['desk', 'coach', 'practitioner']);
  if (!staffRoles.has(String(last.author_role || ''))) {
    return { delivered: 0, companyIds: [], userIds: [], via: [] };
  }

  const memberRoles = new Set(['member', 'patient']);
  const memberParticipants = (serviceThread.participants || []).filter((p) =>
    memberRoles.has(String(p.role))
  );
  if (!memberParticipants.length) {
    return { delivered: 0, companyIds: [], userIds: [], via: [] };
  }

  const peopleById = new Map(people.map((p) => [String(p.id), p]));
  const author = mapServiceAuthor(serviceThread, gymCompanyId, gymName);
  const threadKey = stableServiceThreadId(gymCompanyId, serviceThread.id);
  const subject = serviceThread.subject || `Care · ${gymName}`;

  const deliveredCompanies = new Set<number>();
  const deliveredUsers = new Set<string>();
  const vias: Array<'platform_user' | 'email' | 'email_local' | 'none'> = [];
  const supabase = getSupabaseServer();

  for (const mp of memberParticipants) {
    const person = peopleById.get(String(mp.ref_id));
    if (!person) {
      vias.push('none');
      continue;
    }

    const resolved = await resolveInAppCompanyIdsForPerson(person);
    vias.push(resolved.via);

    // Prefer linked or inferred system user id so delivery is system-wide
    const platformUid =
      normalizeUserId(person.platform_user_id) ||
      normalizeUserId(resolved.platformUserId);
    // Persist inferred link on the in-memory person so later steps use it
    if (platformUid && !person.platform_user_id) {
      person.platform_user_id = platformUid;
    }
    const memberRef =
      platformUid ||
      normalizeEmail(person.email) ||
      normalizeEmail(person.invite_email) ||
      person.id;

    // Build a canonical service thread snapshot for this member
    const memberPerson: CompanyMsgParticipant = {
      kind: 'user',
      ref_id: memberRef,
      company_id: resolved.companyIds[0] || 0,
      name: person?.name || memberRef,
      role_label: 'member',
    };

    // Always deliver to personal user inbox when linked to a system user
    if (platformUid) {
      try {
        const personalThread = createCompanyThread({
          id: threadKey,
          channel: 'service',
          subject,
          company_ids: [gymCompanyId, ...resolved.companyIds],
          participants: [memberPerson, author],
          body: last.body,
          author,
          peer_company_id: gymCompanyId,
          peer_company_name: gymName,
          peer_relation: 'peer',
          service_module: module,
          service_thread_id: serviceThread.id,
          now: last.created_at || new Date().toISOString(),
        });
        // If already exists on personal, append instead
        const { readUserInbox } = await import('@/lib/messaging/user-inbox');
        const personal = await readUserInbox(platformUid);
        const existingP = (personal?.threads || []).find(
          (t) => t.id === threadKey
        );
        if (existingP) {
          const lastP = existingP.messages[existingP.messages.length - 1];
          if (
            !(
              lastP &&
              lastP.body === last.body &&
              Math.abs(
                Date.parse(lastP.created_at) - Date.parse(last.created_at)
              ) < 5000
            )
          ) {
            await upsertUserInboxThread(
              platformUid,
              appendCompanyMessage(
                {
                  ...existingP,
                  subject: subject || existingP.subject,
                  service_module: module,
                  service_thread_id: serviceThread.id,
                  peer_company_id: gymCompanyId,
                  peer_company_name: gymName,
                },
                last.body,
                author,
                last.created_at || new Date().toISOString()
              )
            );
          }
        } else {
          await upsertUserInboxThread(platformUid, personalThread);
        }
        deliveredUsers.add(platformUid);
      } catch (e) {
        console.warn('[service-to-company] user inbox', e);
      }
    }

    if (!resolved.companyIds.length) continue;

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
            participants: [
              memberDesk,
              { ...memberPerson, company_id: memberCompanyId },
              author,
            ],
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
    delivered: deliveredCompanies.size + deliveredUsers.size,
    companyIds: [...deliveredCompanies],
    userIds: [...deliveredUsers],
    via: vias,
  };
}
