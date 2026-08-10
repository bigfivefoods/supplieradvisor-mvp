/**
 * Mirror service-module care threads (FitAdvisor / clinics) into a member's
 * company Messages inbox when the member email matches a platform user.
 *
 * Example: Coach at VUKA Fitness messages client craig@… → thread appears on
 * Big Five Foods company Messages (not only on VUKA FitAdvisor desk).
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
  /** Portal invite address — used when primary email empty */
  invite_email?: string | null;
};

function normalizeEmail(raw: string | null | undefined): string | null {
  const e = String(raw || '')
    .toLowerCase()
    .trim();
  if (!e || !e.includes('@')) return null;
  return e;
}

/**
 * Find company profile ids where this email is on the company or an active team row.
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

  // Case-insensitive fallback if DB stored mixed case (rare)
  if (ids.size === 0) {
    const { data: membersLoose } = await supabase
      .from('business_users')
      .select('profile_id, email, invited_email')
      .eq('status', 'active')
      .limit(500);
    for (const m of membersLoose || []) {
      const a = normalizeEmail(m.email as string);
      const b = normalizeEmail(m.invited_email as string);
      if (a === normalized || b === normalized) {
        const n = Number(m.profile_id);
        if (Number.isFinite(n) && n > 0) ids.add(n);
      }
    }
  }

  return [...ids];
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

/**
 * After a service thread is created or updated, mirror the latest message
 * into each member/patient participant's company inbox(es) when email matches.
 */
/** True when this action should mirror to member company inboxes */
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

export async function fanOutServiceThreadToMemberCompanies(opts: {
  gymCompanyId: number;
  gymName: string;
  module: ServiceModuleId;
  serviceThread: ServiceThread;
  /** Client/patient book for email lookup */
  people: ClientLike[];
}): Promise<{ delivered: number; companyIds: number[] }> {
  const { gymCompanyId, gymName, module, serviceThread, people } = opts;
  const last = lastServiceMessage(serviceThread);
  if (!last || !String(last.body || '').trim()) {
    return { delivered: 0, companyIds: [] };
  }

  // Only fan-out messages authored by gym staff (not member self-posts)
  const staffRoles = new Set(['desk', 'coach', 'practitioner']);
  if (!staffRoles.has(String(last.author_role || ''))) {
    return { delivered: 0, companyIds: [] };
  }

  const memberRoles = new Set(['member', 'patient']);
  const memberParticipants = (serviceThread.participants || []).filter((p) =>
    memberRoles.has(String(p.role))
  );
  if (!memberParticipants.length) {
    return { delivered: 0, companyIds: [] };
  }

  const peopleById = new Map(people.map((p) => [String(p.id), p]));
  const author = mapServiceAuthor(serviceThread, gymCompanyId, gymName);
  const threadKey = stableServiceThreadId(gymCompanyId, serviceThread.id);
  const subject =
    serviceThread.subject ||
    `Care · ${gymName}`;

  const deliveredCompanies = new Set<number>();
  const supabase = getSupabaseServer();

  for (const mp of memberParticipants) {
    const person = peopleById.get(String(mp.ref_id));
    // Prefer live email; fall back to invite_email (kept in sync on portal edits)
    const email =
      normalizeEmail(person?.email) || normalizeEmail(person?.invite_email);
    if (!email) continue;

    const companyIds = await resolveCompanyIdsForEmail(email);
    for (const memberCompanyId of companyIds) {
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
          name: String(
            prof.trading_name || prof.legal_name || 'Your company'
          ),
        };
        const memberPerson: CompanyMsgParticipant = {
          kind: 'user',
          ref_id: email,
          company_id: memberCompanyId,
          name: person?.name || email,
          role_label: 'member',
        };

        const existing = threads.find(
          (t) =>
            t.id === threadKey ||
            (t.service_thread_id === serviceThread.id &&
              t.peer_company_id === gymCompanyId) ||
            (t.channel === 'service' &&
              t.peer_company_id === gymCompanyId &&
              !t.archived &&
              // one open care thread per gym if no service_thread match
              t.service_thread_id === serviceThread.id)
        );

        // Avoid duplicating the exact same last body from same author
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
          // createCompanyThread already embeds first message as author — good
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
  };
}
