/**
 * POST /api/advisors/special-dates/pdf
 * A4 landscape PDF of the birthday and anniversary rows on screen.
 */
import { NextRequest, NextResponse } from 'next/server';
import {
  legacyPrivyFrom,
  requireCompanyAccess,
} from '@/lib/auth/api-auth';
import { rateLimit } from '@/lib/http/rate-limit';
import {
  buildSpecialDatesPdf,
  parseSpecialDatesPdfBody,
  specialDatesPdfFilename,
} from '@/lib/fitness/special-dates-pdf';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const companyId = Number(
      body && typeof body === 'object'
        ? (body as { companyId?: unknown }).companyId
        : NaN
    );
    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }
    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request),
    });
    if (!gate.ok) return gate.response;

    const rl = rateLimit(`special-dates-pdf:${gate.userId}`, {
      limit: 30,
      windowMs: 60 * 60 * 1000,
    });
    if (!rl.ok) {
      return NextResponse.json(
        { error: 'Too many PDF downloads. Try again shortly.' },
        { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } }
      );
    }

    const parsed = parseSpecialDatesPdfBody(body);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const buf = await buildSpecialDatesPdf(parsed.value);
    const filename = specialDatesPdfFilename(
      parsed.value.place,
      parsed.value.from,
      parsed.windowId
    );
    const bytes = new Uint8Array(buf);
    return new NextResponse(bytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(bytes.byteLength),
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (e: unknown) {
    console.error('special dates pdf', e);
    return NextResponse.json(
      { error: 'Could not build the PDF' },
      { status: 500 }
    );
  }
}
