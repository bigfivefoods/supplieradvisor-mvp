import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  requireCompanyAccess,
  legacyPrivyFrom,
} from '@/lib/auth/api-auth';

/**
 * GET ?companyId=&type=inventory|network|contractors
 * CSV export for containers reports hub.
 */
export async function GET(request: NextRequest) {
  try {
    const companyId = Number(request.nextUrl.searchParams.get('companyId'));
    const type = String(
      request.nextUrl.searchParams.get('type') || 'inventory'
    ).toLowerCase();

    if (!Number.isFinite(companyId) || companyId <= 0) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }

    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request),
    });
    if (!gate.ok) return gate.response;

    const supabase = getSupabaseServer();
    const stamp = new Date().toISOString().slice(0, 10);

    if (type === 'network' || type === 'outlets') {
      const { data, error } = await supabase
        .from('containers')
        .select(
          'id, name, container_code, status, city, province, country, latitude, longitude, contractor_id, assigned_contractor, created_at'
        )
        .eq('profile_id', companyId)
        .order('name', { ascending: true })
        .limit(2000);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      const header = [
        'id',
        'name',
        'code',
        'status',
        'city',
        'province',
        'country',
        'latitude',
        'longitude',
        'contractor_id',
        'assigned_contractor',
        'created_at',
      ];
      const rows = (data || []).map((c) =>
        [
          c.id,
          c.name,
          c.container_code,
          c.status,
          c.city,
          c.province,
          c.country,
          c.latitude,
          c.longitude,
          c.contractor_id,
          c.assigned_contractor,
          c.created_at,
        ]
          .map(csvCell)
          .join(',')
      );
      return csvResponse(
        [header.join(','), ...rows].join('\n'),
        `containers-network-${stamp}.csv`
      );
    }

    if (type === 'contractors') {
      const { data, error } = await supabase
        .from('container_contractors')
        .select(
          'id, full_name, email, phone, verification_status, training_status, created_at'
        )
        .eq('profile_id', companyId)
        .order('full_name', { ascending: true })
        .limit(2000);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      const header = [
        'id',
        'full_name',
        'email',
        'phone',
        'verification_status',
        'training_status',
        'created_at',
      ];
      const rows = (data || []).map((c) =>
        [
          c.id,
          c.full_name,
          c.email,
          c.phone,
          c.verification_status,
          c.training_status,
          c.created_at,
        ]
          .map(csvCell)
          .join(',')
      );
      return csvResponse(
        [header.join(','), ...rows].join('\n'),
        `containers-contractors-${stamp}.csv`
      );
    }

    // Default: inventory & stock across outlets
    const { data: inv, error: invErr } = await supabase
      .from('container_inventory')
      .select(
        'id, container_id, product_name, sku, product_id, qty_on_hand, unit, reorder_level, unit_cost, last_received_at, updated_at'
      )
      .eq('profile_id', companyId)
      .order('container_id', { ascending: true })
      .limit(5000);

    if (invErr) {
      if (/relation|does not exist/i.test(invErr.message)) {
        return NextResponse.json(
          {
            error: invErr.message,
            hint: 'Run container inventory migrations',
          },
          { status: 503 }
        );
      }
      return NextResponse.json({ error: invErr.message }, { status: 500 });
    }

    const containerIds = [
      ...new Set(
        (inv || [])
          .map((r) => Number(r.container_id))
          .filter((n) => Number.isFinite(n) && n > 0)
      ),
    ];
    const nameMap: Record<number, string> = {};
    if (containerIds.length) {
      const { data: containers } = await supabase
        .from('containers')
        .select('id, name, container_code')
        .eq('profile_id', companyId)
        .in('id', containerIds);
      for (const c of containers || []) {
        nameMap[Number(c.id)] =
          `${c.name || 'Outlet'}${c.container_code ? ` (${c.container_code})` : ''}`;
      }
    }

    const header = [
      'container_id',
      'container_name',
      'product_name',
      'sku',
      'product_id',
      'qty_on_hand',
      'unit',
      'reorder_level',
      'unit_cost',
      'last_received_at',
      'updated_at',
    ];
    const rows = (inv || []).map((r) => {
      const cid = Number(r.container_id);
      return [
        r.container_id,
        nameMap[cid] || '',
        r.product_name,
        r.sku,
        r.product_id,
        r.qty_on_hand,
        r.unit,
        r.reorder_level,
        r.unit_cost,
        r.last_received_at,
        r.updated_at,
      ]
        .map(csvCell)
        .join(',');
    });

    return csvResponse(
      [header.join(','), ...rows].join('\n'),
      `containers-inventory-${stamp}.csv`
    );
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}

function csvCell(v: unknown): string {
  if (v == null) return '';
  const s = String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function csvResponse(body: string, filename: string) {
  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}
