import { NextRequest, NextResponse } from 'next/server';
import {
  requireCompanyAccess,
  legacyPrivyFrom,
} from '@/lib/auth/api-auth';
import { rateLimit, clientIp } from '@/lib/http/rate-limit';
import { uploadSensitiveDoc } from '@/lib/storage/private-docs';

/**
 * POST multipart — upload proof-of-payment (POP) for a buyer claim.
 * Form: file, buyerCompanyId|companyId, invoiceId?
 * Returns private storage reference for proof_url on payment claim.
 */

export async function POST(request: NextRequest) {
  try {
    const ip = clientIp(request);
    const rl = rateLimit(`payment-proof:${ip}`, {
      limit: 20,
      windowMs: 60_000,
    });
    if (!rl.ok) {
      return NextResponse.json(
        { error: 'Rate limited', retryAfterSec: rl.retryAfterSec },
        {
          status: 429,
          headers: { 'Retry-After': String(rl.retryAfterSec) },
        }
      );
    }

    const form = await request.formData();
    const file = form.get('file');
    const companyId = Number(
      form.get('buyerCompanyId') || form.get('companyId')
    );
    const invoiceId = Number(form.get('invoiceId') || 0);

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'file is required' }, { status: 400 });
    }
    if (!Number.isFinite(companyId) || companyId <= 0) {
      return NextResponse.json(
        { error: 'buyerCompanyId required' },
        { status: 400 }
      );
    }

    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request),
    });
    if (!gate.ok) return gate.response;

    if (file.size > 12 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'File must be under 12MB' },
        { status: 400 }
      );
    }

    const allowed =
      file.type.startsWith('image/') ||
      file.type === 'application/pdf' ||
      !file.type;
    if (file.type && !allowed) {
      return NextResponse.json(
        { error: 'Use image (JPG/PNG/WebP) or PDF for proof of payment' },
        { status: 400 }
      );
    }

    const ext =
      file.name.split('.').pop()?.toLowerCase() ||
      (file.type === 'application/pdf' ? 'pdf' : 'jpg');

    const buffer = Buffer.from(await file.arrayBuffer());
    const contentType = file.type || 'application/octet-stream';

    const proofRef = await uploadSensitiveDoc({
      companyId,
      kind: invoiceId > 0 ? `payment-proofs-inv-${invoiceId}` : 'payment-proofs-claim',
      body: buffer,
      contentType,
      ext,
    });

    return NextResponse.json({
      success: true,
      url: proofRef,
      proofUrl: proofRef,
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
