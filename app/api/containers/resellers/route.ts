import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  requireCompanyAccess,
  legacyPrivyFrom,
} from '@/lib/auth/api-auth';
import { RESELLER_VERIFY_FEE_ZAR } from '@/lib/containers/resellers';
import { getAppUrl, getResend, getResendFrom, getResendReplyTo } from '@/lib/resend';
import {
  buildResellerInviteLink,
  resellerInviteEmailHtml,
} from '@/lib/invites/email';

/**
 * GET ?companyId= — list resellers
 * POST — create reseller
 * PATCH — update reseller
 * DELETE ?companyId=&id=
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
      .from('container_resellers')
      .select('*')
      .eq('profile_id', companyId)
      .order('full_name', { ascending: true });

    if (error) {
      if (isMissing(error.message)) {
        return NextResponse.json({
          success: true,
          resellers: [],
          migration_required: true,
          warning:
            'Run supabase/migrations/20260714_container_resellers.sql',
          verify_fee_zar: RESELLER_VERIFY_FEE_ZAR,
        });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Stock + sales rollups
    const ids = (data || []).map((r) => r.id);
    let invByReseller = new Map<number, number>();
    let salesByReseller = new Map<
      number,
      { sales: number; commission: number; count: number }
    >();

    if (ids.length) {
      const [{ data: inv }, { data: sales }] = await Promise.all([
        supabase
          .from('reseller_inventory')
          .select('reseller_id, qty_on_hand')
          .eq('profile_id', companyId)
          .in('reseller_id', ids),
        supabase
          .from('reseller_sales')
          .select('reseller_id, total_amount, commission_total')
          .eq('profile_id', companyId)
          .in('reseller_id', ids),
      ]);
      for (const row of inv || []) {
        const id = Number(row.reseller_id);
        invByReseller.set(
          id,
          (invByReseller.get(id) || 0) + Number(row.qty_on_hand || 0)
        );
      }
      for (const row of sales || []) {
        const id = Number(row.reseller_id);
        if (!salesByReseller.has(id)) {
          salesByReseller.set(id, { sales: 0, commission: 0, count: 0 });
        }
        const m = salesByReseller.get(id)!;
        m.sales += Number(row.total_amount || 0);
        m.commission += Number(row.commission_total || 0);
        m.count += 1;
      }
    }

    const resellers = (data || []).map((r) => {
      const stats = salesByReseller.get(Number(r.id));
      return {
        ...r,
        stock_units: Math.round((invByReseller.get(Number(r.id)) || 0) * 10) / 10,
        sales_total: Math.round((stats?.sales || 0) * 100) / 100,
        commission_total: Math.round((stats?.commission || 0) * 100) / 100,
        sales_count: stats?.count || 0,
        invite_url: r.invite_token
          ? buildResellerInviteLink(String(r.invite_token))
          : null,
        verify_fee_zar: Number(r.verification_fee_zar ?? RESELLER_VERIFY_FEE_ZAR),
      };
    });

    return NextResponse.json({
      success: true,
      resellers,
      verify_fee_zar: RESELLER_VERIFY_FEE_ZAR,
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
    const body = await request.json();
    const companyId = Number(body.companyId);
    if (!Number.isFinite(companyId) || !body.full_name) {
      return NextResponse.json(
        { error: 'companyId and full_name required' },
        { status: 400 }
      );
    }
    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request) || body.privyUserId,
    });
    if (!gate.ok) return gate.response;

    const token = randomUUID().replace(/-/g, '');
    const row = {
      profile_id: companyId,
      full_name: String(body.full_name).trim(),
      email: body.email ? String(body.email).toLowerCase().trim() : null,
      phone: body.phone || null,
      id_number: body.id_number || null,
      status: 'active',
      portal_status: 'invited',
      primary_container_id: body.primary_container_id
        ? Number(body.primary_container_id)
        : null,
      invite_token: token,
      invited_at: new Date().toISOString(),
      verification_status: 'unverified',
      verification_fee_zar: RESELLER_VERIFY_FEE_ZAR,
      verification_fee_status: 'not_charged',
      notes: body.notes || null,
      created_by: gate.userId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from('container_resellers')
      .insert(row)
      .select('*')
      .single();

    if (error) {
      if (isMissing(error.message)) {
        return NextResponse.json(
          {
            error: error.message,
            hint: 'Run supabase/migrations/20260714_container_resellers.sql',
            code: 'MIGRATION_REQUIRED',
          },
          { status: 503 }
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const inviteLink = buildResellerInviteLink(token);
    let companyName = body.companyName || 'Your network operator';
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('trading_name, legal_name')
        .eq('id', companyId)
        .maybeSingle();
      companyName =
        profile?.trading_name || profile?.legal_name || companyName;
    } catch {
      /* ignore */
    }

    let containerName: string | null = null;
    if (row.primary_container_id) {
      const { data: c } = await supabase
        .from('containers')
        .select('name, container_code')
        .eq('id', row.primary_container_id)
        .maybeSingle();
      containerName = c?.name || c?.container_code || null;
    }

    const emailResult = await sendResellerInviteEmail({
      to: row.email,
      resellerName: row.full_name,
      companyName,
      containerName,
      inviteLink,
      companyId,
    });

    return NextResponse.json({
      success: true,
      reseller: {
        ...data,
        invite_url: inviteLink,
      },
      inviteLink,
      verify_fee_zar: RESELLER_VERIFY_FEE_ZAR,
      emailSent: emailResult.sent,
      message: emailResult.sent
        ? `Reseller created and invitation emailed to ${row.email}`
        : row.email
          ? emailResult.warning || 'Reseller created (email not sent)'
          : 'Reseller created — add an email and use Send invite to email them',
      warning: emailResult.warning || undefined,
      from: emailResult.from || undefined,
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
    for (const k of [
      'full_name',
      'email',
      'phone',
      'id_number',
      'status',
      'portal_status',
      'notes',
    ] as const) {
      if (body[k] !== undefined) updates[k] = body[k];
    }
    if (body.primary_container_id !== undefined) {
      updates.primary_container_id = body.primary_container_id
        ? Number(body.primary_container_id)
        : null;
    }
    const sendInvite =
      Boolean(body.send_invite) || Boolean(body.regenerate_invite);
    if (body.regenerate_invite || body.send_invite) {
      updates.invite_token = randomUUID().replace(/-/g, '');
      updates.invited_at = new Date().toISOString();
      updates.portal_status = 'invited';
    }

    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from('container_resellers')
      .update(updates)
      .eq('id', id)
      .eq('profile_id', companyId)
      .select('*')
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json({ error: 'Reseller not found' }, { status: 404 });
    }

    const inviteLink = data.invite_token
      ? buildResellerInviteLink(String(data.invite_token))
      : null;

    let emailResult: {
      sent: boolean;
      warning?: string;
      from?: string;
    } = { sent: false };

    if (sendInvite && inviteLink) {
      let companyName = body.companyName || 'Your network operator';
      const { data: profile } = await supabase
        .from('profiles')
        .select('trading_name, legal_name')
        .eq('id', companyId)
        .maybeSingle();
      companyName =
        profile?.trading_name || profile?.legal_name || companyName;

      let containerName: string | null = null;
      if (data.primary_container_id) {
        const { data: c } = await supabase
          .from('containers')
          .select('name, container_code')
          .eq('id', data.primary_container_id)
          .maybeSingle();
        containerName = c?.name || c?.container_code || null;
      }

      emailResult = await sendResellerInviteEmail({
        to: data.email,
        resellerName: data.full_name,
        companyName,
        containerName,
        inviteLink,
        companyId,
      });
    }

    return NextResponse.json({
      success: true,
      reseller: {
        ...data,
        invite_url: inviteLink,
      },
      inviteLink,
      emailSent: emailResult.sent,
      message: emailResult.sent
        ? `Invitation emailed to ${data.email}`
        : sendInvite
          ? emailResult.warning || 'Invite link updated'
          : 'Reseller updated',
      warning: emailResult.warning || undefined,
      from: emailResult.from || undefined,
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const companyId = Number(request.nextUrl.searchParams.get('companyId'));
    const id = Number(request.nextUrl.searchParams.get('id'));
    if (!Number.isFinite(companyId) || !Number.isFinite(id)) {
      return NextResponse.json(
        { error: 'companyId and id required' },
        { status: 400 }
      );
    }
    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request),
    });
    if (!gate.ok) return gate.response;

    const supabase = getSupabaseServer();
    const { error } = await supabase
      .from('container_resellers')
      .delete()
      .eq('id', id)
      .eq('profile_id', companyId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}

