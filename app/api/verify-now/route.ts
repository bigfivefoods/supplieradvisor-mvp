import { NextRequest, NextResponse } from 'next/server';
import {
  callVerifyNowCipcCompany,
  callVerifyNowSaid,
  parseVerifyNowCipcResult,
  parseVerifyNowSaidResult,
} from '@/lib/verifynow/client';

/**
 * Generic VerifyNow proxy used by business profile + contractors.
 *
 * SA ID: reportType said_verification | consumer_trace → /api/external/verify
 * CIPC:  reportType cipc_company_match (or type: 'cipc') → /api/external/cipc
 *
 * Docs: https://www.verifynow.co.za/api-docs
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const mode = body.mode === 'sandbox' ? 'sandbox' : undefined;

    const wantsCipc =
      body.reportType === 'cipc_company_match' ||
      body.type === 'cipc' ||
      body.service === 'cipc' ||
      !!body.registrationNumber ||
      !!body.registration_number;

    if (wantsCipc) {
      const vn = await callVerifyNowCipcCompany({
        registrationNumber: body.registrationNumber || body.registration_number,
        vatNumber: body.vatNumber || body.vat_number,
        solePropIdNumber: body.solePropIdNumber || body.sole_prop_id_number,
        mode,
      });
      if (!vn.ok) {
        return NextResponse.json(
          {
            error: vn.error,
            details: vn.data,
            hint:
              vn.status === 503
                ? 'Set VERIFYNOW_API_KEY from https://www.verifynow.co.za'
                : undefined,
          },
          { status: vn.status >= 400 ? vn.status : 502 }
        );
      }
      const parsed = parseVerifyNowCipcResult(vn.data);
      return NextResponse.json({ ...vn.data, parsed });
    }

    const idNumber = String(body.idNumber || body.id_number || '').replace(/\s/g, '');
    if (!idNumber) {
      return NextResponse.json(
        {
          error:
            'idNumber is required for SA ID checks, or registration_number for CIPC company checks',
        },
        { status: 400 }
      );
    }

    // If caller sends a full custom body beyond id, pass through for compatibility
    if (body.rawProxy === true) {
      const apiKey = process.env.VERIFYNOW_API_KEY;
      if (!apiKey) {
        return NextResponse.json(
          {
            error: 'VERIFYNOW_API_KEY is not configured',
            hint: 'Add key from verifynow.co.za Settings',
          },
          { status: 503 }
        );
      }
      const response = await fetch('https://www.verifynow.co.za/api/external/verify', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'Content-Type': 'application/json',
          'Idempotency-Key': crypto.randomUUID(),
        },
        body: JSON.stringify(body),
      });
      const result = await response.json();
      return NextResponse.json(result, { status: response.status });
    }

    const reportType =
      body.reportType === 'consumer_trace' ? 'consumer_trace' : 'said_verification';

    const vn = await callVerifyNowSaid({ idNumber, mode, reportType });
    if (!vn.ok) {
      return NextResponse.json(
        {
          error: vn.error,
          details: vn.data,
          hint:
            vn.status === 503
              ? 'Set VERIFYNOW_API_KEY from https://www.verifynow.co.za'
              : undefined,
        },
        { status: vn.status >= 400 ? vn.status : 502 }
      );
    }
    const parsed = parseVerifyNowSaidResult(vn.data);
    return NextResponse.json({ ...vn.data, parsed });
  } catch (error: unknown) {
    console.error('VerifyNow API route error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to verify with VerifyNow' },
      { status: 500 }
    );
  }
}
