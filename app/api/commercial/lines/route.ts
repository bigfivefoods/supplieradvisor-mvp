import { NextRequest, NextResponse } from 'next/server';
import {
  requireCompanyAccess,
  legacyPrivyFrom,
} from '@/lib/auth/api-auth';
import {
  acceptPrice,
  addFromInventory,
  loadPartyLines,
  loadRevisions,
  proposePrice,
  rejectPrice,
  saveSlaFields,
} from '@/lib/commercial/db';
import { parsePartyKind } from '@/lib/commercial/engine';

function partyFrom(sp: URLSearchParams, body?: Record<string, unknown>) {
  const kind =
    parsePartyKind(body?.partyKind ?? body?.party_kind ?? sp.get('partyKind')) ||
    'supplier';
  const supplierId = Number(body?.supplierId ?? body?.supplier_id ?? sp.get('supplierId'));
  const customerId = Number(body?.customerId ?? body?.customer_id ?? sp.get('customerId'));
  return {
    partyKind: kind,
    supplierId: Number.isFinite(supplierId) && supplierId > 0 ? supplierId : null,
    customerId: Number.isFinite(customerId) && customerId > 0 ? customerId : null,
  };
}

export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const companyId = Number(sp.get('companyId'));
    if (!Number.isFinite(companyId) || companyId <= 0) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }
    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request),
    });
    if (!gate.ok) return gate.response;
    const party = partyFrom(sp);
    const lineId = Number(sp.get('lineId') || sp.get('id'));
    const productId = Number(sp.get('productId'));
    const both = sp.get('both') === '1';
    const loadOne = (kind: 'supplier' | 'customer') =>
      loadPartyLines({
        profileId: companyId,
        partyKind: kind,
        supplierId: kind === 'supplier' ? party.supplierId : null,
        customerId: kind === 'customer' ? party.customerId : null,
        withQty: true,
      });
    let lines = both
      ? [...(await loadOne('supplier')), ...(await loadOne('customer'))]
      : await loadOne(party.partyKind);
    if (Number.isFinite(productId) && productId > 0) {
      lines = lines.filter((l) => l.product_id === productId);
    }
    let revisions = null;
    if (Number.isFinite(lineId) && lineId > 0) {
      const hit = lines.find((l) => l.id === lineId);
      if (hit) revisions = await loadRevisions(hit.id);
    }
    return NextResponse.json({ success: true, lines, revisions });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const companyId = Number(body.companyId);
    if (!Number.isFinite(companyId) || companyId <= 0) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }
    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request, body),
    });
    if (!gate.ok) return gate.response;
    const party = partyFrom(new URLSearchParams(), body);
    const action = String(body.action || 'propose');
    const lineId = Number(body.lineId || body.id);

    if (action === 'sla') {
      const productId = Number(body.product_id || body.productId);
      if (!Number.isFinite(productId) || productId <= 0) {
        return NextResponse.json({ error: 'product_id required' }, { status: 400 });
      }
      const r = await saveSlaFields({
        profileId: companyId,
        productId,
        short_description:
          body.short_description != null ? String(body.short_description) : undefined,
        long_description:
          body.long_description != null ? String(body.long_description) : undefined,
        lead_time_days:
          body.lead_time_days != null && Number.isFinite(Number(body.lead_time_days))
            ? Number(body.lead_time_days)
            : undefined,
        moq:
          body.moq != null && Number.isFinite(Number(body.moq))
            ? Number(body.moq)
            : undefined,
      });
      if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
      return NextResponse.json({ success: true });
    }

    if (action === 'add') {
      const ids = Array.isArray(body.productIds)
        ? body.productIds.map(Number)
        : body.productId != null
          ? [Number(body.productId)]
          : [];
      const r = await addFromInventory({
        profileId: companyId,
        partyKind: party.partyKind,
        supplierId: party.supplierId,
        customerId: party.customerId,
        productIds: ids,
        actor: 'host',
      });
      if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
      return NextResponse.json({ success: true, lines: r.lines });
    }

    if (!Number.isFinite(lineId) || lineId <= 0) {
      return NextResponse.json({ error: 'lineId required' }, { status: 400 });
    }

    if (action === 'accept') {
      const r = await acceptPrice({
        profileId: companyId,
        lineId,
        actor: 'host',
        actorLabel: 'host',
      });
      if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
      return NextResponse.json({ success: true, line: r.line });
    }
    if (action === 'reject') {
      const r = await rejectPrice({
        profileId: companyId,
        lineId,
        actor: 'host',
        actorLabel: 'host',
        note: body.note != null ? String(body.note) : null,
      });
      if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
      return NextResponse.json({ success: true, line: r.line });
    }

    const price = Number(body.price ?? body.pending_price ?? body.new_price);
    const r = await proposePrice({
      profileId: companyId,
      lineId,
      newPrice: price,
      actor: 'host',
      note: body.note != null ? String(body.note) : null,
    });
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
    return NextResponse.json({ success: true, line: r.line });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
