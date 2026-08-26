/**
 * Dual-write service-module staff (coaches, clinicians, practitioners)
 * into the People / HR employees directory.
 *
 * Match order: existing hr_employee_id → email → metadata service key.
 * Does not require a business unit (service staff often lack one at create).
 */
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  defaultOnboardingChecklist,
  fullNameFromParts,
} from '@/lib/hr/types';
import { resolveWorkforceEmployment } from '@/lib/core-os/people';

export type ServicePersonSource =
  | 'fitgraph_coach'
  | 'dentalgraph_staff'
  | 'physiograph_practitioner'
  | 'medicalgraph_practitioner'
  | 'vetgraph_practitioner'
  | 'psychiatrygraph_practitioner'
  | 'fieldgraph_gang'
  | 'quarrygraph_crew';

export type ServicePersonSyncInput = {
  companyId: number;
  source: ServicePersonSource;
  /** Module-local id (cli/coh/stf/prac_…) */
  personId: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  id_number?: string | null;
  jobTitle?: string | null;
  department?: string | null;
  /** permanent | temporary | contractor | gang | full_time… */
  employment_type?: string | null;
  /** When false, mark employee inactive / terminated soft */
  active?: boolean;
  start_date?: string | null;
  end_date?: string | null;
  /** Optional hourly / session rate → hourly_rate when number */
  rate_zar?: number | null;
  photo_url?: string | null;
  /** Already linked employee row */
  hr_employee_id?: number | null;
  code?: string | null;
};

export type ServicePersonSyncResult = {
  employeeId: number | null;
  created: boolean;
  updated: boolean;
  error?: string;
};

function splitName(full: string): { first_name: string; last_name: string } {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first_name: '', last_name: '' };
  if (parts.length === 1) return { first_name: parts[0], last_name: '' };
  return {
    first_name: parts[0],
    last_name: parts.slice(1).join(' '),
  };
}

function sourceLabel(source: ServicePersonSource): string {
  switch (source) {
    case 'fitgraph_coach':
      return 'GymAdvisor coach';
    case 'dentalgraph_staff':
      return 'DentalAdvisor staff';
    case 'physiograph_practitioner':
      return 'PhysioAdvisor practitioner';
    case 'medicalgraph_practitioner':
      return 'MedicalAdvisor practitioner';
    case 'vetgraph_practitioner':
      return 'VetAdvisor veterinarian';
    case 'psychiatrygraph_practitioner':
      return 'PsychiatryAdvisor practitioner';
    case 'fieldgraph_gang':
      return 'CropAdvisor gang / crew';
    case 'quarrygraph_crew':
      return 'QuarryAdvisor crew';
    default:
      return 'Service staff';
  }
}

function departmentDefault(source: ServicePersonSource): string {
  switch (source) {
    case 'fitgraph_coach':
      return 'Fitness';
    case 'dentalgraph_staff':
      return 'Dental';
    case 'physiograph_practitioner':
      return 'Physiotherapy';
    case 'medicalgraph_practitioner':
      return 'Medical';
    case 'vetgraph_practitioner':
      return 'Veterinary';
    case 'psychiatrygraph_practitioner':
      return 'Psychiatry';
    case 'fieldgraph_gang':
      return 'Crop / field labour';
    case 'quarrygraph_crew':
      return 'Quarry labour';
    default:
      return 'Services';
  }
}

function jobTitleDefault(
  source: ServicePersonSource,
  explicit?: string | null
): string {
  if (explicit && String(explicit).trim()) return String(explicit).trim();
  switch (source) {
    case 'fitgraph_coach':
      return 'Coach';
    case 'dentalgraph_staff':
      return 'Dental clinician';
    case 'physiograph_practitioner':
      return 'Physiotherapist';
    case 'medicalgraph_practitioner':
      return 'Medical practitioner';
    case 'vetgraph_practitioner':
      return 'Veterinarian';
    case 'psychiatrygraph_practitioner':
      return 'Psychiatrist / psychologist';
    case 'fieldgraph_gang':
      return 'Field gang / crew';
    case 'quarrygraph_crew':
      return 'Quarry crew';
    default:
      return 'Staff';
  }
}

/**
 * Permanent staff land as full/part time. Advisor coaches/clinicians
 * without a type land as contractors. Gangs/crews stay operational-only.
 */
function resolvePeopleEmploymentType(
  source: ServicePersonSource,
  raw?: string | null
): 'full_time' | 'part_time' | 'contract' | null {
  return resolveWorkforceEmployment(source, raw);
}

