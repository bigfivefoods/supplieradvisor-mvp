/**
 * Platform company + personal messaging API.
 * GET  ?companyId= — company threads merged with personal user inbox
 * POST { companyId, action, ... } — create / reply / mark_read / archive
 *
 * Delivery is by platform user id: recipients get a personal inbox copy
 * and a copy on every company workspace they belong to.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  requireCompanyAccess,
  legacyPrivyFrom,
} from '@/lib/auth/api-auth';
import { getCanonicalUserId } from '@/lib/auth/identity';
import {
  applyCompanyMessageAction,
  markThreadRead,
  readCompanyInbox,
  summariseCompanyInbox,
  writeCompanyInbox,
  upsertThread,
  normalizeThreads,
  type CompanyMsgParticipant,
  type CompanyThread,
} from '@/lib/messaging/company-inbox';
import { deliverThreadToPlatformUsers } from '@/lib/messaging/service-to-company';
import {
  mergeInboxThreads,
  readUserInbox,
  targetUserIdsFromThread,
  threadVisibleToPlatformUser,
  threadsForPlatformUser,
  writeUserInboxThreads,
} from '@/lib/messaging/user-inbox';
import { loadMergedInboxForUser } from '@/lib/messaging/sync-inbound-care';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function loadMeta(companyId: number) {
  const supabase = getSupabaseServer();
  const { data: prof } = await supabase
    .from('profiles')
    .select('id, trading_name, legal_name, metadata')
    .eq('id', companyId)
    .maybeSingle();
  const meta =
    prof?.metadata && typeof prof.metadata === 'object'
      ? { ...(prof.metadata as Record<string, unknown>) }
      : {};
  return {
    meta,
    tradingName: String(
      prof?.trading_name || prof?.legal_name || `Company ${companyId}`
    ),
    store: readCompanyInbox(meta),
  };
}

async function saveInbox(
  companyId: number,
  meta: Record<string, unknown>,
  threads: CompanyThread[]
) {
  const supabase = getSupabaseServer();
  const nextMeta = writeCompanyInbox(meta, { threads });
  const { error } = await supabase
    .from('profiles')
    .update({
      metadata: nextMeta,
      updated_at: new Date().toISOString(),
    })
    .eq('id', companyId);
  if (error) throw new Error(error.message);
}

/** Merge dual-write thread into peer company's inbox without dropping theirs */
async function dualWriteToPeer(
  peerCompanyId: number,
  thread: CompanyThread
) {
  const { meta, store } = await loadMeta(peerCompanyId);
  const next = upsertThread(store.threads, thread);
  await saveInbox(peerCompanyId, meta, next);
}

async function loadDirectory(companyId: number) {
  const supabase = getSupabaseServer();

  // Colleagues
  const { data: members } = await supabase
    .from('business_users')
    .select('id, user_id, name, email, role, status')
    .eq('profile_id', companyId)
    .eq('status', 'active')
    .limit(200);

  const colleagues = (members || []).map((m) => ({
    id: String(m.user_id || m.id),
    member_id: Number(m.id),
    name: String(m.name || m.email || 'Teammate'),
    email: m.email ? String(m.email) : undefined,
    role: m.role ? String(m.role) : undefined,
  }));

  // Connected network peers
  const { data: edges } = await supabase
    .from('business_connections')
    .select(
      'id, requester_profile_id, requestee_profile_id, status, connection_type'
    )
    .or(
      `requester_profile_id.eq.${companyId},requestee_profile_id.eq.${companyId}`
    )
    .eq('status', 'connected')
    .limit(300);

  const peerIds = new Set<number>();
  const edgeByPeer = new Map<
    number,
    { connection_id: string; connection_type?: string }
  >();
  for (const e of edges || []) {
    const a = Number(e.requester_profile_id);
    const b = Number(e.requestee_profile_id);
    if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
    const peer = a === companyId ? b : a;
    if (peer === companyId) continue;
    peerIds.add(peer);
    edgeByPeer.set(peer, {
      connection_id: String(e.id),
      connection_type: e.connection_type ? String(e.connection_type) : undefined,
    });
  }

  let peers: Array<{
    id: number;
    name: string;
    connection_id?: string;
    connection_type?: string;
    relation: 'supplier' | 'customer' | 'peer';
  }> = [];

  if (peerIds.size) {
    const ids = [...peerIds];
    const { data: profs } = await supabase
      .from('profiles')
      .select('id, trading_name, legal_name')
      .in('id', ids);
    const nameById = new Map<number, string>();
    for (const p of profs || []) {
      nameById.set(
        Number(p.id),
        String(p.trading_name || p.legal_name || `Company ${p.id}`)
      );
    }

    // Heuristic relation from SRM/CRM books when columns exist
    const supplierSet = new Set<number>();
    const customerSet = new Set<number>();
    try {
      const { data: suppliers } = await supabase
        .from('suppliers')
        .select('linked_profile_id, connected_profile_id, supplier_profile_id')
        .eq('profile_id', companyId)
        .limit(200);
      for (const s of suppliers || []) {
        const row = s as Record<string, unknown>;
        for (const k of [
          'linked_profile_id',
          'connected_profile_id',
          'supplier_profile_id',
        ]) {
          const n = Number(row[k]);
          if (Number.isFinite(n) && n > 0) supplierSet.add(n);
        }
      }
    } catch {
      /* soft */
    }
    try {
      const { data: customers } = await supabase
        .from('customers')
        .select('linked_profile_id, connected_profile_id, customer_profile_id')
        .eq('profile_id', companyId)
        .limit(200);
      for (const c of customers || []) {
        const row = c as Record<string, unknown>;
        for (const k of [
          'linked_profile_id',
          'connected_profile_id',
          'customer_profile_id',
        ]) {
          const n = Number(row[k]);
          if (Number.isFinite(n) && n > 0) customerSet.add(n);
        }
      }
    } catch {
      /* soft */
    }

    peers = ids.map((id) => {
      const edge = edgeByPeer.get(id);
      let relation: 'supplier' | 'customer' | 'peer' = 'peer';
      if (supplierSet.has(id)) relation = 'supplier';
      else if (customerSet.has(id)) relation = 'customer';
      else if (edge?.connection_type === 'supplier') relation = 'supplier';
      else if (edge?.connection_type === 'customer') relation = 'customer';
      return {
        id,
        name: nameById.get(id) || `Company ${id}`,
        connection_id: edge?.connection_id,
        connection_type: edge?.connection_type,
        relation,
      };
    });
    peers.sort((a, b) => a.name.localeCompare(b.name));
  }

  return { colleagues, peers };
}

