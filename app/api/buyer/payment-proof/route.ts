import { NextRequest, NextResponse } from 'next/server';
import {
  requireCompanyAccess,
  legacyPrivyFrom,
} from '@/lib/auth/api-auth';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { rateLimit, clientIp } from '@/lib/http/rate-limit';

/**
 * POST multipart — upload proof-of-payment (POP) for a buyer claim.
 * Form: file, buyerCompanyId|companyId, invoiceId?
 * Returns public URL for proof_url on payment claim.
 */
const POP_BUCKETS = [
  'company-documents',
  'product-documents',
  'contractor-documents',
  'payment-proofs',
];

function safeName(name?: string) {
  return (name || 'pop').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40);
}

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
    const invPart = invoiceId > 0 ? `inv-${invoiceId}` : 'claim';
    const filePath = `${companyId}/payment-proofs/${invPart}-${Date.now()}-${safeName(
      file.name.replace(/\.[^.]+$/, '')
    )}.${ext}`;

    const buffer = Buffer.from(await file.arrayBuffer());
    const contentType = file.type || 'application/octet-stream';
    const supabase = getSupabaseServer();

    let publicUrl: string | null = null;
    let usedBucket: string | null = null;
    const errors: string[] = [];

    for (const bucket of POP_BUCKETS) {
      const { error } = await supabase.storage
        .from(bucket)
        .upload(filePath, buffer, {
          cacheControl: '3600',
          upsert: true,
          contentType,
        });
      if (!error) {
        const { data } = supabase.storage.from(bucket).getPublicUrl(filePath);
        publicUrl = data.publicUrl;
        usedBucket = bucket;
        break;
      }
      errors.push(`${bucket}: ${error.message}`);
    }

    if (!publicUrl) {
      return NextResponse.json(
        {
          error:
            'Could not upload proof. Create a public Storage bucket: company-documents (or payment-proofs).',
          detail: errors.slice(0, 3),
        },
        { status: 503 }
      );
    }

    return NextResponse.json({
      success: true,
      url: publicUrl,
      proofUrl: publicUrl,
      bucket: usedBucket,
      path: filePath,
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