function isMissing(msg?: string) {
  return Boolean(
    msg && /does not exist|schema cache|could not find.*table/i.test(msg)
  );
}

async function sendResellerInviteEmail(opts: {
  to: string | null | undefined;
  resellerName: string;
  companyName: string;
  containerName?: string | null;
  inviteLink: string;
  companyId: number;
}): Promise<{ sent: boolean; warning?: string; from?: string }> {
  const email = opts.to ? String(opts.to).toLowerCase().trim() : '';
  if (!email || !email.includes('@')) {
    return {
      sent: false,
      warning: 'No valid email on the reseller — invitation email not sent',
    };
  }

  const from = getResendFrom();
  try {
    const resend = getResend();
    const { data: emailData, error: emailError } = await resend.emails.send({
      from,
      replyTo: getResendReplyTo(),
      to: email,
      subject: `Confirm & open your reseller portal — ${opts.companyName}`,
      html: resellerInviteEmailHtml({
        resellerName: opts.resellerName,
        companyName: opts.companyName,
        containerName: opts.containerName,
        inviteLink: opts.inviteLink,
      }),
      tags: [
        { name: 'type', value: 'reseller_invite' },
        { name: 'company_id', value: String(opts.companyId) },
      ],
    });

    if (emailError) {
      const msg =
        typeof emailError === 'object' &&
        emailError &&
        'message' in emailError
          ? String((emailError as { message?: string }).message)
          : String(emailError);
      return {
        sent: false,
        warning: `Invite created but email failed: ${msg}`,
        from,
      };
    }

    return {
      sent: true,
      from,
      warning: emailData?.id ? undefined : undefined,
    };
  } catch (emailErr: unknown) {
    const msg =
      emailErr instanceof Error ? emailErr.message : 'Email failed';
    return {
      sent: false,
      warning: `Invite created but email failed: ${msg}. Check RESEND_API_KEY.`,
      from,
    };
  }
}
