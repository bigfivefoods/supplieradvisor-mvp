/**
 * Public service-member invite claim API.
 * GET  ?token=&module=  — preview pending invite
 * POST { token, module, action: claim } — accept → portal link
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { clientIp, rateLimit } from '@/lib/security/rate-limit';
import {
  issueClientPortalToken,
  readFitgraphFromMetadata,
  writeFitgraphToMetadata,
  type FitClient,
  type FitgraphStore,
} from '@/lib/fitness/fitgraph';
import {
  issuePatientPortalToken,
  readPhysiographFromMetadata,
  writePhysiographToMetadata,
  type PhysioPatient,
  type PhysiographStore,
} from '@/lib/clinic/physiograph';
import {
  issueDentalPatientPortalToken,
  readDentalgraphFromMetadata,
  writeDentalgraphToMetadata,
  type DentalPatient,
  type DentalgraphStore,
} from '@/lib/dental/dentalgraph';
import {
  buildServiceMemberPortalLink,
  isInviteExpired,
  isServiceMemberModule,
  parseServiceMemberInviteToken,
  serviceMemberModuleLabel,
  serviceMemberRoleLabel,
  type ServiceMemberModule,
} from '@/lib/services/member-invite';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

type ResolvedInvite = {
  module: ServiceMemberModule;
  companyId: number;
  meta: Record<string, unknown>;
  businessName: string;
  person: FitClient | PhysioPatient | DentalPatient;
  personKind: 'client' | 'patient';
};

async function resolveInvite(
  token: string,
  moduleHint?: string | null
): Promise<ResolvedInvite | null> {
  const clean = String(token || '').trim();
  if (!clean || clean.length < 12) return null;

  const parsed = parseServiceMemberInviteToken(clean);
  let module: ServiceMemberModule | null = parsed.module;
  if (!module && moduleHint && isServiceMemberModule(moduleHint)) {
    module = moduleHint;
  }
  if (!module) return null;

  let companyId = parsed.companyId;
  const supabase = getSupabaseServer();

  if (companyId == null) {
    // Slow path: scan not practical; token must encode company
    return null;
  }

  const { data: prof } = await supabase
    .from('profiles')
    .select('id, trading_name, legal_name, metadata')
    .eq('id', companyId)
    .maybeSingle();
  if (!prof) return null;

  const meta =
    prof.metadata && typeof prof.metadata === 'object'
      ? { ...(prof.metadata as Record<string, unknown>) }
      : {};

  const businessName =
    prof.trading_name || prof.legal_name || 'Business';

  if (module === 'fitgraph') {
    const store = readFitgraphFromMetadata(meta);
    const brand = store.settings?.brand_name || businessName;
    const person = store.clients.find((c) => c.invite_token === clean);
    if (!person || person.active === false) return null;
    return {
      module,
      companyId: Number(prof.id),
      meta,
      businessName: brand,
      person,
      personKind: 'client',
    };
  }

  if (module === 'physiograph') {
    const store = readPhysiographFromMetadata(meta);
    const brand = store.settings?.brand_name || businessName;
    const person = store.patients.find((p) => p.invite_token === clean);
    if (!person || person.active === false) return null;
    return {
      module,
      companyId: Number(prof.id),
      meta,
      businessName: brand,
      person,
      personKind: 'patient',
    };
  }

  if (module === 'dentalgraph') {
    const store = readDentalgraphFromMetadata(meta);
    const brand = store.settings?.brand_name || businessName;
    const person = store.patients.find((p) => p.invite_token === clean);
    if (!person || person.active === false) return null;
    return {
      module,
      companyId: Number(prof.id),
      meta,
      businessName: brand,
      person,
      personKind: 'patient',
    };
  }

  return null;
}

function invitePreview(resolved: ResolvedInvite) {
  const p = resolved.person;
  const status = String(p.invite_status || 'pending').toLowerCase();
  const expired =
    status === 'expired' || isInviteExpired(p.invite_expires_at);
  return {
    module: resolved.module,
    module_label: serviceMemberModuleLabel(resolved.module),
    role_label: serviceMemberRoleLabel(resolved.module),
    business_name: resolved.businessName,
    person: {
      name: p.name,
      email: p.invite_email || p.email || null,
      code: p.code,
    },
    invite_status: expired && status === 'pending' ? 'expired' : status,
    expires_at: p.invite_expires_at || null,
    shares: {
      schedule: p.share_schedule !== false,
      feedback: p.share_feedback !== false,
      medical:
        resolved.module === 'fitgraph'
          ? false
          : (p as PhysioPatient | DentalPatient).share_medical !== false,
    },
    can_claim: !expired && (status === 'pending' || status === 'accepted'),
  };
}

export async function GET(request: NextRequest) {
  try {
    const ip = clientIp(request);
    const rl = rateLimit({
      key: `public-member-invite-get:${ip}`,
      limit: 60,
      windowMs: 60 * 1000,
    });
    if (!rl.ok) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        {
          status: 429,
          headers: { 'Retry-After': String(rl.retryAfterSec) },
        }
      );
    }

    const token = String(
      request.nextUrl.searchParams.get('token') || ''
    ).trim();
    const moduleParam = request.nextUrl.searchParams.get('module');
    if (!token) {
      return NextResponse.json({ error: 'token required' }, { status: 400 });
    }

    const resolved = await resolveInvite(token, moduleParam);
    if (!resolved) {
      return NextResponse.json(
        { error: 'Invitation not found or no longer valid' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      invite: invitePreview(resolved),
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const ip = clientIp(request);
    const rl = rateLimit({
      key: `public-member-invite-post:${ip}`,
      limit: 20,
      windowMs: 60 * 1000,
    });
    if (!rl.ok) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        {
          status: 429,
          headers: { 'Retry-After': String(rl.retryAfterSec) },
        }
      );
    }

    const body = await request.json().catch(() => ({}));
    const token = String(body.token || '').trim();
    const moduleParam = body.module != null ? String(body.module) : null;
    const action = String(body.action || 'claim').toLowerCase();

    if (!token) {
      return NextResponse.json({ error: 'token required' }, { status: 400 });
    }
    if (action !== 'claim' && action !== 'accept') {
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }

    const resolved = await resolveInvite(token, moduleParam);
    if (!resolved) {
      return NextResponse.json(
        { error: 'Invitation not found or no longer valid' },
        { status: 404 }
      );
    }

    const status = String(resolved.person.invite_status || 'pending').toLowerCase();
    if (status === 'revoked') {
      return NextResponse.json(
        { error: 'This invitation was revoked. Ask the business to send a new one.' },
        { status: 410 }
      );
    }
    if (status === 'expired' || isInviteExpired(resolved.person.invite_expires_at)) {
      resolved.person.invite_status = 'expired';
      return NextResponse.json(
        { error: 'This invitation has expired. Ask the business to resend it.' },
        { status: 410 }
      );
    }

    const now = new Date().toISOString();
    const supabase = getSupabaseServer();
    let portalToken = resolved.person.portal_token || null;

    // Optional: claim while logged into SupplierAdvisor → link system user id
    let claimUserId: string | null = null;
    try {
      const { requireVerifiedUser, legacyPrivyFrom } = await import(
        '@/lib/auth/api-auth'
      );
      const { linkPlatformUserId, normalizePlatformUserId } = await import(
        '@/lib/messaging/link-platform-user'
      );
      void linkPlatformUserId;
      const gate = await requireVerifiedUser(request, {
        legacyPrivyUserId: legacyPrivyFrom(request, body),
      });
      if (gate.ok) claimUserId = gate.userId;
      else {
        claimUserId = normalizePlatformUserId(
          body.userId || body.privyUserId || body.platform_user_id
        );
      }
    } catch {
      claimUserId = null;
    }

    if (resolved.module === 'fitgraph') {
      const store = readFitgraphFromMetadata(resolved.meta) as FitgraphStore;
      const idx = store.clients.findIndex((c) => c.invite_token === token);
      if (idx < 0) {
        return NextResponse.json({ error: 'Invite not found' }, { status: 404 });
      }
      if (!store.clients[idx].portal_token) {
        store.clients[idx].portal_token = issueClientPortalToken(
          resolved.companyId
        );
      }
      store.clients[idx].invite_status = 'accepted';
      store.clients[idx].invite_accepted_at = now;
      store.clients[idx].updated_at = now;
      if (claimUserId) {
        const { linkPlatformUserId } = await import(
          '@/lib/messaging/link-platform-user'
        );
        linkPlatformUserId(store.clients[idx], claimUserId);
      }
      // Keep invite_token so re-opening the link still works
      portalToken = store.clients[idx].portal_token!;
      const nextMeta = writeFitgraphToMetadata(resolved.meta, store);
      const { error } = await supabase
        .from('profiles')
        .update({ metadata: nextMeta, updated_at: now })
        .eq('id', resolved.companyId);
      if (error) throw new Error(error.message);
    } else if (resolved.module === 'physiograph') {
      const store = readPhysiographFromMetadata(
        resolved.meta
      ) as PhysiographStore;
      const idx = store.patients.findIndex((p) => p.invite_token === token);
      if (idx < 0) {
        return NextResponse.json({ error: 'Invite not found' }, { status: 404 });
      }
      if (!store.patients[idx].portal_token) {
        store.patients[idx].portal_token = issuePatientPortalToken(
          resolved.companyId
        );
      }
      store.patients[idx].invite_status = 'accepted';
      store.patients[idx].invite_accepted_at = now;
      store.patients[idx].updated_at = now;
      if (claimUserId) {
        const { linkPlatformUserId } = await import(
          '@/lib/messaging/link-platform-user'
        );
        linkPlatformUserId(store.patients[idx], claimUserId);
      }
      portalToken = store.patients[idx].portal_token!;
      const nextMeta = writePhysiographToMetadata(resolved.meta, store);
      const { error } = await supabase
        .from('profiles')
        .update({ metadata: nextMeta, updated_at: now })
        .eq('id', resolved.companyId);
      if (error) throw new Error(error.message);
    } else {
      const store = readDentalgraphFromMetadata(
        resolved.meta
      ) as DentalgraphStore;
      const idx = store.patients.findIndex((p) => p.invite_token === token);
      if (idx < 0) {
        return NextResponse.json({ error: 'Invite not found' }, { status: 404 });
      }
      if (!store.patients[idx].portal_token) {
        store.patients[idx].portal_token = issueDentalPatientPortalToken(
          resolved.companyId
        );
      }
      store.patients[idx].invite_status = 'accepted';
      store.patients[idx].invite_accepted_at = now;
      store.patients[idx].updated_at = now;
      if (claimUserId) {
        const { linkPlatformUserId } = await import(
          '@/lib/messaging/link-platform-user'
        );
        linkPlatformUserId(store.patients[idx], claimUserId);
      }
      portalToken = store.patients[idx].portal_token!;
      const nextMeta = writeDentalgraphToMetadata(resolved.meta, store);
      const { error } = await supabase
        .from('profiles')
        .update({ metadata: nextMeta, updated_at: now })
        .eq('id', resolved.companyId);
      if (error) throw new Error(error.message);
    }

    const portalLink = buildServiceMemberPortalLink(
      resolved.module,
      portalToken!
    );

    return NextResponse.json({
      success: true,
      message: 'Invitation accepted',
      portal_token: portalToken,
      portal_link: portalLink,
      module: resolved.module,
      business_name: resolved.businessName,
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
