import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  requireCompanyAccess,
  legacyPrivyFrom,
} from '@/lib/auth/api-auth';
import { getCompanyMembership } from '@/lib/business/access';
import { newShareToken } from '@/lib/containers/public-share';
import { getAppUrl } from '@/lib/resend';

/**
 * GET ?companyId= — list / create share config for this company
 * POST — enable share (create or rotate token)
 * PATCH — update flags / title / deactivate
 */
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

    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from('container_network_shares')
      .select('*')
      .eq('profile_id', companyId)
      .order('created_at', { ascending: false })
      .limit(5);

    if (error) {
      if (/does not exist|schema cache/i.test(error.message)) {
        return NextResponse.json({
          success: true,
          shares: [],
          migration_required: true,
          warning:
            'Run supabase/migrations/20260712_container_network_share.sql',
        });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const base = getAppUrl().replace(/\/$/, '');
    const shares = (data || []).map((s) => ({
      ...s,
      publicUrl: `${base}/embed/containers/${s.token}`,
      embedHtml: embedSnippet(`${base}/embed/containers/${s.token}`, s.title),
    }));

    return NextResponse.json({ success: true, shares });
  } catch (e: unknown) {
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
      legacyPrivyUserId: legacyPrivyFrom(request) || body.privyUserId,
    });
    if (!gate.ok) return gate.response;

    const mem = await getCompanyMembership(gate.userId, companyId);
    if (!mem.ok) {
      return NextResponse.json({ error: mem.error }, { status: mem.status });
    }
    if (!['owner', 'admin', 'operations'].includes(mem.role)) {
      return NextResponse.json(
        { error: 'Only owners, admins, or operations can create share links' },
        { status: 403 }
      );
    }

    const supabase = getSupabaseServer();
    const rotate = Boolean(body.rotate);
    const now = new Date().toISOString();

    // Deactivate existing if rotate
    if (rotate) {
      await supabase
        .from('container_network_shares')
        .update({ is_active: false, updated_at: now })
        .eq('profile_id', companyId)
        .eq('is_active', true);
    }

    // Reuse active share unless rotate
    if (!rotate) {
      const { data: existing } = await supabase
        .from('container_network_shares')
        .select('*')
        .eq('profile_id', companyId)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (existing) {
        const base = getAppUrl().replace(/\/$/, '');
        return NextResponse.json({
          success: true,
          share: {
            ...existing,
            publicUrl: `${base}/embed/containers/${existing.token}`,
            embedHtml: embedSnippet(
              `${base}/embed/containers/${existing.token}`,
              existing.title
            ),
          },
          reused: true,
        });
      }
    }

    const token = newShareToken();
    const row = {
      profile_id: companyId,
      token,
      title: body.title || 'Container network',
      is_active: true,
      show_metrics: body.showMetrics !== false,
      show_list: body.showList !== false,
      show_contractors: Boolean(body.showContractors),
      show_photos: Boolean(body.showPhotos),
      brand_name: body.brandName || 'Big Five Group',
      brand_url: body.brandUrl || 'https://www.bigfivegroup.africa',
      created_by: gate.userId,
      created_at: now,
      updated_at: now,
    };

    const { data, error } = await supabase
      .from('container_network_shares')
      .insert(row)
      .select('*')
      .single();

    if (error) {
      if (/does not exist|schema cache/i.test(error.message)) {
        return NextResponse.json(
          {
            error: error.message,
            hint: 'Run supabase/migrations/20260712_container_network_share.sql',
            code: 'MIGRATION_REQUIRED',
          },
          { status: 503 }
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const base = getAppUrl().replace(/\/$/, '');
    return NextResponse.json({
      success: true,
      share: {
        ...data,
        publicUrl: `${base}/embed/containers/${data.token}`,
        embedHtml: embedSnippet(
          `${base}/embed/containers/${data.token}`,
          data.title
        ),
      },
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}

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
      legacyPrivyUserId: legacyPrivyFrom(request) || body.privyUserId,
    });
    if (!gate.ok) return gate.response;

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (body.title != null) updates.title = String(body.title);
    if (body.isActive != null) updates.is_active = Boolean(body.isActive);
    if (body.showMetrics != null) updates.show_metrics = Boolean(body.showMetrics);
    if (body.showList != null) updates.show_list = Boolean(body.showList);
    if (body.showContractors != null) {
      updates.show_contractors = Boolean(body.showContractors);
    }
    if (body.showPhotos != null) updates.show_photos = Boolean(body.showPhotos);
    if (body.brandName != null) updates.brand_name = String(body.brandName);
    if (body.brandUrl != null) updates.brand_url = String(body.brandUrl);

    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from('container_network_shares')
      .update(updates)
      .eq('id', id)
      .eq('profile_id', companyId)
      .select('*')
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json({ error: 'Share not found' }, { status: 404 });
    }

    const base = getAppUrl().replace(/\/$/, '');
    return NextResponse.json({
      success: true,
      share: {
        ...data,
        publicUrl: `${base}/embed/containers/${data.token}`,
        embedHtml: embedSnippet(
          `${base}/embed/containers/${data.token}`,
          data.title
        ),
      },
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}

function embedSnippet(url: string, title?: string | null): string {
  const t = (title || 'Container network').replace(/"/g, '&quot;');
  return `<iframe
  src="${url}"
  title="${t}"
  width="100%"
  height="720"
  style="border:0;border-radius:16px;min-height:560px;"
  loading="lazy"
  referrerpolicy="no-referrer-when-downgrade"
  allowfullscreen
></iframe>`;
}
