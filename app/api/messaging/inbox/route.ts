/**
 * Platform company messaging API.
 * GET  ?companyId= — threads + directory (colleagues, connected peers)
 * POST { companyId, action, ... } — create / reply / mark_read / archive
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  requireCompanyAccess,
  legacyPrivyFrom,
} from '@/lib/auth/api-auth';
import {
  applyCompanyMessageAction,
  readCompanyInbox,
  summariseCompanyInbox,
  writeCompanyInbox,
  upsertThread,
  normalizeThreads,
  type CompanyMsgParticipant,
  type CompanyThread,
} from '@/lib/messaging/company-inbox';

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

    const { store, tradingName } = await loadMeta(companyId);
    const directory = await loadDirectory(companyId);
    const viewer: Pick<CompanyMsgParticipant, 'kind' | 'ref_id'> = {
      kind: 'desk',
      ref_id: 'desk',
    };
    const threads = normalizeThreads(store.threads).filter((t) => !t.archived);

    return NextResponse.json({
      success: true,
      companyId,
      companyName: tradingName,
      threads,
      summary: summariseCompanyInbox(threads, viewer),
      directory,
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

    const { meta, store, tradingName } = await loadMeta(companyId);
    const now = new Date().toISOString();

    const author: CompanyMsgParticipant = {
      kind: body.author_kind === 'user' ? 'user' : 'desk',
      ref_id: String(
        body.author_ref_id ||
          (gate.ok && 'userId' in gate ? gate.userId : null) ||
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
        : undefined,
    };

    const result = applyCompanyMessageAction(store.threads, body, {
      companyId,
      author: {
        ...author,
        // Prefer named company desk for trade clarity when not user-mode
        name:
          author.kind === 'desk'
            ? String(body.company_name || tradingName)
            : author.name,
      },
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

    const viewer: Pick<CompanyMsgParticipant, 'kind' | 'ref_id'> = {
      kind: 'desk',
      ref_id: 'desk',
    };
    const open = normalizeThreads(result.threads).filter((t) => !t.archived);

    return NextResponse.json({
      success: true,
      thread: result.thread,
      threads: open,
      summary: summariseCompanyInbox(open, viewer),
      message: 'Message saved',
    });
  } catch (e: unknown) {
    console.error('[messaging/inbox POST]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
