/**
 * Pull care/service messages into the viewer's system-wide inbox.
 *
 * Discovers advisor modules on companies the user is linked to (membership,
 * client email, or platform_user_id on client/patient records) and mirrors
 * staff→member threads into personal + selected company inboxes.
 */
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  getCanonicalUserId,
  userIdMatchVariants,
} from '@/lib/auth/identity';
import {
  appendCompanyMessage,
  createCompanyThread,
  readCompanyInbox,
  upsertThread,
  writeCompanyInbox,
  type CompanyMsgParticipant,
  type CompanyThread,
} from '@/lib/messaging/company-inbox';
import {
  resolveCompanyIdsForPlatformUser,
  type ServiceModuleId,
} from '@/lib/messaging/service-to-company';
import {
  mergeInboxThreads,
  readUserInbox,
  resolveEmailsForPlatformUser,
  upsertUserInboxThread,
  writeUserInboxThreads,
} from '@/lib/messaging/user-inbox';
import type { ServiceThread } from '@/lib/messaging/service-inbox';
import { FITGRAPH_META_KEY } from '@/lib/fitness/fitgraph';

const MODULES: Array<{
  id: ServiceModuleId;
  metaKey: string;
  peopleKey: 'clients' | 'patients';
}> = [
  { id: 'fitgraph', metaKey: FITGRAPH_META_KEY, peopleKey: 'clients' },
  { id: 'physiograph', metaKey: 'physiograph', peopleKey: 'patients' },
  { id: 'dentalgraph', metaKey: 'dentalgraph', peopleKey: 'patients' },
  { id: 'psychiatrygraph', metaKey: 'psychiatrygraph', peopleKey: 'patients' },
  { id: 'medicalgraph', metaKey: 'medicalgraph', peopleKey: 'patients' },
];

function emailLocal(email: string): string {
  return email.split('@')[0] || email;
}

function personMatches(
  person: {
    id?: string;
    email?: string | null;
    invite_email?: string | null;
    platform_user_id?: string | null;
    name?: string;
  },
  userId: string,
  emails: Set<string>
): boolean {
  const puid = getCanonicalUserId(person.platform_user_id);
  if (puid) {
    const variants = userIdMatchVariants(userId);
    if (
      variants.some(
        (v) =>
          v === puid ||
          v.toLowerCase() === puid.toLowerCase() ||
          puid.endsWith(v.replace(/^did:privy:/i, ''))
      )
    ) {
      return true;
    }
  }
  for (const e of [person.email, person.invite_email]) {
    const n = String(e || '')
      .toLowerCase()
      .trim();
    if (n && emails.has(n)) return true;
    // Same local-part as any of the user's emails (craig@a ↔ craig@b)
    if (n.includes('@')) {
      const local = emailLocal(n);
      if (
        local.length >= 3 &&
        [...emails].some((ue) => emailLocal(ue) === local)
      ) {
        return true;
      }
    }
  }
  return false;
}

function stableServiceThreadId(
  gymCompanyId: number,
  serviceThreadId: string
): string {
  return `svc_${gymCompanyId}_${serviceThreadId}`;
}

