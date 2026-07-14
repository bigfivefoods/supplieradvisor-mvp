import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  callVerifyNowSaid,
  isValidSaIdNumber,
  parseVerifyNowSaidResult,
} from '@/lib/verifynow/client';
import {
  requireCompanyAccess,
  legacyPrivyFrom,
} from '@/lib/auth/api-auth';
import { RESELLER_VERIFY_FEE_ZAR } from '@/lib/containers/resellers';

/**
 * POST — VerifyNow SA ID for a reseller.
 * On successful verification, charges R50 verification fee (recorded on reseller).
 * Body: { companyId, resellerId, idNumber?, consent: true }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const companyId = Number(body.companyId);
    const resellerId = Number(body.resellerId ?? body.id);
    if (!Number.isFinite(companyId) || !Number.isFinite(resellerId)) {
      return NextResponse.json(
        { error: 'companyId and resellerId required' },
        { status: 400 }
      );
    }
    if (!body.consent) {
      return NextResponse.json(
        {
          error:
            'POPIA consent is required before running an identity check.',
        },
        { status: 400 }
      );
    }

    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request) || body.privyUserId,
    });
    if (!gate.ok) return gate.response;

    const supabase = getSupabaseServer();
    const { data: reseller, error: fetchErr } = await supabase
      .from('container_resellers')
      .select('*')
      .eq('id', resellerId)
      .eq('profile_id', companyId)
      .maybeSingle();

    if (fetchErr || !reseller) {
      return NextResponse.json({ error: 'Reseller not found' }, { status: 404 });
    }

    const idNumber = String(body.idNumber || reseller.id_number || '').replace(
      /\s/g,
      ''
    );
    if (!idNumber) {
      return NextResponse.json(
        { error: 'SA ID number is required for VerifyNow' },
        { status: 400 }
      );
    }
    if (!isValidSaIdNumber(idNumber)) {
      return NextResponse.json(
        { error: 'Invalid South African ID number format or checksum' },
        { status: 400 }
      );
    }

    await supabase
      .from('container_resellers')
      .update({
        id_number: idNumber,
        verification_status: 'pending',
        consent_identity_check: true,
        consent_identity_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', resellerId);

    const vn = await callVerifyNowSaid({
      idNumber,
      mode: body.mode === 'sandbox' ? 'sandbox' : undefined,
    });

    if (!vn.ok) {
      await supabase
        .from('container_resellers')
        .update({
          verification_status: 'failed',
          verification_provider: 'verifynow',
          verification_data: { error: vn.error, raw: vn.data },
          updated_at: new Date().toISOString(),
        })
        .eq('id', resellerId);

      return NextResponse.json(
        {
          error: vn.error || 'VerifyNow failed',
          fee_charged: false,
          verify_fee_zar: RESELLER_VERIFY_FEE_ZAR,
          hint:
            vn.status === 503
              ? 'Set VERIFYNOW_API_KEY in server env'
              : vn.status === 402
                ? 'Top up VerifyNow credits'
                : undefined,
        },
        { status: vn.status >= 400 ? vn.status : 502 }
      );
    }

    const parsed = parseVerifyNowSaidResult(vn.data);
    let status = parsed.ok ? 'verified' : 'failed';
    if (parsed.ok && reseller.full_name && parsed.fullName) {
      const normalize = (s: string) =>
        s
          .toLowerCase()
          .replace(/[^a-z\s]/g, '')
          .split(/\s+/)
          .filter(Boolean)
          .sort()
          .join(' ');
      const a = normalize(reseller.full_name);
      const b = normalize(parsed.fullName);
      if (
        a &&
        b &&
        !a.includes(b.split(' ')[0]) &&
        !b.includes(a.split(' ')[0])
      ) {
        status = 'mismatch';
      }
    }

    const fee = Number(
      reseller.verification_fee_zar ?? RESELLER_VERIFY_FEE_ZAR
    );
    const chargeFee = status === 'verified' || status === 'mismatch';
    const now = new Date().toISOString();

    const updates: Record<string, unknown> = {
      id_number: idNumber,
      verification_status: status,
      verification_provider: 'verifynow',
      verification_reference:
        parsed.transactionId || parsed.requestId || null,
      verification_data: vn.data,
      verified_first_names: parsed.firstNames || null,
      verified_last_name: parsed.lastName || null,
      verified_dob: parsed.dob || null,
      verified_at: chargeFee ? now : null,
      updated_at: now,
    };

    if (chargeFee && reseller.verification_fee_status !== 'charged') {
      updates.verification_fee_status = 'charged';
      updates.verification_fee_charged_at = now;
      updates.verification_fee_zar = fee;
    }

    const { data: updated, error: upErr } = await supabase
      .from('container_resellers')
      .update(updates)
      .eq('id', resellerId)
      .select('*')
      .single();

    if (upErr) {
      return NextResponse.json({ error: upErr.message }, { status: 500 });
    }

    // Activity log for billing visibility
    if (chargeFee) {
      await supabase.from('activity_log').insert({
        profile_id: companyId,
        action: 'reseller.verifynow_charged',
        entity_type: 'container_reseller',
        entity_id: String(resellerId),
        summary: `VerifyNow fee R${fee} for ${reseller.full_name}`,
        metadata: {
          fee_zar: fee,
          status,
          reseller_id: resellerId,
        },
      });
    }

    return NextResponse.json({
      success: true,
      reseller: updated,
      verification_status: status,
      fee_charged: chargeFee && reseller.verification_fee_status !== 'charged',
      verify_fee_zar: fee,
      message: chargeFee
        ? `Verified. R${fee} verification fee recorded for this reseller.`
        : 'Verification did not succeed — no fee charged.',
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
