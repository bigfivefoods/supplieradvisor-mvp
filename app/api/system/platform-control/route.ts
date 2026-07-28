import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  requireVerifiedUser,
  legacyPrivyFrom,
} from '@/lib/auth/api-auth';
import {
  isPlatformOperatorUserId,
  GOV_PENDING_MESSAGE,
  GOV_MODULE_LOCK_MESSAGE,
} from '@/lib/system/platform-control';
import { familyForAgencyType } from '@/lib/entities/programme-hierarchy';

export const runtime = 'nodejs';

/**
 * GET — whether the current user is a platform operator + pending gov depts.
 * Does not expose operator email list.
 */
export async function GET(request: NextRequest) {
  try {
    const gate = await requireVerifiedUser(request, {
      legacyPrivyUserId: legacyPrivyFrom(request),
    });
    if (!gate.ok) return gate.response;

    const operator = await isPlatformOperatorUserId(gate.userId);
    const payload: Record<string, unknown> = {
      success: true,
      operator,
      messages: {
        pending: GOV_PENDING_MESSAGE,
        module_lock: GOV_MODULE_LOCK_MESSAGE,
      },
    };

    if (operator) {
      const supabase = getSupabaseServer();
      const { data: pending } = await supabase
        .from('nsnp_agency_profiles')
        .select(
          'profile_id, agency_name, agency_type, province, status, contact_email, created_at, updated_at'
        )
        .eq('status', 'pending')
        .order('updated_at', { ascending: false })
        .limit(100);
      payload.pending_departments = (pending || []).map((p) => ({
        ...p,
        family: familyForAgencyType(String(p.agency_type)),
      }));
    }

    return NextResponse.json(payload);
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