function mapAuthor(
  serviceThread: ServiceThread,
  gymCompanyId: number,
  gymName: string
): CompanyMsgParticipant {
  const last = (serviceThread.messages || []).slice(-1)[0];
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

function threadInvolvesPerson(
  thread: ServiceThread,
  personId: string
): boolean {
  return (thread.participants || []).some(
    (p) =>
      (p.role === 'member' || p.role === 'patient') &&
      String(p.ref_id) === String(personId)
  );
}

function hasStaffMessage(thread: ServiceThread): boolean {
  return (thread.messages || []).some((m) =>
    ['desk', 'coach', 'practitioner'].includes(String(m.author_role || ''))
  );
}

/**
 * Discover company profile ids to scan for care modules.
 */
async function companiesToScan(userId: string): Promise<number[]> {
  const ids = new Set<number>(
    await resolveCompanyIdsForPlatformUser(userId)
  );
  // Also scan companies where email local-part matches a client — handled inside scan
  return [...ids];
}

/**
 * Sync care messages for this platform user into personal inbox and
 * optionally the currently selected company workspace.
 */
export async function syncInboundCareMessagesForUser(opts: {
  userId: string;
  /** Active company workspace — also persist copies here */
  activeCompanyId?: number | null;
}): Promise<{
  pulled: number;
  threads: CompanyThread[];
  personalThreads: CompanyThread[];
}> {
  const userId = getCanonicalUserId(opts.userId);
  if (!userId) {
    return { pulled: 0, threads: [], personalThreads: [] };
  }

  const emails = new Set(await resolveEmailsForPlatformUser(userId));
  const companyIds = await companiesToScan(userId);
  if (!companyIds.length && !emails.size) {
    const personal = await readUserInbox(userId);
    return {
      pulled: 0,
      threads: [],
      personalThreads: personal?.threads || [],
    };
  }

  const supabase = getSupabaseServer();
  // Load membership companies + a few extra profiles that share any of our emails
  // (gyms often share owner email with BFF in demo data; also finds client emails)
  const emailList = [...emails].slice(0, 20);
  if (emailList.length) {
    const or = emailList.map((e) => `email.eq.${e}`).join(',');
    const { data: byEmail } = await supabase
      .from('profiles')
      .select('id')
      .or(or)
      .limit(40);
    for (const p of byEmail || []) {
      const n = Number(p.id);
      if (Number.isFinite(n) && n > 0) companyIds.push(n);
    }
  }

  const uniqueCompanyIds = [...new Set(companyIds)];
  const mirrored: CompanyThread[] = [];

  // Batch load profiles
  for (let i = 0; i < uniqueCompanyIds.length; i += 40) {
    const chunk = uniqueCompanyIds.slice(i, i + 40);
    const { data: profs } = await supabase
      .from('profiles')
      .select('id, trading_name, legal_name, metadata')
      .in('id', chunk);

    for (const prof of profs || []) {
      const gymId = Number(prof.id);
      const gymName = String(
        prof.trading_name || prof.legal_name || `Company ${gymId}`
      );
      const meta =
        prof.metadata && typeof prof.metadata === 'object'
          ? (prof.metadata as Record<string, unknown>)
          : {};

      for (const mod of MODULES) {
        const store = meta[mod.metaKey];
        if (!store || typeof store !== 'object') continue;
        const s = store as {
          threads?: ServiceThread[];
          clients?: Array<Record<string, unknown>>;
          patients?: Array<Record<string, unknown>>;
          settings?: { brand_name?: string };
        };
        const people = (
          (mod.peopleKey === 'clients' ? s.clients : s.patients) || []
        ) as Array<{
          id: string;
          email?: string | null;
          invite_email?: string | null;
          platform_user_id?: string | null;
          name?: string;
        }>;
        const myPeople = people.filter((p) =>
          personMatches(p, userId, emails)
        );
        if (!myPeople.length) continue;

        const myIds = new Set(myPeople.map((p) => String(p.id)));
        const brand = String(s.settings?.brand_name || gymName);
        const threads = Array.isArray(s.threads) ? s.threads : [];

        for (const th of threads) {
          if (th.archived) continue;
          if (!hasStaffMessage(th)) continue;
          const matchedPerson = myPeople.find((p) =>
            threadInvolvesPerson(th, p.id)
          );
          if (!matchedPerson) continue;

          // Build company-inbox style thread with full message history
          const threadKey = stableServiceThreadId(gymId, th.id);
          const author = mapAuthor(th, gymId, brand);
          const memberPerson: CompanyMsgParticipant = {
            kind: 'user',
            ref_id: userId,
            company_id: opts.activeCompanyId || 0,
            name: matchedPerson.name || 'You',
            role_label: 'member',
          };

          const staffMsgs = (th.messages || []).filter((m) =>
            ['desk', 'coach', 'practitioner', 'member', 'patient'].includes(
              String(m.author_role || '')
            )
          );
          if (!staffMsgs.length) continue;

          // Replay into a single CompanyThread
          let companyThread: CompanyThread | null = null;
          for (const m of staffMsgs) {
            const msgAuthor: CompanyMsgParticipant =
              m.author_role === 'member' || m.author_role === 'patient'
                ? memberPerson
                : {
                    kind: 'company',
                    ref_id: String(gymId),
                    company_id: gymId,
                    name: `${m.author_name || brand} · ${brand}`,
                    role_label: String(m.author_role || 'care'),
                  };
            if (!companyThread) {
              companyThread = createCompanyThread({
                id: threadKey,
                channel: 'service',
                subject: th.subject || `Care · ${brand}`,
                company_ids: [gymId, opts.activeCompanyId || gymId].filter(
                  Boolean
                ) as number[],
                participants: [memberPerson, author],
                body: m.body,
                author: msgAuthor,
                peer_company_id: gymId,
                peer_company_name: brand,
                peer_relation: 'peer',
                service_module: mod.id,
                service_thread_id: th.id,
                now: m.created_at || new Date().toISOString(),
              });
              // Fix first message author
              if (companyThread.messages[0]) {
                companyThread.messages[0] = {
                  ...companyThread.messages[0],
                  author: msgAuthor,
                  body: m.body,
                  created_at: m.created_at || companyThread.messages[0].created_at,
                };
              }
            } else {
              companyThread = appendCompanyMessage(
                companyThread,
                m.body,
                msgAuthor,
                m.created_at || new Date().toISOString()
              );
            }
          }
          if (companyThread) mirrored.push(companyThread);
          void myIds;
        }
      }
    }
  }

  // Persist into personal inbox
  let personal = (await readUserInbox(userId))?.threads || [];
  for (const t of mirrored) {
    personal = upsertThread(personal, t);
    await upsertUserInboxThread(userId, t);
  }

  // Persist into active company workspace so it's visible even without personal storage
  if (opts.activeCompanyId && mirrored.length) {
    const { data: active } = await supabase
      .from('profiles')
      .select('id, metadata')
      .eq('id', opts.activeCompanyId)
      .maybeSingle();
    if (active) {
      const meta =
        active.metadata && typeof active.metadata === 'object'
          ? { ...(active.metadata as Record<string, unknown>) }
          : {};
      const inbox = readCompanyInbox(meta);
      let threads = inbox.threads || [];
      for (const t of mirrored) {
        threads = upsertThread(threads, t);
      }
      const nextMeta = writeCompanyInbox(meta, { threads });
      await supabase
        .from('profiles')
        .update({
          metadata: nextMeta,
          updated_at: new Date().toISOString(),
        })
        .eq('id', opts.activeCompanyId);
    }
  }

  // Also persist into every company the user belongs to (true system-wide)
  const allCompanies = await resolveCompanyIdsForPlatformUser(userId);
  for (const cid of allCompanies) {
    if (cid === opts.activeCompanyId) continue;
    if (!mirrored.length) break;
    try {
      const { data: prof } = await supabase
        .from('profiles')
        .select('id, metadata')
        .eq('id', cid)
        .maybeSingle();
      if (!prof) continue;
      const meta =
        prof.metadata && typeof prof.metadata === 'object'
          ? { ...(prof.metadata as Record<string, unknown>) }
          : {};
      const inbox = readCompanyInbox(meta);
      let threads = inbox.threads || [];
      for (const t of mirrored) {
        threads = upsertThread(threads, t);
      }
      const nextMeta = writeCompanyInbox(meta, { threads });
      await supabase
        .from('profiles')
        .update({
          metadata: nextMeta,
          updated_at: new Date().toISOString(),
        })
        .eq('id', cid);
    } catch (e) {
      console.warn('[sync-inbound] company', cid, e);
    }
  }

  personal = (await readUserInbox(userId))?.threads || personal;
  await writeUserInboxThreads(userId, personal).catch(() => undefined);

  return {
    pulled: mirrored.length,
    threads: mirrored,
    personalThreads: personal,
  };
}

/** Merge active company threads with personal after optional sync */
export async function loadMergedInboxForUser(opts: {
  userId: string | null | undefined;
  companyThreads: CompanyThread[];
  activeCompanyId: number;
  /** When true, pull care messages from advisor modules first */
  syncCare?: boolean;
}): Promise<{
  threads: CompanyThread[];
  personalThreads: CompanyThread[];
  synced: number;
}> {
  const userId = getCanonicalUserId(opts.userId);
  let synced = 0;
  if (userId && opts.syncCare !== false) {
    try {
      const result = await syncInboundCareMessagesForUser({
        userId,
        activeCompanyId: opts.activeCompanyId,
      });
      synced = result.pulled;
    } catch (e) {
      console.warn('[loadMergedInbox] sync', e);
    }
  }

  const personal = userId
    ? (await readUserInbox(userId))?.threads || []
    : [];

  // Re-read company threads after sync may have written them
  let companyThreads = opts.companyThreads;
  if (synced > 0) {
    try {
      const supabase = getSupabaseServer();
      const { data: prof } = await supabase
        .from('profiles')
        .select('metadata')
        .eq('id', opts.activeCompanyId)
        .maybeSingle();
      const meta =
        prof?.metadata && typeof prof.metadata === 'object'
          ? (prof.metadata as Record<string, unknown>)
          : {};
      companyThreads = readCompanyInbox(meta).threads || companyThreads;
    } catch {
      /* soft */
    }
  }

  return {
    threads: mergeInboxThreads(companyThreads, personal),
    personalThreads: personal,
    synced,
  };
}