/**
 * Upsert a People employee for a coach / staff / practitioner record.
 * Best-effort — never throws to callers; returns error string on failure.
 */
/**
 * After a coach/staff/practitioner upsert on a service store, dual-write to People.
 * Mutates the person row with hr_employee_id when successful.
 */
export async function syncStoreStaffPersonToHr(opts: {
  companyId: number;
  source: ServicePersonSource;
  person: {
    id: string;
    code?: string;
    name: string;
    email?: string;
    phone?: string;
    id_number?: string;
    employment_type?: string;
    active?: boolean;
    start_date?: string | null;
    end_date?: string | null;
    rate_zar?: number | null;
    photo_url?: string;
    hr_employee_id?: number | null;
    specialties?: string[];
    roles?: string[];
    disciplines?: string[];
  };
}): Promise<ServicePersonSyncResult> {
  const p = opts.person;
  const titleBits =
    p.disciplines?.length
      ? p.disciplines.slice(0, 2).join(', ')
      : p.roles?.length
        ? p.roles.slice(0, 2).join(', ')
        : p.specialties?.length
          ? p.specialties.slice(0, 2).join(', ')
          : null;
  const result = await syncServicePersonToHr({
    companyId: opts.companyId,
    source: opts.source,
    personId: p.id,
    name: p.name,
    email: p.email,
    phone: p.phone,
    id_number: p.id_number,
    jobTitle: titleBits,
    employment_type: p.employment_type,
    active: p.active !== false,
    start_date: p.start_date,
    end_date: p.end_date,
    rate_zar: p.rate_zar,
    photo_url: p.photo_url,
    hr_employee_id: p.hr_employee_id,
    code: p.code,
  });
  if (result.employeeId) {
    p.hr_employee_id = result.employeeId;
  }
  return result;
}

