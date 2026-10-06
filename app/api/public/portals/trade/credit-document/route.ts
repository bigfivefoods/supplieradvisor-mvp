import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit';
import { resolveGuestViewer } from '@/lib/portals/portal-guest';
import { acceptCreditFile } from '@/lib/customers/credit-documents';
import {
  attachCreditDocument,
  CreditApplicationError,
} from '@/lib/customers/credit-application-store';

export const runtime = 'nodejs';

/** Attach a CIPC, bank letter, or identity document to the open credit application. */
export async function POST(request: NextRequest) {
  try {
    const form = await request.formData();
    const token = String(form.get('token') || '').trim();
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'ip';
    const rl = checkRateLimit({
      key: `credit-doc:${token.slice(0, 24)}:${ip}`,
      limit: 20,
      windowMs: 60 * 60 * 1000,
    });
    if (!rl.ok) {
      const limited = rateLimitResponse(rl.retryAfterSeconds);
      return NextResponse.json(limited.body, {
        status: limited.status,
        headers: limited.headers,
      });
    }
    const guest = await resolveGuestViewer(token);
    if (!guest.ok) {
      return NextResponse.json({ error: guest.error }, { status: guest.status });
    }
    const { portal, viewer } = guest.ctx;
    if (portal.kind !== 'customer' || !viewer.customer_id) {
      return NextResponse.json(
        { error: 'Credit documents are for customer portals.' },
        { status: 403 }
      );
    }
    const file = form.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Choose a file to attach' }, { status: 400 });
    }
    const rejected = acceptCreditFile({
      name: file.name,
      type: file.type,
      size: file.size,
    });
    if (rejected) return NextResponse.json({ error: rejected }, { status: 400 });
    const application = await attachCreditDocument({
      companyId: portal.profile_id,
      customerId: viewer.customer_id,
      kind: form.get('kind'),
      fileName: file.name,
      contentType: file.type || 'application/pdf',
      body: Buffer.from(await file.arrayBuffer()),
    });
    return NextResponse.json({ success: true, application });
  } catch (error) {
    const status = error instanceof CreditApplicationError ? error.status : 500;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Could not attach the document' },
      { status }
    );
  }
}
