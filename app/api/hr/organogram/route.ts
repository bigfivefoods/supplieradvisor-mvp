import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { requireCompanyAccess, legacyPrivyFrom } from '@/lib/auth/api-auth';

const HINT = 'Run supabase/migrations/20260723_hr_people_module.sql';

export type OrgPerson = {
  id: number;
  full_name: string;
  job_title?: string | null;
  department?: string | null;
  status?: string | null;
  manager_id?: number | null;
  business_unit_id?: number | null;
  work_center_id?: number | null;
  work_station_id?: number | null;
  asset_id?: number | null;
  employee_number?: string | null;
  last_performance_rating?: string | null;
  last_performance_score?: number | null;
  disciplinary_status?: string | null;
  children: OrgPerson[];
};

/**
 * GET organogram: business units with nested people (by manager_id reporting lines).
 * Everyone should appear under a BU; unallocated listed separately.
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

    const { data: employees, error: eErr } = await supabase
      .from('employees')
      .select(
        'id, full_name, job_title, department, status, manager_id, business_unit_id, work_center_id, work_station_id, asset_id, employee_number, last_performance_rating, last_performance_score, disciplinary_status, email'
      )
      .eq('profile_id', companyId)
      .order('full_name')
      .limit(2000);

    if (eErr) {
      return NextResponse.json({
        success: true,
        businessUnits: [],
        unallocated: [],
        people: [],
        warning: eErr.message,
        hint: HINT,
      });
    }

    const people = (employees || []).filter(
      (e) => !['terminated', 'draft'].includes(String(e.status || ''))
    );

    const { data: bus } = await supabase
      .from('manufacturing_business_units')
      .select('id, code, name, parent_id, status')
      .eq('profile_id', companyId)
      .order('code');

    const { data: wcs } = await supabase
      .from('manufacturing_work_centers')
      .select('id, code, name, business_unit_id')
      .eq('profile_id', companyId)
      .order('code');

    const buList = bus || [];
    const wcList = wcs || [];

    function buildTree(
      list: typeof people,
      parentId: number | null
    ): OrgPerson[] {
      const roots = list.filter((e) => {
        const mid = e.manager_id != null ? Number(e.manager_id) : null;
        if (parentId == null) {
          // root: no manager, or manager not in this list
          if (mid == null) return true;
          return !list.some((x) => Number(x.id) === mid);
        }
        return mid === parentId;
      });
      return roots.map((e) => ({
        id: Number(e.id),
        full_name: e.full_name,
        job_title: e.job_title,
        department: e.department,
        status: e.status,
        manager_id: e.manager_id != null ? Number(e.manager_id) : null,
        business_unit_id:
          e.business_unit_id != null ? Number(e.business_unit_id) : null,
        work_center_id:
          e.work_center_id != null ? Number(e.work_center_id) : null,
        work_station_id:
          e.work_station_id != null ? Number(e.work_station_id) : null,
        asset_id: e.asset_id != null ? Number(e.asset_id) : null,
        employee_number: e.employee_number,
        last_performance_rating: e.last_performance_rating,
        last_performance_score:
          e.last_performance_score != null
            ? Number(e.last_performance_score)
            : null,
        disciplinary_status: e.disciplinary_status,
        children: buildTree(list, Number(e.id)),
      }));
    }

    const unallocated = people.filter((e) => !e.business_unit_id);
    const allocated = people.filter((e) => e.business_unit_id);

    type BuNode = {
      id: number;
      code?: string | null;
      name: string;
      parent_id?: number | null;
      headcount: number;
      unallocatedInBu: number;
      workCenters: Array<{
        id: number;
        code?: string | null;
        name: string;
        headcount: number;
        people: OrgPerson[];
      }>;
      tree: OrgPerson[];
      peopleFlat: typeof people;
    };

    const businessUnits: BuNode[] = buList.map((b) => {
      const buId = Number(b.id);
      const inBu = allocated.filter((e) => Number(e.business_unit_id) === buId);
      const wcsForBu = wcList
        .filter((w) => Number(w.business_unit_id) === buId)
        .map((w) => {
          const inWc = inBu.filter(
            (e) => Number(e.work_center_id) === Number(w.id)
          );
          return {
            id: Number(w.id),
            code: w.code,
            name: w.name,
            headcount: inWc.length,
            people: buildTree(inWc, null),
          };
        });
      return {
        id: buId,
        code: b.code,
        name: b.name,
        parent_id: b.parent_id != null ? Number(b.parent_id) : null,
        headcount: inBu.length,
        unallocatedInBu: inBu.filter((e) => !e.work_center_id).length,
        workCenters: wcsForBu,
        tree: buildTree(inBu, null),
        peopleFlat: inBu,
      };
    });

    // People in a BU id that no longer exists in mfg BUs
    const knownBuIds = new Set(buList.map((b) => Number(b.id)));
    const orphanBuPeople = allocated.filter(
      (e) => !knownBuIds.has(Number(e.business_unit_id))
    );

    const stats = {
      totalPeople: people.length,
      allocated: allocated.length,
      unallocated: unallocated.length,
      businessUnits: buList.length,
      withManager: people.filter((e) => e.manager_id).length,
      withoutManager: people.filter((e) => !e.manager_id).length,
      openDisciplinary: people.filter(
        (e) =>
          e.disciplinary_status &&
          e.disciplinary_status !== 'clear' &&
          e.disciplinary_status !== ''
      ).length,
    };

    return NextResponse.json({
      success: true,
      stats,
      businessUnits,
      unallocated: buildTree(unallocated, null),
      unallocatedFlat: unallocated,
      orphanBuPeople,
      allTree: buildTree(people, null),
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
