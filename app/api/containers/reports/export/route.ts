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

    // Monthly performance — reseller sales + container sales rollup
    if (type === 'performance' || type === 'monthly' || type === 'sales') {
      const months = Math.min(
        24,
        Math.max(1, Number(request.nextUrl.searchParams.get('months') || 12))
      );
      const from = new Date();
      from.setMonth(from.getMonth() - months);
      const fromIso = from.toISOString().slice(0, 10);

      const [resellerSales, containerSales, containers] = await Promise.all([
        supabase
          .from('reseller_sales')
          .select(
            'id, container_id, reseller_id, sale_date, total_amount, commission_amount, sale_number, created_at'
          )
          .eq('profile_id', companyId)
          .gte('sale_date', fromIso)
          .limit(10000),
        supabase
          .from('container_sales')
          .select(
            'id, container_id, sale_date, gross_amount, net_amount, created_at'
          )
          .eq('profile_id', companyId)
          .gte('sale_date', fromIso)
          .limit(10000),
        supabase
          .from('containers')
          .select('id, name, container_code')
          .eq('profile_id', companyId)
          .limit(2000),
      ]);

      const nameMap: Record<number, string> = {};
      for (const c of containers.data || []) {
        nameMap[Number(c.id)] =
          `${c.name || 'Outlet'}${c.container_code ? ` (${c.container_code})` : ''}`;
      }

      type Agg = {
        container_id: number;
        month: string;
        reseller_gross: number;
        reseller_commission: number;
        reseller_txns: number;
        container_gross: number;
        container_net: number;
        container_txns: number;
      };
      const map = new Map<string, Agg>();

      const keyOf = (cid: number, dateStr: string) => {
        const m = String(dateStr || '').slice(0, 7) || 'unknown';
        return `${cid}|${m}`;
      };

      for (const r of resellerSales.data || []) {
        const cid = Number(r.container_id) || 0;
        const k = keyOf(cid, String(r.sale_date || r.created_at || ''));
        const row = map.get(k) || {
          container_id: cid,
          month: k.split('|')[1],
          reseller_gross: 0,
          reseller_commission: 0,
          reseller_txns: 0,
          container_gross: 0,
          container_net: 0,
          container_txns: 0,
        };
        row.reseller_gross += Number(r.total_amount || 0);
        row.reseller_commission += Number(r.commission_amount || 0);
        row.reseller_txns += 1;
        map.set(k, row);
      }

      for (const r of containerSales.data || []) {
        const cid = Number(r.container_id) || 0;
        const k = keyOf(cid, String(r.sale_date || r.created_at || ''));
        const row = map.get(k) || {
          container_id: cid,
          month: k.split('|')[1],
          reseller_gross: 0,
          reseller_commission: 0,
          reseller_txns: 0,
          container_gross: 0,
          container_net: 0,
          container_txns: 0,
        };
        row.container_gross += Number(r.gross_amount || 0);
        row.container_net += Number(r.net_amount || r.gross_amount || 0);
        row.container_txns += 1;
        map.set(k, row);
      }

      const header = [
        'month',
        'container_id',
        'container_name',
        'reseller_gross',
        'reseller_commission',
        'reseller_txns',
        'container_gross',
        'container_net',
        'container_txns',
        'combined_gross',
      ];
      const rows = [...map.values()]
        .sort((a, b) =>
          a.month === b.month
            ? a.container_id - b.container_id
            : a.month < b.month
              ? 1
              : -1
        )
        .map((r) =>
          [
            r.month,
            r.container_id,
            nameMap[r.container_id] || '',
            Math.round(r.reseller_gross * 100) / 100,
            Math.round(r.reseller_commission * 100) / 100,
            r.reseller_txns,
            Math.round(r.container_gross * 100) / 100,
            Math.round(r.container_net * 100) / 100,
            r.container_txns,
            Math.round((r.reseller_gross + r.container_gross) * 100) / 100,
          ]
            .map(csvCell)
            .join(',')
        );

      const note =
        resellerSales.error || containerSales.error
          ? `# warnings: ${[resellerSales.error?.message, containerSales.error?.message].filter(Boolean).join('; ')}\n`
          : '';

      return csvResponse(
        note + [header.join(','), ...rows].join('\n'),
        `containers-performance-${months}m-${stamp}.csv`
      );
    }

    if (type === 'network' || type === 'outlets' || type === 'regional') {
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

      if (type === 'regional') {
        // Roll up outlet counts by province/country
        type Reg = {
          country: string;
          province: string;
          outlets: number;
          active: number;
          staffed: number;
        };
        const reg = new Map<string, Reg>();
        for (const c of data || []) {
          const country = String(c.country || 'Unknown');
          const province = String(c.province || c.city || 'Unknown');
          const k = `${country}|${province}`;
          const row = reg.get(k) || {
            country,
            province,
            outlets: 0,
            active: 0,
            staffed: 0,
          };
          row.outlets += 1;
          if (
            !c.status ||
            ['active', 'deployed', 'operational', 'open'].includes(
              String(c.status).toLowerCase()
            )
          ) {
            row.active += 1;
          }
          if (c.contractor_id || c.assigned_contractor) row.staffed += 1;
          reg.set(k, row);
        }
        const header = [
          'country',
          'province',
          'outlets',
          'active',
          'staffed',
          'staffed_pct',
        ];
        const rows = [...reg.values()]
          .sort((a, b) => b.outlets - a.outlets)
          .map((r) =>
            [
              r.country,
              r.province,
              r.outlets,
              r.active,
              r.staffed,
              r.outlets
                ? Math.round((r.staffed / r.outlets) * 1000) / 10
                : 0,
            ]
              .map(csvCell)
              .join(',')
          );
        return csvResponse(
          [header.join(','), ...rows].join('\n'),
          `containers-regional-${stamp}.csv`
        );
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
