import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  requireCompanyAccess,
  legacyPrivyFrom,
} from '@/lib/auth/api-auth';
import { getOrCreateSchoolProfile } from '@/lib/schools/school-context';
import type {
  ProcessRole,
  ReadinessCheck,
  SchoolReadiness,
} from '@/lib/schools/process';

/**
 * Golden-path readiness for principals + role detection for DBE.
 * Powers command hub checklist and process rail.
 */
export async function GET(request: NextRequest) {
  try {
    const companyId = Number(request.nextUrl.searchParams.get('companyId'));
    if (!Number.isFinite(companyId)) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }
    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request),
    });
    if (!gate.ok) return gate.response;

    const supabase = getSupabaseServer();
    const today = new Date().toISOString().slice(0, 10);

    // Role priority: agency → SP → school
    const { data: agencyRow } = await supabase
      .from('nsnp_agency_profiles')
      .select('*')
      .eq('profile_id', companyId)
      .maybeSingle();

    const { data: ispRow } = await supabase
      .from('nsnp_isp_profiles')
      .select('*')
      .eq('profile_id', companyId)
      .maybeSingle();

    if (agencyRow) {
      // handled below as agency
    }

    const role: ProcessRole = agencyRow
      ? 'agency'
      : ispRow
        ? 'isp'
        : 'school';

    // Enforce SchoolAdvisor® public-sector packaging on every hub load
    let packagingSnapshot: {
      updated: boolean;
      compliant: boolean;
      sectorId?: string;
      entityTypeId?: string;
    } | null = null;
    try {
      const { ensureSchoolAdvisorPackagingForCompany } = await import(
        '@/lib/schools/ensure-packaging'
      );
      const ensured = await ensureSchoolAdvisorPackagingForCompany(
        supabase,
        companyId,
        role
      );
      packagingSnapshot = {
        updated: ensured.updated,
        compliant: ensured.compliant,
        sectorId: ensured.packaging?.sectorId,
        entityTypeId: ensured.packaging?.entityTypeId,
      };
    } catch {
      /* soft */
    }

    if (role === 'isp' && ispRow) {
      const { data: dels } = await supabase
        .from('school_nsnp_deliveries')
        .select('id, status')
        .eq('isp_profile_id', companyId)
        .limit(200);
      const list = dels || [];
      const toMove = list.filter((d) =>
        ['draft', 'confirmed', 'dispatched'].includes(String(d.status))
      ).length;
      const awaitingSchool = list.filter((d) =>
        ['dispatched', 'delivered'].includes(String(d.status))
      ).length;
      const { data: openPos } = await supabase
        .from('school_purchase_orders')
        .select('id')
        .eq('isp_profile_id', companyId)
        .in('status', ['submitted', 'confirmed', 'open', 'dispatched'])
        .limit(50);

      return NextResponse.json({
        success: true,
        role: 'isp' as const,
        isp: ispRow,
        packaging: packagingSnapshot,
        summary: {
          openPos: (openPos || []).length,
          deliveriesActive: toMove,
          awaitingSchoolReceive: awaitingSchool,
          compliance: String(ispRow.compliance_status || 'pending'),
        },
        nextAction:
          (openPos || []).length > 0
            ? {
                label: 'Fulfil open school POs',
                href: '/dashboard/schools/deliveries',
                desc: `${(openPos || []).length} open order(s) — create delivery notes, dispatch, attach POD & invoice`,
              }
            : {
                label: 'Open deliveries',
                href: '/dashboard/schools/deliveries',
                desc: 'Track dispatch, POD, invoice and school receipt',
              },
      });
    }

    if (role === 'agency') {
      const { fetchAgencySchoolLinks } = await import(
        '@/lib/schools/supabase-page'
      );
      const links = await fetchAgencySchoolLinks(supabase, companyId, [
        'active',
        'pending',
        'suspended',
      ]);
      const pending = links.filter((l) => l.status === 'pending').length;
      const active = links.filter((l) => l.status === 'active').length;
      const { data: claims } = await supabase
        .from('nsnp_claim_packs')
        .select('id, status')
        .eq('agency_profile_id', companyId)
        .eq('status', 'submitted')
        .limit(100);

      return NextResponse.json({
        success: true,
        role: 'agency' as const,
        agency: agencyRow,
        packaging: packagingSnapshot,
        summary: {
          pendingSchools: pending,
          activeSchools: active,
          submittedClaims: (claims || []).length,
        },
        nextAction:
          pending > 0
            ? {
                label: 'Approve school requests',
                href: '/dashboard/schools/agency',
                desc: `${pending} school(s) waiting for DBE/PEU approval`,
              }
            : (claims || []).length > 0
              ? {
                  label: 'Review submitted claims',
                  href: '/dashboard/schools/ops',
                  desc: `${(claims || []).length} claim(s) in exception cockpit`,
                }
              : {
                  label: 'Exception cockpit',
                  href: '/dashboard/schools/ops',
                  desc: 'Late deliveries, joins, off-catalogue & programme risks',
                },
      });
    }

    const { school, error } = await getOrCreateSchoolProfile(supabase, companyId);
    if (error || !school) {
      return NextResponse.json({ error: error || 'No school' }, { status: 503 });
    }
    const schoolId = Number(school.id);

    const [
      linksRes,
      learnersRes,
      menuRes,
      ispRes,
      stockRes,
      ordersRes,
      feedRes,
      surveyRes,
      riadRes,
      maintRes,
      complianceRes,
      delivRes,
    ] = await Promise.all([
      supabase
        .from('school_agency_links')
        .select('id, status, agency_profile_id')
        .eq('school_profile_id', schoolId)
        .limit(20),
      supabase
        .from('school_learners')
        .select('id, verification_status, status')
        .eq('school_profile_id', schoolId)
        .eq('status', 'active')
        .limit(5000),
      supabase
        .from('school_menu_cycles')
        .select('id, active, items')
        .eq('school_profile_id', schoolId)
        .eq('active', true)
        .limit(1),
      supabase
        .from('school_isp_links')
        .select('id, status')
        .eq('school_profile_id', schoolId)
        .limit(50),
      supabase
        .from('school_kitchen_stock')
        .select('id, qty_on_hand')
        .eq('school_profile_id', schoolId)
        .limit(300),
      supabase
        .from('school_purchase_orders')
        .select('id, status')
        .eq('school_profile_id', schoolId)
        .in('status', ['draft', 'submitted', 'open', 'confirmed', 'dispatched'])
        .limit(50),
      supabase
        .from('school_feeding_days')
        .select('id, served_meals, learners_present, menu_name, feed_date')
        .eq('school_profile_id', schoolId)
        .eq('feed_date', today)
        .limit(5),
      supabase
        .from('school_food_surveys')
        .select('response_count, avg_rating, active')
        .eq('school_profile_id', schoolId)
        .limit(20),
      supabase
        .from('riad_logs')
        .select('id, status')
        .eq('profile_id', companyId)
        .or('module.eq.schools,module.eq.school,module.eq.nsnp')
        .limit(100),
      supabase
        .from('school_maintenance_items')
        .select('id, status')
        .eq('school_profile_id', schoolId)
        .limit(100),
      supabase
        .from('school_compliance_events')
        .select('id, status')
        .eq('school_profile_id', schoolId)
        .limit(100),
      supabase
        .from('school_nsnp_deliveries')
        .select('id, status')
        .eq('school_profile_id', schoolId)
        .in('status', ['dispatched', 'delivered', 'confirmed'])
        .limit(50),
    ]);

    const links = linksRes.data || [];
    const agencyActive = links.some((l) => l.status === 'active');
    const agencyAny = links.length > 0;
    const learners = learnersRes.data || [];
    const verified = learners.filter((l) =>
      ['school_verified', 'attested'].includes(String(l.verification_status))
    ).length;
    const verifiedPct =
      learners.length > 0
        ? Math.round((verified / learners.length) * 1000) / 10
        : 0;
    const hasMenu = (menuRes.data || []).length > 0;
    const ispLinks = (ispRes.data || []).filter(
      (l) => !['left', 'rejected'].includes(String(l.status || ''))
    ).length;
    const stock = stockRes.data || [];
    const stockLines = stock.length;
    const stockPositive = stock.filter((s) => Number(s.qty_on_hand) > 0).length;
    const openOrders = (ordersRes.data || []).length;
    const todayFeed = (feedRes.data || [])[0] || null;
    const serveComplete = Boolean(
      todayFeed && Number(todayFeed.served_meals || 0) > 0
    );
    const surveys = surveyRes.data || [];
    const surveyResponses = surveys.reduce(
      (n, s) => n + (Number(s.response_count) || 0),
      0
    );
    const rated = surveys
      .map((s) => Number(s.avg_rating))
      .filter((n) => Number.isFinite(n) && n > 0);
    const surveyAvg =
      rated.length > 0
        ? Math.round(
            (rated.reduce((a, b) => a + b, 0) / rated.length) * 100
          ) / 100
        : null;

    const openRiad = (riadRes.data || []).filter(
      (r) =>
        !['closed', 'resolved', 'done', 'cancelled'].includes(
          String(r.status || '').toLowerCase()
        )
    ).length;
    const openMaint = (maintRes.data || []).filter(
      (m) => !['done', 'cancelled'].includes(String(m.status || ''))
    ).length;
    const openCompliance = (complianceRes.data || []).filter(
      (c) => !['closed', 'resolved', 'done'].includes(String(c.status || ''))
    ).length;
    const deliveriesAwaiting = (delivRes.data || []).length;

    const hasPhoto = Boolean(school.photo_url);
    const hasEmis = Boolean(school.emis_number);
    const hasPrincipal = Boolean(school.principal_name);

    const checks: ReadinessCheck[] = [
      {
        id: 'profile',
        label: 'School profile & EMIS number',
        done: hasEmis && hasPrincipal,
        required: true,
        href: '/dashboard/schools/profile',
        hint: 'Add principal + EMIS',
        weight: 15,
      },
      {
        id: 'photo',
        label: 'School photo',
        done: hasPhoto,
        required: false,
        href: '/dashboard/schools/profile',
        hint: 'Builds pride on surveys',
        weight: 5,
      },
      {
        id: 'agency',
        label: 'DBE/PEU association approved',
        done: agencyActive,
        required: true,
        href: '/dashboard/schools/agency',
        hint: agencyAny
          ? 'Waiting for agency approval'
          : 'Request to join your PEU/DBE',
        weight: 20,
      },
      {
        id: 'learners',
        label: 'Learner register imported',
        done: learners.length > 0,
        required: true,
        href: '/dashboard/schools/learners',
        hint: 'CSV import or add learners',
        weight: 15,
      },
      {
        id: 'verify',
        label: '≥50% learners verified',
        done: verifiedPct >= 50,
        required: false,
        href: '/dashboard/schools/learners',
        hint: `${verifiedPct}% verified`,
        weight: 10,
      },
      {
        id: 'menu',
        label: 'Active weekly menu',
        done: hasMenu,
        required: true,
        href: '/dashboard/schools/menu',
        weight: 10,
      },
      {
        id: 'isp',
        label: 'At least one SP linked',
        done: ispLinks > 0,
        required: true,
        href: '/dashboard/schools/isps',
        weight: 10,
      },
      {
        id: 'stock',
        label: 'Kitchen stock on hand',
        done: stockPositive > 0,
        required: false,
        href: '/dashboard/schools/kitchen',
        hint: 'Receive GRN from approved list',
        weight: 10,
      },
      {
        id: 'serve',
        label: "Today's serve day logged",
        done: serveComplete,
        required: false,
        href: '/dashboard/schools/serve-day',
        weight: 5,
      },
      {
        id: 'packaging',
        label: 'Public Sector · SchoolAdvisor packaging',
        done: packagingSnapshot?.compliant === true,
        required: true,
        href: '/dashboard/my-business/modules',
        hint: packagingSnapshot?.compliant
          ? `Sector ${packagingSnapshot.sectorId || 'public_sector'}`
          : 'Auto-applied on this load if missing — refresh if still open',
        weight: 10,
      },
    ];

    const totalW = checks.reduce((n, c) => n + c.weight, 0);
    const doneW = checks
      .filter((c) => c.done)
      .reduce((n, c) => n + c.weight, 0);
    const score = totalW > 0 ? Math.round((doneW / totalW) * 100) : 0;

    const readyForServeDay =
      hasEmis && (learners.length > 0 || Number(school.learner_count_enrolled) > 0);
    const readyForClaims =
      agencyActive && serveComplete === false
        ? agencyActive && learners.length > 0
        : agencyActive && learners.length > 0;

    const firstTodo = checks.find((c) => c.required && !c.done) ||
      checks.find((c) => !c.done);

    // Menu dish today (needed for next-action copy)
    let menuDish: string | null = null;
    const menu = (menuRes.data || [])[0];
    if (menu && Array.isArray(menu.items)) {
      const dayOfWeek = new Date(today + 'T12:00:00').getDay();
      const menuDay = dayOfWeek === 0 ? 7 : dayOfWeek;
      const dish = (
        menu.items as Array<{
          day?: number;
          meal_type?: string;
          dish?: string;
        }>
      ).find(
        (it) =>
          Number(it.day) === menuDay &&
          String(it.meal_type || 'lunch') === 'lunch'
      );
      menuDish = dish?.dish || null;
    }

    // Operational priority: unblock food first, then feed kids, then fund
    const nextAction =
      deliveriesAwaiting > 0
        ? {
            label: `Receive ${deliveriesAwaiting} delivery${
              deliveriesAwaiting === 1 ? '' : 'ies'
            }`,
            href: '/dashboard/schools/deliveries',
            desc: 'One-tap confirm POD → kitchen GRN so stock is ready for serve day',
          }
        : !agencyActive
          ? {
              label: agencyAny
                ? 'Wait for DBE approval'
                : 'Join your DBE / PEU',
              href: '/dashboard/schools/agency',
              desc: agencyAny
                ? 'Claims and full catalogue unlock after department approval'
                : 'Link your school so approved foods and funding work',
            }
          : ispLinks === 0
            ? {
                label: 'Link a service provider',
                href: '/dashboard/schools/isps',
                desc: 'Accept an SP claim or link a preferred on-catalogue supplier',
              }
            : !serveComplete
              ? {
                  label: readyForServeDay
                    ? 'Log today’s serve day'
                    : 'Finish setup first',
                  href: readyForServeDay
                    ? '/dashboard/schools/serve-day'
                    : firstTodo?.href || '/dashboard/schools/profile',
                  desc: readyForServeDay
                    ? menuDish
                      ? `Menu today: ${menuDish} — present → meals → waste`
                      : 'Present → meals served → waste (2 minutes)'
                    : firstTodo?.hint ||
                      firstTodo?.label ||
                      'Complete setup',
                }
              : openOrders === 0 && stockPositive === 0
                ? {
                    label: 'Place catalogue order',
                    href: '/dashboard/schools/orders',
                    desc: 'Order only approved foods from your preferred SP before stock runs out',
                  }
                : readyForClaims && agencyActive
                  ? {
                      label: 'Submit claim pack',
                      href: '/dashboard/schools/claims',
                      desc: 'Feeding logged — package funding for DBE approval',
                    }
                  : firstTodo
                    ? {
                        label: firstTodo.label,
                        href: firstTodo.href,
                        desc:
                          firstTodo.hint || 'Complete your NSNP golden path',
                      }
                    : {
                        label: 'Share food survey',
                        href: '/dashboard/schools/surveys',
                        desc: 'Collect learner & parent feedback',
                      };

    const readiness: SchoolReadiness = {
      role: 'school',
      score,
      readyForServeDay,
      readyForClaims: readyForClaims && agencyActive,
      checks,
      nextAction,
      today: {
        serveComplete,
        present: todayFeed
          ? Number(todayFeed.learners_present || 0)
          : null,
        served: todayFeed ? Number(todayFeed.served_meals || 0) : null,
        menuDish,
      },
      kpis: {
        learners: learners.length,
        verifiedPct,
        agencyLinked: agencyAny,
        agencyActive,
        hasMenu,
        ispLinks,
        stockLines,
        openOrders,
        surveyResponses,
        surveyAvg,
        openRiad,
        openMaint,
        openCompliance,
        deliveriesAwaiting,
      },
    };

    return NextResponse.json({
      success: true,
      school: {
        id: school.id,
        school_name: school.school_name,
        emis_number: school.emis_number,
        province: school.province,
        district: school.district,
        photo_url: school.photo_url,
        motto: school.motto,
      },
      readiness,
      packaging: packagingSnapshot,
      role: 'school' as const,
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
