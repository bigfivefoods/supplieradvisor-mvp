import { NextRequest, NextResponse } from 'next/server';
import {
  requireVerifiedUser,
  legacyPrivyFrom,
} from '@/lib/auth/api-auth';
import {
  COMPANY_RESTORE_DAYS,
  isCompanyDeleted,
  restoreCompany,
  softDeleteCompany,
} from '@/lib/business/delete-company';
import { getCompanyMembership } from '@/lib/business/access';
import { getSupabaseServer } from '@/lib/supabase/server-client';

/**
 * GET ?companyId= — lightweight company status (deleted?).
 * DELETE or POST { action: 'delete' } — soft-delete company (owner only).
 *
 * Body (POST/DELETE):
 * {
 *   companyId,
 *   privyUserId?,
 *   confirmName,      // exact trading name
 *   confirmPhrase,    // must be "DELETE"
 *   reason?
 * }
 */
export async function GET(request: NextRequest) {
  try {
    const companyId = Number(request.nextUrl.searchParams.get('companyId'));
    if (!Number.isFinite(companyId) || companyId <= 0) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }

    const auth = await requireVerifiedUser(request, {
      legacyPrivyUserId: legacyPrivyFrom(request),
    });
    if (!auth.ok) return auth.response;

    const mem = await getCompanyMembership(auth.userId, companyId);
    // Allow status check only for members of non-deleted; if deleted, membership is gone
    const deleted = await isCompanyDeleted(companyId);
    if (deleted) {
      return NextResponse.json({
        success: true,
        companyId,
        deleted: true,
        canDelete: false,
      });
    }
    if (!mem.ok) {
      return NextResponse.json({ error: mem.error }, { status: mem.status });
    }

    const supabase = getSupabaseServer();
    const { data } = await supabase
      .from('profiles')
      .select('id, trading_name')
      .eq('id', companyId)
      .maybeSingle();

    return NextResponse.json({
      success: true,
      companyId,
      deleted: false,
      trading_name: data?.trading_name || null,
      canDelete: mem.role === 'owner',
      role: mem.role,
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}

async function handleDelete(request: NextRequest) {
  const auth = await requireVerifiedUser(request, {
    legacyPrivyUserId: legacyPrivyFrom(request),
  });
  if (!auth.ok) return auth.response;

  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const companyId = Number(body.companyId);
  const result = await softDeleteCompany({
    companyId,
    privyUserId: auth.userId,
    confirmName: String(body.confirmName || ''),
    confirmPhrase: String(body.confirmPhrase || body.confirm || ''),
    reason: body.reason != null ? String(body.reason) : null,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, code: result.code },
      { status: result.status }
    );
  }

  return NextResponse.json({
    success: true,
    deleted: true,
    companyId: result.companyId,
    tradingName: result.tradingName,
    deletedAt: result.deletedAt,
    membersDeactivated: result.membersDeactivated,
    message:
      'Company deleted. It is hidden from your company list and the network. Operational history is retained for audit.',
    next: '/dashboard/select-company',
  });
}

export async function DELETE(request: NextRequest) {
  try {
    return await handleDelete(request);
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.clone().json().catch(() => ({}));
    const action = String(
      (body as { action?: string }).action || 'delete'
    ).toLowerCase();
    if (action === 'restore') {
      const auth = await requireVerifiedUser(request, {
        legacyPrivyUserId: legacyPrivyFrom(request),
      });
      if (!auth.ok) return auth.response;
      const companyId = Number((body as { companyId?: number }).companyId);
      const result = await restoreCompany({
        companyId,
        privyUserId: auth.userId,
      });
      if (!result.ok) {
        return NextResponse.json(
          { error: result.error, code: result.code },
          { status: result.status }
        );
      }
      return NextResponse.json({
        success: true,
        restored: true,
        companyId: result.companyId,
        tradingName: result.tradingName,
        message: `Company restored. Select it from your company list. Restore window is ${COMPANY_RESTORE_DAYS} days from deletion.`,
        next: '/dashboard/select-company',
      });
    }
    if (action !== 'delete') {
      return NextResponse.json(
        { error: 'action must be delete | restore' },
        { status: 400 }
      );
    }
    return await handleDelete(request);
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