export async function syncServicePersonToHr(
  input: ServicePersonSyncInput
): Promise<ServicePersonSyncResult> {
  try {
    const companyId = Number(input.companyId);
    if (!Number.isFinite(companyId) || companyId <= 0) {
      return { employeeId: null, created: false, updated: false, error: 'Invalid company' };
    }

    const peopleEmployment = resolvePeopleEmploymentType(
      input.source,
      input.employment_type
    );
    if (!peopleEmployment) {
      return {
        employeeId: null,
        created: false,
        updated: false,
        error:
          'Crop / quarry gangs stay in the operational book unless marked as staff or contractor',
      };
    }

    const full_name = fullNameFromParts({ full_name: input.name });
    if (!full_name || full_name === 'Unnamed employee') {
      return {
        employeeId: null,
        created: false,
        updated: false,
        error: 'Name required',
      };
    }

    const supabase = getSupabaseServer();
    const now = new Date().toISOString();
    const email = input.email
      ? String(input.email).toLowerCase().trim()
      : null;
    const serviceKey = `${input.source}:${input.personId}`;
    const { first_name, last_name } = splitName(full_name);
    const active = input.active !== false;
    const status = active
      ? 'active'
      : input.end_date
        ? 'terminated'
        : 'draft';

    let existing: Record<string, unknown> | null = null;

    // 1) Linked id
    if (input.hr_employee_id && Number(input.hr_employee_id) > 0) {
      const { data } = await supabase
        .from('employees')
        .select('*')
        .eq('profile_id', companyId)
        .eq('id', Number(input.hr_employee_id))
        .maybeSingle();
      if (data) existing = data as Record<string, unknown>;
    }

    // 2) Email match
    if (!existing && email) {
      const { data } = await supabase
        .from('employees')
        .select('*')
        .eq('profile_id', companyId)
        .ilike('email', email)
        .limit(1)
        .maybeSingle();
      if (data) existing = data as Record<string, unknown>;
    }

    // 3) Metadata service key (scan limited set)
    if (!existing) {
      const { data: rows } = await supabase
        .from('employees')
        .select('id, metadata, email, full_name')
        .eq('profile_id', companyId)
        .limit(400);
      for (const row of rows || []) {
        const meta =
          row.metadata && typeof row.metadata === 'object'
            ? (row.metadata as Record<string, unknown>)
            : {};
        if (String(meta.service_person_key || '') === serviceKey) {
          existing = row as Record<string, unknown>;
          break;
        }
      }
    }

    const prevMeta =
      existing?.metadata && typeof existing.metadata === 'object'
        ? { ...(existing.metadata as Record<string, unknown>) }
        : {};

    const metadata = {
      ...prevMeta,
      service_person_key: serviceKey,
      service_module: input.source,
      service_person_id: input.personId,
      service_synced_at: now,
      service_source_label: sourceLabel(input.source),
      workforce_kind:
        peopleEmployment === 'contract' ? 'contractor' : 'employee',
    };

    const department =
      input.department ||
      (existing?.department as string) ||
      departmentDefault(input.source);
    const job_title = jobTitleDefault(
      input.source,
      input.jobTitle || (existing?.job_title as string)
    );

    const basePayload: Record<string, unknown> = {
      profile_id: companyId,
      full_name,
      first_name: first_name || null,
      last_name: last_name || null,
      email: email || existing?.email || null,
      work_email: email || existing?.work_email || existing?.email || null,
      phone: input.phone || existing?.phone || null,
      mobile: input.phone || existing?.mobile || null,
      id_number: input.id_number || existing?.id_number || null,
      job_title,
      department,
      employment_type: peopleEmployment,
      status,
      start_date:
        input.start_date || existing?.start_date || now.slice(0, 10),
      end_date:
        input.end_date !== undefined
          ? input.end_date
          : existing?.end_date || null,
      photo_url: input.photo_url || existing?.photo_url || null,
      notes:
        existing?.notes ||
        `Synced from ${sourceLabel(input.source)} (${input.code || input.personId})`,
      metadata,
      updated_at: now,
    };

    if (
      input.rate_zar != null &&
      Number.isFinite(Number(input.rate_zar)) &&
      Number(input.rate_zar) > 0
    ) {
      basePayload.hourly_rate = Number(input.rate_zar);
    }

    if (existing?.id) {
      const id = Number(existing.id);
      const { data, error } = await supabase
        .from('employees')
        .update(basePayload)
        .eq('id', id)
        .eq('profile_id', companyId)
        .select('id')
        .maybeSingle();

      if (error) {
        // Soft update minimal columns
        const { data: d2, error: e2 } = await supabase
          .from('employees')
          .update({
            full_name,
            email: basePayload.email,
            phone: basePayload.phone,
            job_title,
            department,
            status,
            metadata,
            updated_at: now,
          })
          .eq('id', id)
          .select('id')
          .maybeSingle();
        if (e2) {
          return {
            employeeId: id,
            created: false,
            updated: false,
            error: e2.message,
          };
        }
        return {
          employeeId: Number(d2?.id || id),
          created: false,
          updated: true,
        };
      }
      return {
        employeeId: Number(data?.id || id),
        created: false,
        updated: true,
      };
    }

    // Create
    let employee_number = input.code
      ? String(input.code).replace(/\s/g, '').slice(0, 16)
      : '';
    if (!employee_number) {
      const { count } = await supabase
        .from('employees')
        .select('id', { count: 'exact', head: true })
        .eq('profile_id', companyId);
      employee_number = `E${String((count || 0) + 1).padStart(4, '0')}`;
    }

    const insertPayload = {
      ...basePayload,
      employee_number,
      onboarding_status: 'not_started',
      onboarding_checklist: defaultOnboardingChecklist(),
      leave_balance_days: 15,
      sick_balance_days: 10,
      salary_currency: 'ZAR',
      pay_frequency: 'monthly',
      salary_basic: 0,
      created_at: now,
    };

    let { data, error } = await supabase
      .from('employees')
      .insert(insertPayload)
      .select('id')
      .single();

    if (error && /column|schema cache|does not exist/i.test(error.message)) {
      const minimal = {
        profile_id: companyId,
        full_name,
        email: basePayload.email,
        phone: basePayload.phone,
        job_title,
        department,
        employment_type: 'full_time',
        status,
        start_date: basePayload.start_date,
        metadata,
        updated_at: now,
      };
      const retry = await supabase
        .from('employees')
        .insert(minimal)
        .select('id')
        .single();
      data = retry.data;
      error = retry.error;
    }

    if (error || !data?.id) {
      return {
        employeeId: null,
        created: false,
        updated: false,
        error: error?.message || 'Insert failed',
      };
    }

    return {
      employeeId: Number(data.id),
      created: true,
      updated: false,
    };
  } catch (e: unknown) {
    return {
      employeeId: null,
      created: false,
      updated: false,
      error: e instanceof Error ? e.message : 'Sync failed',
    };
  }
}
