import { NextRequest, NextResponse } from 'next/server';
import { requireCompanyPermission } from '@/lib/auth/api-auth';
import { cpkForBook } from '@/lib/fleet/book-cpk';
import { commitFleetOp, customerBelongsToCompany, loadFleetBook, nextJobNumber } from '@/lib/fleet/fleetgraph-db';
import { sastDate } from '@/lib/fleet/format';
import { periodFor } from '@/lib/fleet/periods';
import { capabilitiesFor, resolveFleetRole, viewForRole } from '@/lib/fleet/roles';
import type { FleetBook, FleetOp, FleetOpName } from '@/lib/fleet/types';
import { FLEET_OPS } from '@/lib/fleet/types';

export const dynamic = 'force-dynamic';

const PRIVATE = { 'Cache-Control': 'private, no-store' };

function json(status: number, body: unknown) {
  return NextResponse.json(body, { status, headers: PRIVATE });
}

function companyFromHeader(request: NextRequest): number {
  const raw = request.headers.get('x-fleet-company');
  const companyId = Number(raw);
  if (!Number.isFinite(companyId) || companyId <= 0) return 0;
  return companyId;
}

async function gate(request: NextRequest, need: 'view' | 'write') {
  const companyId = companyFromHeader(request);
  const permission = await requireCompanyPermission(request, companyId, 'operations', need);
  if (!permission.ok) {
    return { ok: false as const, response: json(permission.status, { error: permission.error }) };
  }
  return { ok: true as const, companyId, userId: permission.userId, companyRole: permission.role };
}

function todaySast(): string {
  return sastDate(new Date()) || new Date().toISOString().slice(0, 10);
}

function present(book: FleetBook, companyRole: string) {
  const role = resolveFleetRole(companyRole);
  const caps = capabilitiesFor(role, { dispatcherSeesRates: book.workspace.dispatcher_sees_rates });
  const today = todaySast();
  const period = periodFor('last', today, book.workspace.cpk_window_days);
  const cpk = caps.seesCosts ? cpkForBook(book, period) : undefined;
  const view = viewForRole({ ...book, ...(cpk ? { cpk } : {}) }, role, {
    dispatcherSeesRates: book.workspace.dispatcher_sees_rates,
  });
  return { ready: true, role, caps, period, book: view };
}

async function serveBook(companyId: number, companyRole: string, book?: FleetBook) {
  if (book) return json(200, present(book, companyRole));
  try {
    const loaded = await loadFleetBook(companyId);
    if (!loaded.ready) return json(200, { ready: false, reason: 'migration_pending' });
    return json(200, present(loaded.book, companyRole));
  } catch {
    return json(200, { ready: false, reason: 'migration_pending' });
  }
}

export async function GET(request: NextRequest) {
  const gated = await gate(request, 'view');
  if (!gated.ok) return gated.response;
  return serveBook(gated.companyId, gated.companyRole);
}

export async function POST(request: NextRequest) {
  const gated = await gate(request, 'write');
  if (!gated.ok) return gated.response;
  const body = await readBody(request);
  if (!body) return json(400, { error: 'Check the form and try again.' });
  const opName = typeof body.op === 'string' ? body.op : '';
  if (!FLEET_OPS.includes(opName as FleetOpName)) return json(400, { error: 'That action is not available.' });
  const payload = body.payload && typeof body.payload === 'object' ? (body.payload as Record<string, unknown>) : null;
  if (!payload) return json(400, { error: 'Check the form and try again.' });
  let loaded;
  try {
    loaded = await loadFleetBook(gated.companyId);
  } catch {
    return json(200, { ready: false, reason: 'migration_pending' });
  }
  if (!loaded.ready) return json(200, { ready: false, reason: 'migration_pending' });
  const fleetRole = resolveFleetRole(gated.companyRole);
  const customerId = Number(payload.customer_id);
  if (payload.customer_id != null && payload.customer_id !== '' && Number.isFinite(customerId) && customerId > 0) {
    let same = false;
    try {
      same = await customerBelongsToCompany(customerId, gated.companyId);
    } catch {
      return json(400, { error: 'Choose a customer from this company.' });
    }
    if (!same) return json(400, { error: 'Choose a customer from this company.' });
  }
  if (opName === 'job.upsert' && !payload.reference && !payload.id) {
    const number = await nextJobNumber(gated.companyId);
    if (number == null) return json(200, { ready: false, reason: 'migration_pending' });
    const prefix = loaded.book.workspace.waybill_prefix || 'JOB';
    payload.reference = `${prefix}-${number}`;
  }
  const op = { op: opName as FleetOpName, payload } satisfies FleetOp;
  try {
    const outcome = await commitFleetOp(
      loaded.book,
      op,
      {
        role: fleetRole,
        actorId: gated.userId,
        now: new Date().toISOString(),
        companyId: gated.companyId,
        enforceRealData: true,
      },
      typeof body.expected_updated_at === 'string' ? body.expected_updated_at : null
    );
    if (!outcome.ok) return json(outcome.status, { error: outcome.error });
    return json(200, present(outcome.book, gated.companyRole));
  } catch {
    return json(200, { ready: false, reason: 'migration_pending' });
  }
}

async function readBody(request: NextRequest): Promise<{ op?: unknown; payload?: unknown; expected_updated_at?: unknown } | null> {
  try {
    return (await request.json()) as { op?: unknown; payload?: unknown; expected_updated_at?: unknown };
  } catch {
    return null;
  }
}