function viewerForUser(
  userId: string | null | undefined,
  companyId: number
): CompanyMsgParticipant {
  const uid = getCanonicalUserId(userId);
  if (uid) {
    return {
      kind: 'user',
      ref_id: uid,
      company_id: companyId,
      name: 'You',
    };
  }
  return { kind: 'desk', ref_id: 'desk', company_id: companyId, name: 'Desk' };
}

/**
 * Recipients for system-wide delivery by platform user id.
 */
async function collectDeliveryUserIds(
  thread: CompanyThread,
  actorUserId: string | null
): Promise<string[]> {
  const ids = new Set(targetUserIdsFromThread(thread));
  const actor = getCanonicalUserId(actorUserId);
  if (actor) ids.add(actor);
  return [...ids];
}

export async function GET(request: NextRequest) {
  try {
    const companyId = Number(request.nextUrl.searchParams.get('companyId'));
    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }
    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request),
    });
    if (!gate.ok) return gate.response;

    const userId = getCanonicalUserId(gate.userId);
    const { store, tradingName } = await loadMeta(companyId);
    const directory = await loadDirectory(companyId);

    // System-wide: pull care messages (Fit/clinic) into personal + this company,
    // then merge company workspace inbox with personal user inbox.
    let threads = normalizeThreads(store.threads).filter((t) => !t.archived);
    let personalThreads: CompanyThread[] = [];
    let synced = 0;
    if (userId) {
      try {
        const merged = await loadMergedInboxForUser({
          userId,
          companyThreads: store.threads || [],
          activeCompanyId: companyId,
          syncCare: true,
        });
        threads = merged.threads;
        personalThreads = merged.personalThreads;
        synced = merged.synced;
      } catch (e) {
        console.warn('[messaging/inbox GET] merge/sync', e);
        try {
          const personal = await readUserInbox(userId);
          personalThreads = personal?.threads || [];
          threads = mergeInboxThreads(store.threads || [], personalThreads);
        } catch (e2) {
          console.warn('[messaging/inbox GET] personal', e2);
        }
      }
    }

    threads = threadsForPlatformUser(threads, userId);
    personalThreads = threadsForPlatformUser(personalThreads, userId);

    const viewer = viewerForUser(userId, companyId);
    const summaryUser = summariseCompanyInbox(threads, viewer);
    const summaryDesk = summariseCompanyInbox(threads, {
      kind: 'desk',
      ref_id: 'desk',
    });

    return NextResponse.json({
      success: true,
      companyId,
      companyName: tradingName,
      userId: userId || null,
      threads,
      summary: {
        ...summaryUser,
        unreadMessages: userId
          ? summaryUser.unreadMessages
          : summaryDesk.unreadMessages,
      },
      directory,
      delivery: {
        personal_threads: personalThreads.filter((t) => !t.archived).length,
        company_threads: normalizeThreads(store.threads).filter(
          (t) => !t.archived
        ).length,
        care_synced: synced,
      },
    });
  } catch (e: unknown) {
    console.error('[messaging/inbox GET]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const companyId = Number(body.companyId);
    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }
    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request),
    });
    if (!gate.ok) return gate.response;

    const userId = getCanonicalUserId(gate.userId);
    const { meta, store, tradingName } = await loadMeta(companyId);
    const now = new Date().toISOString();
    const scopedThreads = (list: CompanyThread[]) =>
      threadsForPlatformUser(list, userId);

    // Prefer real platform user as author so recipients address a person id
    const author: CompanyMsgParticipant = {
      kind: 'user',
      ref_id: String(
        body.author_ref_id ||
          userId ||
          'desk'
      ),
      company_id: companyId,
      name: String(
        body.author_name ||
          body.as_name ||
          tradingName ||
          'Team member'
      ),
      role_label: body.author_role_label
        ? String(body.author_role_label)
        : body.author_kind === 'desk'
          ? 'desk'
          : undefined,
    };
    // Allow explicit desk posts when requested
    if (body.author_kind === 'desk' && !body.author_ref_id) {
      author.kind = 'desk';
      author.ref_id = 'desk';
      author.name = String(body.company_name || tradingName || 'Desk');
    }

    // For mark_read on personal-only threads, operate on merged set then split saves
    const action = String(body.action || '');
    let workingThreads = store.threads;

    if (
      (action === 'message_mark_read' || action === 'mark_read') &&
      userId
    ) {
      const personal = await readUserInbox(userId);
      const merged = mergeInboxThreads(
        store.threads || [],
        personal?.threads || []
      );
      const threadId = String(body.thread_id || body.id || '');
      const idx = merged.findIndex((t) => t.id === threadId);
      if (idx < 0) {
        return NextResponse.json({ error: 'Thread not found' }, { status: 404 });
      }
      if (!threadVisibleToPlatformUser(merged[idx], userId)) {
        return NextResponse.json({ error: 'Thread not found' }, { status: 404 });
      }
      const updated = markThreadRead(merged[idx], author, now);
      // Save into company if present there
      const companyHas = (store.threads || []).some((t) => t.id === threadId);
      if (companyHas) {
        await saveInbox(
          companyId,
          meta,
          upsertThread(store.threads || [], updated)
        );
      }
      // Always update personal
      const nextPersonal = upsertThread(personal?.threads || [], updated);
      await writeUserInboxThreads(userId, nextPersonal);

      const all = mergeInboxThreads(
        companyHas
          ? upsertThread(store.threads || [], updated)
          : store.threads || [],
        nextPersonal
      );
      return NextResponse.json({
        success: true,
        thread: updated,
        threads: scopedThreads(all),
        summary: summariseCompanyInbox(scopedThreads(all), author),
        message: 'Marked read',
      });
    }

    if (
      (action === 'message_post' ||
        action === 'post_message' ||
        action === 'message_reply' ||
        action === 'message_archive' ||
        action === 'archive_thread') &&
      userId
    ) {
      const threadId = String(body.thread_id || body.id || '');
      const personal = await readUserInbox(userId);
      const merged = mergeInboxThreads(
        store.threads || [],
        personal?.threads || []
      );
      const existing = merged.find((t) => t.id === threadId);
      if (!existing || !threadVisibleToPlatformUser(existing, userId)) {
        return NextResponse.json({ error: 'Thread not found' }, { status: 404 });
      }
      workingThreads = upsertThread(store.threads || [], existing);
    }

    const result = applyCompanyMessageAction(workingThreads, body, {
      companyId,
      author,
      now,
    });

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    await saveInbox(companyId, meta, result.threads);

    if (
      result.dualWriteThread &&
      result.dualWriteCompanyId &&
      result.dualWriteCompanyId !== companyId
    ) {
      try {
        await dualWriteToPeer(result.dualWriteCompanyId, result.dualWriteThread);
      } catch (e) {
        console.warn('[messaging/inbox] dual-write failed', e);
      }
    }

    // System-wide delivery by platform user id (personal + all company workspaces)
    let fanOut: { users: number; companies: number } | undefined;
    if (
      result.thread &&
      (action === 'message_create_thread' ||
        action === 'create_thread' ||
        action === 'message_start' ||
        action === 'message_post' ||
        action === 'post_message' ||
        action === 'message_reply')
    ) {
      try {
        const userIds = await collectDeliveryUserIds(result.thread, userId);
        fanOut = await deliverThreadToPlatformUsers({
          thread: result.thread,
          userIds,
          skipCompanyId: companyId,
        });
        // Peer company already dual-written; still skip it in company fan-out
        // (deliverThreadToPlatformUsers writes peer company members' other workspaces)
      } catch (e) {
        console.warn('[messaging/inbox] user fan-out failed', e);
      }
    }

    // Merge personal for response
    let personalThreads: CompanyThread[] = [];
    if (userId) {
      try {
        const personal = await readUserInbox(userId);
        personalThreads = personal?.threads || [];
      } catch {
        /* soft */
      }
    }
    const open = scopedThreads(
      mergeInboxThreads(result.threads, personalThreads)
    );

    return NextResponse.json({
      success: true,
      thread: result.thread,
      threads: open,
      summary: summariseCompanyInbox(open, author),
      message:
        fanOut && (fanOut.users > 0 || fanOut.companies > 0)
          ? `Message saved · delivered to ${fanOut.users} user inbox(es), ${fanOut.companies} company workspace(s)`
          : 'Message saved',
      fan_out: fanOut,
    });
  } catch (e: unknown) {
    console.error('[messaging/inbox POST]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
