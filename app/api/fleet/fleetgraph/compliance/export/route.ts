import { NextRequest, NextResponse } from 'next/server';
import { requireCompanyPermission } from '@/lib/auth/api-auth';
import { centreRows, exportRows } from '@/lib/fleet/compliance-centre';
import { writeCsv } from '@/lib/fleet/csv';
import { loadFleetBook } from '@/lib/fleet/fleetgraph-db';
import { sastDate } from '@/lib/fleet/format';
import { capabilitiesFor, resolveFleetRole } from '@/lib/fleet/roles';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

const PRIVATE = { 'Cache-Control': 'private, no-store' };

function companyFromHeader(request: NextRequest): number {
  const companyId = Number(request.headers.get('x-fleet-company'));
  if (!Number.isFinite(companyId) || companyId <= 0) return 0;
  return companyId;
}

export async function GET(request: NextRequest) {
  const companyId = companyFromHeader(request);
  const permission = await requireCompanyPermission(request, companyId, 'operations', 'view');
  if (!permission.ok) {
    return NextResponse.json({ error: permission.error }, { status: permission.status, headers: PRIVATE });
  }
  const role = resolveFleetRole(permission.role);
  if (!capabilitiesFor(role).canExportCompliance) {
    return NextResponse.json({ error: 'You cannot do that.' }, { status: 403, headers: PRIVATE });
  }
  let loaded;
  try {
    loaded = await loadFleetBook(companyId);
  } catch {
    console.error('fleetgraph export failed');
    return NextResponse.json({ error: 'The desk could not export.' }, { status: 500, headers: PRIVATE });
  }
  if (!loaded.ready) {
    return NextResponse.json({ ready: false, reason: loaded.reason }, { status: 200, headers: PRIVATE });
  }
  const today = sastDate(new Date()) || new Date().toISOString().slice(0, 10);
  const rows = centreRows(loaded.book, today);
  const includeDrivers = loaded.book.workspace.real_data_enabled;
  const table = exportRows(rows, includeDrivers);
  const body = writeCsv(table.headers, table.rows);
  const note = includeDrivers ? '' : 'Note: driver rows stay off while demo-data mode is on.\r\n';
  const admin = getSupabaseAdmin();
  await admin.rpc('fg_commit_b', {
    p_company_id: companyId,
    p_diff: {
      company_id: companyId,
      upserts: {},
      inserts: {
        fg_audit_log: [
          {
            company_id: companyId,
            actor_kind: 'staff',
            actor_id: permission.userId,
            action: 'compliance.export',
            target_kind: 'compliance',
            target_id: '',
            payload: { rows: table.rows.length, include_drivers: includeDrivers },
          },
        ],
      },
    },
  });
  return new NextResponse(note + body, {
    status: 200,
    headers: {
      ...PRIVATE,
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="fleet-dates.csv"',
    },
  });
}
