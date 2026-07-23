import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  requireCompanyAccess,
  legacyPrivyFrom,
} from '@/lib/auth/api-auth';
import { assertCompanyMember } from '@/lib/customers/access';
import {
  type CompanyGroupLink,
  type GroupLinkType,
  type GroupPeerProfile,
  displayCompanyName,
  inviteCopy,
  isActionablePending,
  isAwaitingPeer,
  isGroupLinkType,
  MIGRATION_HINT,
  PROFILE_PEER_SELECT,
} from '@/lib/business/company-groups';
import { loadFullGroupStructure } from '@/lib/business/group-structure-load';

/**
 * GET ?companyId=&status=&linkType=&role=all|parent|child&mode=search&q=
 *
 * Lists group links for the company, or searches discoverable companies to link.
 */
export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const companyId = Number(sp.get('companyId'));
    if (!Number.isFinite(companyId) || companyId <= 0) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }

    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request),
    });
    if (!gate.ok) return gate.response;

    const mode = sp.get('mode') || 'list';
    const supabase = getSupabaseServer();

    // ── Search peer companies to link ──────────────────────────────────────
    if (mode === 'search') {
      const q = (sp.get('q') || '').trim();
      if (q.length < 2) {
        return NextResponse.json({
          success: true,
          companies: [],
          hint: 'Type at least 2 characters',
        });
      }
      const limit = Math.min(Number(sp.get('limit') || 20), 50);
      // Escape PostgREST filter special chars
      const safe = q.replace(/[%_,.()]/g, ' ').replace(/\s+/g, ' ').trim();
      const like = `%${safe}%`;

      // Quote patterns so spaces/special chars are valid PostgREST filters
      const quoted = `"${like.replace(/"/g, '')}"`;
      const { data: raw, error } = await supabase
        .from('profiles')
        .select(PROFILE_PEER_SELECT)
        .neq('id', companyId)
        .or(`trading_name.ilike.${quoted},legal_name.ilike.${quoted}`)
        .limit(limit * 2);

      let rows = raw || [];
      if (error) {
        // Fallback: load recent discoverable + filter in memory
        const retry = await supabase
          .from('profiles')
          .select(PROFILE_PEER_SELECT)
          .neq('id', companyId)
          .order('id', { ascending: false })
          .limit(300);
        if (retry.error) {
          return NextResponse.json({
            success: true,
            companies: [],
            warning: retry.error.message,
            hint: MIGRATION_HINT,
          });
        }
        const ql = safe.toLowerCase();
        rows = (retry.data || []).filter((r) => {
          const hay = `${r.trading_name || ''} ${r.legal_name || ''}`.toLowerCase();
          return hay.includes(ql);
        });
      }

      const companies = rows.slice(0, limit).map((r) => ({
        ...r,
        display_name: displayCompanyName(r as GroupPeerProfile, Number(r.id)),
      }));

      return NextResponse.json({ success: true, companies });
    }

    // ── List links ─────────────────────────────────────────────────────────
    const statusFilter = sp.get('status');
    const linkType = sp.get('linkType');
    const role = sp.get('role') || 'all'; // all | parent | child

    let query = supabase
      .from('company_group_links')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(300);

    if (role === 'parent') {
      query = query.eq('parent_profile_id', companyId);
    } else if (role === 'child') {
      query = query.eq('child_profile_id', companyId);
    } else {
      query = query.or(
        `parent_profile_id.eq.${companyId},child_profile_id.eq.${companyId}`
      );
    }

    if (statusFilter && statusFilter !== 'all') {
      query = query.eq('status', statusFilter);
    }
    if (linkType && linkType !== 'all' && isGroupLinkType(linkType)) {
      query = query.eq('link_type', linkType);
    }

    const { data: rows, error } = await query;
    if (error) {
      return NextResponse.json({
        success: true,
        links: [],
        summary: emptySummary(),
        parent_profile_id: null,
        warning: error.message,
        hint: MIGRATION_HINT,
      });
    }

    const peerIds = new Set<number>();
    for (const r of rows || []) {
      const p = Number(r.parent_profile_id);
      const c = Number(r.child_profile_id);
      if (p && p !== companyId) peerIds.add(p);
      if (c && c !== companyId) peerIds.add(c);
    }

    const peerMap = await loadPeers(supabase, Array.from(peerIds));

    const links: CompanyGroupLink[] = (rows || []).map((r) => {
      const parentId = Number(r.parent_profile_id);
      const childId = Number(r.child_profile_id);
      const isParent = parentId === companyId;
      const peerId = isParent ? childId : parentId;
      const peer = peerMap.get(peerId) || null;
      return {
        ...r,
        parent_profile_id: parentId,
        child_profile_id: childId,
        role: isParent ? 'parent' : 'child',
        peer,
        peer_display_name: displayCompanyName(peer, peerId),
      } as CompanyGroupLink;
    });

    // Always surface pending that need this company to act (even if status filter is set)
    let actionable: Array<
      CompanyGroupLink & {
        copy: ReturnType<typeof inviteCopy>;
        can_accept: true;
      }
    > = [];
    let awaiting: Array<
      CompanyGroupLink & { copy: ReturnType<typeof inviteCopy> }
    > = [];

    if (statusFilter && statusFilter !== 'all' && statusFilter !== 'pending') {
      // Load pending separately so Accept inbox never disappears behind a filter
      const { data: pendingRows } = await supabase
        .from('company_group_links')
        .select('*')
        .or(
          `parent_profile_id.eq.${companyId},child_profile_id.eq.${companyId}`
        )
        .eq('status', 'pending')
        .order('updated_at', { ascending: false })
        .limit(50);
      const extraPeerIds = new Set<number>();
      for (const r of pendingRows || []) {
        const p = Number(r.parent_profile_id);
        const c = Number(r.child_profile_id);
        if (p && p !== companyId) extraPeerIds.add(p);
        if (c && c !== companyId) extraPeerIds.add(c);
      }
      const extraPeers = await loadPeers(supabase, Array.from(extraPeerIds));
      const pendingLinks: CompanyGroupLink[] = (pendingRows || []).map((r) => {
        const parentId = Number(r.parent_profile_id);
        const childId = Number(r.child_profile_id);
        const isParent = parentId === companyId;
        const peerId = isParent ? childId : parentId;
        const peer = extraPeers.get(peerId) || peerMap.get(peerId) || null;
        return {
          ...r,
          parent_profile_id: parentId,
          child_profile_id: childId,
          role: isParent ? 'parent' : 'child',
          peer,
          peer_display_name: displayCompanyName(peer, peerId),
        } as CompanyGroupLink;
      });
      actionable = pendingLinks
        .filter((l) => isActionablePending(l, companyId))
        .map((l) => ({
          ...l,
          copy: inviteCopy(l),
          can_accept: true as const,
        }));
      awaiting = pendingLinks
        .filter((l) => isAwaitingPeer(l, companyId))
        .map((l) => ({ ...l, copy: inviteCopy(l) }));
    } else {
      actionable = links
        .filter((l) => isActionablePending(l, companyId))
        .map((l) => ({
          ...l,
          copy: inviteCopy(l),
          can_accept: true as const,
        }));
      awaiting = links
        .filter((l) => isAwaitingPeer(l, companyId))
        .map((l) => ({ ...l, copy: inviteCopy(l) }));
    }

    // Current company + holding parent (legacy tree)
    let parent_profile_id: number | null = null;
    let parent_profile: GroupPeerProfile | null = null;
    let company_name = `Company #${companyId}`;
    try {
      const { data: me } = await supabase
        .from('profiles')
        .select(
          'parent_profile_id, trading_name, legal_name, business_type, industry, city, country, verification_status, logo_url'
        )
        .eq('id', companyId)
        .maybeSingle();
      if (me) {
        company_name = displayCompanyName(me as GroupPeerProfile, companyId);
        parent_profile_id = me.parent_profile_id
          ? Number(me.parent_profile_id)
          : null;
      }
      if (parent_profile_id) {
        parent_profile =
          peerMap.get(parent_profile_id) ||
          (await loadPeers(supabase, [parent_profile_id])).get(parent_profile_id) ||
          null;
      }
    } catch {
      /* soft */
    }

    // Multi-level structure: Holding → Sub → OpCo (walk full connected graph)
    const fullStructure = await loadFullGroupStructure(companyId);

    const summary = {
      total: links.length,
      pending: links.filter((l) => l.status === 'pending').length,
      actionable: actionable.length,
      awaiting: awaiting.length,
      active: links.filter((l) => l.status === 'active').length,
      structure_links: fullStructure.link_count,
      structure_companies: fullStructure.node_ids.length,
      as_parent: links.filter((l) => l.role === 'parent').length,
      as_child: links.filter((l) => l.role === 'child').length,
      holdings: fullStructure.edges.filter((e) => e.link_type === 'holding')
        .length,
      associations: fullStructure.edges.filter(
        (e) => e.link_type === 'association'
      ).length,
    };

    return NextResponse.json({
      success: true,
      company_name: fullStructure.company_name || company_name,
      links,
      /** Pending that YOU must Accept or Decline (simple inbox) */
      actionable,
      /** Pending you sent — waiting on the other company */
      awaiting,
      /** Hierarchical multi-level diagram trees (full ownership chain) */
      structure: fullStructure.trees,
      structure_edges: fullStructure.edges,
      summary,
      parent_profile_id,
      parent_profile,
      parent_display_name: parent_profile
        ? displayCompanyName(parent_profile, parent_profile_id || undefined)
        : null,
      ...(fullStructure.warning
        ? { structure_warning: fullStructure.warning }
        : {}),
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}

/**
 * POST — create a group link (request to join, or invite a company).
 *
 * Body:
 *   companyId — acting company (must be member)
 *   peerProfileId — the other company
 *   linkType — holding | association | …
 *   asRole — 'child' (default: we join them as parent) | 'parent' (they join us)
 *   direction — optional; derived from asRole if omitted
 *   ownershipPct?, roleLabel?, notes?, effectiveFrom?
 *
 * Auto-activates when the same user is an active member of both companies.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const companyId = Number(body.companyId);
    const peerProfileId = Number(body.peerProfileId || body.peerId);
    const linkTypeRaw = String(body.linkType || body.link_type || 'holding');
    const asRole = String(body.asRole || 'child') as 'parent' | 'child';

    if (!Number.isFinite(companyId) || companyId <= 0) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }
    if (!Number.isFinite(peerProfileId) || peerProfileId <= 0) {
      return NextResponse.json(
        { error: 'peerProfileId required' },
        { status: 400 }
      );
    }
    if (companyId === peerProfileId) {
      return NextResponse.json(
        { error: 'Cannot link a company to itself' },
        { status: 400 }
      );
    }
    if (!isGroupLinkType(linkTypeRaw)) {
      return NextResponse.json(
        {
          error:
            'Invalid linkType. Use holding, association, group, franchise, joint_venture, affiliate, or other',
        },
        { status: 400 }
      );
    }
    const linkType: GroupLinkType = linkTypeRaw;

    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request, body),
    });
    if (!gate.ok) return gate.response;

    // parent = group head; child = member/subsidiary
    const parentId = asRole === 'parent' ? companyId : peerProfileId;
    const childId = asRole === 'parent' ? peerProfileId : companyId;
    const direction =
      body.direction === 'invite' || body.direction === 'request'
        ? body.direction
        : asRole === 'parent'
          ? 'invite'
          : 'request';

    const supabase = getSupabaseServer();

    // Peer must exist
    const { data: peer, error: peerErr } = await supabase
      .from('profiles')
      .select('id, trading_name, legal_name')
      .eq('id', peerProfileId)
      .maybeSingle();
    if (peerErr || !peer) {
      return NextResponse.json(
        { error: 'Peer company not found' },
        { status: 404 }
      );
    }

    // Auto-activate if caller is member of both companies
    let status: 'pending' | 'active' = 'pending';
    const bothSides = await assertCompanyMember(gate.userId, peerProfileId);
    if (bothSides.ok) {
      status = 'active';
    }

    let ownershipPct: number | null = null;
    if (body.ownershipPct != null && body.ownershipPct !== '') {
      const n = Number(body.ownershipPct);
      if (Number.isFinite(n) && n >= 0 && n <= 100) ownershipPct = n;
    }

    const row = {
      parent_profile_id: parentId,
      child_profile_id: childId,
      link_type: linkType,
      status,
      ownership_pct: ownershipPct,
      role_label: body.roleLabel ? String(body.roleLabel).trim() : null,
      notes: body.notes ? String(body.notes).trim() : null,
      direction,
      requested_by_user_id: gate.userId,
      requested_by_profile_id: companyId,
      responded_by_user_id: status === 'active' ? gate.userId : null,
      responded_at: status === 'active' ? new Date().toISOString() : null,
      effective_from: body.effectiveFrom || null,
      effective_to: body.effectiveTo || null,
      metadata: body.metadata && typeof body.metadata === 'object' ? body.metadata : {},
      updated_at: new Date().toISOString(),
    };

    // Upsert: if same pair+type exists in terminal state, reopen; if pending/active, return existing
    const { data: existing } = await supabase
      .from('company_group_links')
      .select('*')
      .eq('parent_profile_id', parentId)
      .eq('child_profile_id', childId)
      .eq('link_type', linkType)
      .maybeSingle();

    if (existing) {
      if (existing.status === 'active') {
        return NextResponse.json({
          success: true,
          link: existing,
          message: 'Link already active',
          alreadyExists: true,
        });
      }
      if (existing.status === 'pending') {
        return NextResponse.json({
          success: true,
          link: existing,
          message: 'Link already pending',
          alreadyExists: true,
        });
      }
      // Reopen rejected/left/revoked
      const { data: updated, error: upErr } = await supabase
        .from('company_group_links')
        .update({
          ...row,
          responded_by_user_id: status === 'active' ? gate.userId : null,
          responded_at: status === 'active' ? new Date().toISOString() : null,
        })
        .eq('id', existing.id)
        .select('*')
        .single();
      if (upErr) {
        return NextResponse.json({ error: upErr.message }, { status: 400 });
      }
      if (status === 'active' && linkType === 'holding') {
        await syncParentProfileId(supabase, childId, parentId);
      }
      return NextResponse.json({
        success: true,
        link: updated,
        autoActivated: status === 'active',
        reopened: true,
      });
    }

    const { data: created, error: insErr } = await supabase
      .from('company_group_links')
      .insert(row)
      .select('*')
      .single();

    if (insErr) {
      if (/does not exist|schema cache|relation/i.test(insErr.message)) {
        return NextResponse.json(
          { error: insErr.message, hint: MIGRATION_HINT },
          { status: 503 }
        );
      }
      return NextResponse.json({ error: insErr.message }, { status: 400 });
    }

    if (status === 'active' && linkType === 'holding') {
      await syncParentProfileId(supabase, childId, parentId);
    }

    return NextResponse.json({
      success: true,
      link: created,
      autoActivated: status === 'active',
      peer_display_name: displayCompanyName(peer as GroupPeerProfile, peerProfileId),
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH — accept | reject | leave | revoke | update fields.
 *
 * Body: companyId, id, action?, ownershipPct?, roleLabel?, notes?, status?
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const companyId = Number(body.companyId);
    const id = Number(body.id);
    if (!Number.isFinite(companyId) || !Number.isFinite(id)) {
      return NextResponse.json(
        { error: 'companyId and id required' },
        { status: 400 }
      );
    }

    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request, body),
    });
    if (!gate.ok) return gate.response;

    const supabase = getSupabaseServer();
    const { data: link, error: loadErr } = await supabase
      .from('company_group_links')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (loadErr) {
      return NextResponse.json(
        { error: loadErr.message, hint: MIGRATION_HINT },
        { status: 503 }
      );
    }
    if (!link) {
      return NextResponse.json({ error: 'Link not found' }, { status: 404 });
    }

    const parentId = Number(link.parent_profile_id);
    const childId = Number(link.child_profile_id);
    if (companyId !== parentId && companyId !== childId) {
      return NextResponse.json(
        { error: 'Not a party to this link' },
        { status: 403 }
      );
    }

    const action = String(body.action || '').toLowerCase();
    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (action === 'accept' || action === 'reject') {
      if (link.status !== 'pending') {
        return NextResponse.json(
          { error: `Only pending links can be ${action}ed` },
          { status: 400 }
        );
      }
      // Counterparty must act:
      // - request: child asked parent → parent accepts/rejects
      // - invite: parent invited child → child accepts/rejects
      // Same user on both companies may always act.
      const direction = String(link.direction || 'request');
      const expectedAcceptor =
        direction === 'invite' ? childId : parentId;
      const peerId = companyId === parentId ? childId : parentId;
      const bothSides = await assertCompanyMember(gate.userId, peerId);
      if (companyId !== expectedAcceptor && !bothSides.ok) {
        return NextResponse.json(
          {
            error:
              direction === 'invite'
                ? 'Only the invited company can accept or reject this invitation.'
                : 'Only the holding company or association can accept or reject this request.',
          },
          { status: 403 }
        );
      }
      updates.status = action === 'accept' ? 'active' : 'rejected';
      updates.responded_by_user_id = gate.userId;
      updates.responded_at = new Date().toISOString();
    } else if (action === 'cancel') {
      // Requester cancels their own pending invite/request
      if (link.status !== 'pending') {
        return NextResponse.json(
          { error: 'Only pending links can be cancelled' },
          { status: 400 }
        );
      }
      const requestedBy = Number(link.requested_by_profile_id);
      const direction = String(link.direction || 'request');
      const isRequester =
        (Number.isFinite(requestedBy) && requestedBy === companyId) ||
        (direction === 'invite' && companyId === parentId) ||
        (direction === 'request' && companyId === childId);
      if (!isRequester) {
        return NextResponse.json(
          {
            error:
              'Only the company that sent this invite/request can cancel it. Use Decline if you received it.',
          },
          { status: 403 }
        );
      }
      updates.status = 'revoked';
      updates.responded_by_user_id = gate.userId;
      updates.responded_at = new Date().toISOString();
    } else if (action === 'leave') {
      // Child leaves
      if (companyId !== childId) {
        return NextResponse.json(
          { error: 'Only the member/subsidiary can leave' },
          { status: 403 }
        );
      }
      if (link.status !== 'active') {
        return NextResponse.json(
          { error: 'Only active links can be left' },
          { status: 400 }
        );
      }
      updates.status = 'left';
      updates.responded_by_user_id = gate.userId;
      updates.responded_at = new Date().toISOString();
      updates.effective_to =
        body.effectiveTo || new Date().toISOString().slice(0, 10);
    } else if (action === 'revoke') {
      // Parent revokes
      if (companyId !== parentId) {
        return NextResponse.json(
          { error: 'Only the holding/association can revoke' },
          { status: 403 }
        );
      }
      if (link.status !== 'active' && link.status !== 'pending') {
        return NextResponse.json(
          { error: 'Only active or pending links can be revoked' },
          { status: 400 }
        );
      }
      updates.status = 'revoked';
      updates.responded_by_user_id = gate.userId;
      updates.responded_at = new Date().toISOString();
      updates.effective_to =
        body.effectiveTo || new Date().toISOString().slice(0, 10);
    } else {
      // Field updates on active/pending
      if (body.roleLabel !== undefined) {
        updates.role_label = body.roleLabel
          ? String(body.roleLabel).trim()
          : null;
      }
      if (body.notes !== undefined) {
        updates.notes = body.notes ? String(body.notes).trim() : null;
      }
      if (body.ownershipPct !== undefined) {
        if (body.ownershipPct === null || body.ownershipPct === '') {
          updates.ownership_pct = null;
        } else {
          const n = Number(body.ownershipPct);
          if (!Number.isFinite(n) || n < 0 || n > 100) {
            return NextResponse.json(
              { error: 'ownershipPct must be 0–100' },
              { status: 400 }
            );
          }
          updates.ownership_pct = n;
        }
      }
      if (body.effectiveFrom !== undefined) {
        updates.effective_from = body.effectiveFrom || null;
      }
      if (body.effectiveTo !== undefined) {
        updates.effective_to = body.effectiveTo || null;
      }
    }

    const { data: updated, error: upErr } = await supabase
      .from('company_group_links')
      .update(updates)
      .eq('id', id)
      .select('*')
      .single();

    if (upErr) {
      return NextResponse.json({ error: upErr.message }, { status: 400 });
    }

    // Sync profiles.parent_profile_id for holding links
    const nextStatus = String(updated.status);
    if (String(updated.link_type) === 'holding') {
      if (nextStatus === 'active') {
        await syncParentProfileId(supabase, childId, parentId);
      } else if (
        nextStatus === 'left' ||
        nextStatus === 'revoked' ||
        nextStatus === 'rejected'
      ) {
        await clearParentIfMatch(supabase, childId, parentId);
      }
    }

    return NextResponse.json({ success: true, link: updated });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}

async function loadPeers(
  supabase: ReturnType<typeof getSupabaseServer>,
  ids: number[]
): Promise<Map<number, GroupPeerProfile>> {
  const map = new Map<number, GroupPeerProfile>();
  if (ids.length === 0) return map;
  const { data } = await supabase
    .from('profiles')
    .select(PROFILE_PEER_SELECT)
    .in('id', ids);
  for (const r of data || []) {
    map.set(Number(r.id), r as GroupPeerProfile);
  }
  return map;
}

async function syncParentProfileId(
  supabase: ReturnType<typeof getSupabaseServer>,
  childId: number,
  parentId: number
) {
  try {
    await supabase
      .from('profiles')
      .update({
        parent_profile_id: parentId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', childId);
  } catch (e) {
    console.warn('syncParentProfileId:', e);
  }
}

async function clearParentIfMatch(
  supabase: ReturnType<typeof getSupabaseServer>,
  childId: number,
  parentId: number
) {
  try {
    const { data } = await supabase
      .from('profiles')
      .select('parent_profile_id')
      .eq('id', childId)
      .maybeSingle();
    if (data && Number(data.parent_profile_id) === parentId) {
      await supabase
        .from('profiles')
        .update({
          parent_profile_id: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', childId);
    }
  } catch (e) {
    console.warn('clearParentIfMatch:', e);
  }
}

function emptySummary() {
  return {
    total: 0,
    pending: 0,
    active: 0,
    as_parent: 0,
    as_child: 0,
    holdings: 0,
    associations: 0,
  };
}
