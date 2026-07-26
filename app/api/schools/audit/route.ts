import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  requireCompanyAccess,
  legacyPrivyFrom,
} from '@/lib/auth/api-auth';
import { getOrCreateSchoolProfile } from '@/lib/schools/school-context';
import { hashPayload, publicToken } from '@/lib/schools/audit-hash';
import { resolveCatalogueContext } from '@/lib/schools/approved-catalogue';

/**
 * W5 audit pack with content hash (+ optional public transparency token).
 */
export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    // Public token path
    const token = sp.get('token');
    if (token) {
      const supabase = getSupabaseServer();
      const { data, error } = await supabase
        .from('nsnp_audit_packs')
        .select(
          'id, period_from, period_to, content_hash, pack_json, is_public, created_at, school_profile_id'
        )
        .eq('public_token', token)
        .eq('is_public', true)
        .maybeSingle();
      if (error || !data) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
      }
      return NextResponse.json({
        success: true,
        public: true,
        pack: data,
      });
    }

    const companyId = Number(sp.get('companyId'));
    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }
    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request),
    });
    if (!gate.ok) return gate.response;

    const supabase = getSupabaseServer();
    const { school, error } = await getOrCreateSchoolProfile(supabase, companyId);
    if (error || !school) {
      return NextResponse.json({ error: error || 'No school' }, { status: 503 });
    }

    const { data: packs } = await supabase
      .from('nsnp_audit_packs')
      .select(
        'id, period_from, period_to, content_hash, is_public, public_token, created_at'
      )
      .eq('school_profile_id', school.id)
      .order('created_at', { ascending: false })
      .limit(20);

    return NextResponse.json({
      success: true,
      packs: packs || [],
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const companyId = Number(body.companyId);
    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }
    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request),
    });
    if (!gate.ok) return gate.response;

    const to = body.to || new Date().toISOString().slice(0, 10);
    const fromDefault = new Date();
    fromDefault.setMonth(fromDefault.getMonth() - 1);
    const from = body.from || fromDefault.toISOString().slice(0, 10);

    const supabase = getSupabaseServer();
    const { school, error } = await getOrCreateSchoolProfile(supabase, companyId);
    if (error || !school) {
      return NextResponse.json({ error: error || 'No school' }, { status: 503 });
    }
    const schoolId = Number(school.id);
    const catalogue = await resolveCatalogueContext(supabase, companyId, {
      schoolProfileId: schoolId,
    });

    const [feeding, receipts, orders, visits, attendance] = await Promise.all([
      supabase
        .from('school_feeding_days')
        .select(
          'feed_date, meal_type, planned_meals, served_meals, waste_meals, learners_present, nutrition_pass'
        )
        .eq('school_profile_id', schoolId)
        .gte('feed_date', from)
        .lte('feed_date', to)
        .limit(500),
      supabase
        .from('school_kitchen_receipts')
        .select(
          'receipt_number, received_at, compliance_ok, isp_profile_id, lines'
        )
        .eq('school_profile_id', schoolId)
        .gte('received_at', from)
        .lte('received_at', to)
        .limit(500),
      supabase
        .from('school_purchase_orders')
        .select('po_number, order_date, total_amount, status, compliance_ok')
        .eq('school_profile_id', schoolId)
        .gte('order_date', from)
        .lte('order_date', to)
        .limit(500),
      supabase
        .from('nsnp_peu_visits')
        .select(
          'visit_date, overall_score, hygiene_score, visitor_name, notes'
        )
        .eq('school_profile_id', schoolId)
        .gte('visit_date', from)
        .lte('visit_date', to)
        .limit(100),
      supabase
        .from('school_attendance_days')
        .select('attendance_date, present, enrolled')
        .eq('school_profile_id', schoolId)
        .gte('attendance_date', from)
        .lte('attendance_date', to)
        .limit(500),
    ]);

    const pack_json = {
      version: 1,
      generated_at: new Date().toISOString(),
      school: {
        id: schoolId,
        name: school.school_name,
        emis: school.emis_number,
        province: school.province,
        district: school.district,
        member_type: school.member_type || 'school',
      },
      catalogue: {
        agency: catalogue.agencyName,
        agency_profile_id: catalogue.agencyProfileId,
      },
      period: { from, to },
      feeding: feeding.data || [],
      receipts: (receipts.data || []).map((r) => ({
        ...r,
        // strip heavy line detail from public packs if needed
        line_count: Array.isArray(r.lines) ? r.lines.length : 0,
        lines: body.includeLines ? r.lines : undefined,
      })),
      orders: orders.data || [],
      visits: visits.data || [],
      attendance: attendance.data || [],
      totals: {
        meals_served: (feeding.data || []).reduce(
          (n, f) => n + Number(f.served_meals || 0),
          0
        ),
        po_spend: (orders.data || []).reduce(
          (n, o) => n + Number(o.total_amount || 0),
          0
        ),
        visits: (visits.data || []).length,
      },
    };

    const content_hash = await hashPayload(pack_json);
    const isPublic = Boolean(body.is_public);
    const token = isPublic ? publicToken() : null;

    const { data, error: iErr } = await supabase
      .from('nsnp_audit_packs')
      .insert({
        school_profile_id: schoolId,
        agency_profile_id: catalogue.agencyProfileId,
        profile_id: companyId,
        period_from: from,
        period_to: to,
        content_hash,
        pack_json,
        public_token: token,
        is_public: isPublic,
        created_by: gate.userId || null,
      })
      .select(
        'id, period_from, period_to, content_hash, is_public, public_token, created_at'
      )
      .single();

    if (iErr) {
      return NextResponse.json({ error: iErr.message }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      pack: data,
      content_hash,
      public_url: token ? `/nsnp/transparency/${token}` : null,
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
