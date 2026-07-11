import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  callVerifyNowSaid,
  isValidSaIdNumber,
  parseVerifyNowSaidResult,
} from '@/lib/verifynow/client';
import { requireCompanyAccess, legacyPrivyFrom, requireVerifiedUser } from '@/lib/auth/api-auth';

/**
 * POST — run VerifyNow SA ID check for a contractor
 * Body: { contractorId, companyId?, idNumber?, mode?, consent: true }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const contractorId = Number(body.contractorId ?? body.id);
    if (!Number.isFinite(contractorId)) {
      return NextResponse.json({ error: 'contractorId is required' }, { status: 400 });
    }
    if (!body.consent) {
      return NextResponse.json(
        {
          error:
            'POPIA consent is required before running an identity check. Confirm the contractor consented.',
        },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServer();
    const { data: contractor, error: fetchErr } = await supabase
      .from('container_contractors')
      .select('*')
      .eq('id', contractorId)
      .maybeSingle();

    if (fetchErr || !contractor) {
      return NextResponse.json({ error: 'Contractor not found' }, { status: 404 });
    }

    const idNumber = String(body.idNumber || contractor.id_number || '').replace(/\s/g, '');
    if (!idNumber) {
      return NextResponse.json(
        { error: 'SA ID number is required for VerifyNow verification' },
        { status: 400 }
      );
    }
    if (!isValidSaIdNumber(idNumber)) {
      return NextResponse.json(
        { error: 'Invalid South African ID number format or checksum' },
        { status: 400 }
      );
    }

    // Mark pending
    await supabase
      .from('container_contractors')
      .update({
        id_number: idNumber,
        verification_status: 'pending',
        consent_identity_check: true,
        consent_identity_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', contractorId);

    const mode = body.mode === 'sandbox' ? 'sandbox' : undefined;
    const reportType = body.reportType === 'consumer_trace' ? 'consumer_trace' : 'said_verification';

    const vn = await callVerifyNowSaid({ idNumber, mode, reportType });
    if (!vn.ok) {
      await supabase
        .from('container_contractors')
        .update({
          verification_status: 'failed',
          verification_provider: 'verifynow',
          verification_data: { error: vn.error, raw: vn.data },
          updated_at: new Date().toISOString(),
        })
        .eq('id', contractorId);

      return NextResponse.json(
        {
          error: vn.error || 'VerifyNow verification failed',
          details: vn.data,
          hint:
            vn.status === 503
              ? 'Set VERIFYNOW_API_KEY in Vercel / server env (from https://www.verifynow.co.za settings)'
              : vn.status === 402
                ? 'Top up VerifyNow credits at verifynow.co.za'
                : undefined,
        },
        { status: vn.status >= 400 ? vn.status : 502 }
      );
    }

    const parsed = parseVerifyNowSaidResult(vn.data);
    const now = new Date().toISOString();

    // Name match hint (soft): if contractor full_name differs wildly, flag mismatch but still store result
    let status = parsed.ok ? 'verified' : 'failed';
    if (parsed.ok && contractor.full_name && parsed.fullName) {
      const normalize = (s: string) =>
        s
          .toLowerCase()
          .replace(/[^a-z\s]/g, '')
          .split(/\s+/)
          .filter(Boolean)
          .sort()
          .join(' ');
      const a = normalize(contractor.full_name);
      const b = normalize(parsed.fullName);
      if (a && b && !a.includes(b.split(' ')[0]) && !b.includes(a.split(' ')[0])) {
        status = 'mismatch';
      }
    }

    const updates = {
      id_number: idNumber,
      verification_status: status,
      verified_at: parsed.ok ? now : null,
      verification_provider: 'verifynow',
      verification_reference: parsed.requestId || parsed.transactionId || null,
      verification_data: vn.data,
      verified_first_names: parsed.firstNames || null,
      verified_last_name: parsed.lastName || null,
      verified_dob: parsed.dob || null,
      // Optionally enrich display name if blank-ish
      updated_at: now,
    };

    const { data: updated, error: updErr } = await supabase
      .from('container_contractors')
      .update(updates)
      .eq('id', contractorId)
      .select('*')
      .single();

    if (updErr) {
      return NextResponse.json({ error: updErr.message, verifyResult: vn.data }, { status: 500 });
    }

    // Audit log (best effort)
    await supabase.from('contractor_verifications').insert({
      contractor_id: contractorId,
      profile_id: contractor.profile_id,
      id_number: idNumber,
      provider: 'verifynow',
      report_type: reportType,
      status,
      request_id: parsed.requestId || null,
      mode: String(vn.data.mode || mode || 'production'),
      result: vn.data,
    });

    return NextResponse.json({
      success: true,
      status,
      contractor: updated,
      verifiedName: parsed.fullName,
      statusText: parsed.statusText,
      requestId: parsed.requestId,
      message:
        status === 'verified'
          ? `Verified via VerifyNow: ${parsed.fullName || idNumber}`
          : status === 'mismatch'
            ? `VerifyNow returned ${parsed.fullName}, which may not match the appointed name`
            : `Verification did not pass: ${parsed.statusText}`,
      provider: 'verifynow',
      providerUrl: 'https://www.verifynow.co.za',
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Verification failed' },
      { status: 500 }
    );
  }
}
