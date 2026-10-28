import { NextRequest, NextResponse } from 'next/server';
import { legacyPrivyFrom, requireCompanyAccess } from '@/lib/auth/api-auth';
import {
  createDeliveryNote,
  getDeliveryNoteDesk,
  revokeDeliveryNote,
} from '@/lib/customers/delivery-note-store';

function companyIdOf(request: NextRequest, body?: Record<string, unknown>): number {
  const fromBody = Number(body?.companyId);
  if (Number.isFinite(fromBody) && fromBody > 0) return fromBody;
  return Number(request.nextUrl.searchParams.get('companyId'));
}

/**
 * Seller delivery notes for one invoice.
 * GET  ?companyId=&invoiceId=
 * POST { companyId, invoiceId, lines, deliveredBy, vehicleReg, notes, deliveryDate, deliveryAddress, receivedByName, receivedByDate }
 * POST { companyId, invoiceId, noteId, action: 'revoke' }
 */
export async function GET(request: NextRequest) {
  try {
    const companyId = companyIdOf(request);
    const invoiceId = Number(request.nextUrl.searchParams.get('invoiceId'));
    if (!Number.isFinite(companyId) || companyId <= 0 || !Number.isFinite(invoiceId) || invoiceId <= 0) {
      return NextResponse.json({ error: 'companyId and invoiceId required' }, { status: 400 });
    }
    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request),
    });
    if (!gate.ok) return gate.response;

    const desk = await getDeliveryNoteDesk({ companyId, invoiceId });
    if (!desk.ok) return NextResponse.json({ error: desk.error }, { status: desk.status });
    return NextResponse.json({ success: true, ...desk });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const companyId = companyIdOf(request, body);
    const invoiceId = Number(body.invoiceId);
    if (!Number.isFinite(companyId) || companyId <= 0 || !Number.isFinite(invoiceId) || invoiceId <= 0) {
      return NextResponse.json({ error: 'companyId and invoiceId required' }, { status: 400 });
    }
    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request, body),
    });
    if (!gate.ok) return gate.response;

    if (String(body.action || '') === 'revoke') {
      const noteId = String(body.noteId || '').trim();
      if (!noteId) return NextResponse.json({ error: 'noteId required' }, { status: 400 });
      const revoked = await revokeDeliveryNote({ companyId, invoiceId, noteId });
      if (!revoked.ok) return NextResponse.json({ error: revoked.error }, { status: revoked.status });
      return NextResponse.json({ success: true, revoked: true });
    }

    const lines = Array.isArray(body.lines)
      ? body.lines.map((line) => {
          const row = (line || {}) as Record<string, unknown>;
          return {
            key: String(row.key || ''),
            deliveredQty: Number(row.deliveredQty),
          };
        })
      : undefined;

    const created = await createDeliveryNote({
      companyId,
      invoiceId,
      input: {
        deliveryDate: body.deliveryDate != null ? String(body.deliveryDate) : null,
        deliveredBy: body.deliveredBy != null ? String(body.deliveredBy) : null,
        vehicleReg: body.vehicleReg != null ? String(body.vehicleReg) : null,
        notes: body.notes != null ? String(body.notes) : null,
        deliveryAddress: body.deliveryAddress != null ? String(body.deliveryAddress) : null,
        receivedByName: body.receivedByName != null ? String(body.receivedByName) : null,
        receivedByDate: body.receivedByDate != null ? String(body.receivedByDate) : null,
        lines,
      },
    });
    if (!created.ok) return NextResponse.json({ error: created.error }, { status: created.status });
    return NextResponse.json({ success: true, note: created.note });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
