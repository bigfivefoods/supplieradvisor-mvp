/**
 * School kitchen food safety (R638 / Certificate of Acceptability).
 * Stored on school_profiles.metadata.kitchen_safety (+ self_audits array).
 * Aligns SchoolAdvisor® with SA Regulation R638 legal kitchen requirements.
 */

export const KITCHEN_SAFETY_META_KEY = 'kitchen_safety';
export const KITCHEN_SELF_AUDITS_KEY = 'kitchen_self_audits';
/** Scheduled + completed monthly R638 audits (calendar day linked) */
export const KITCHEN_MONTHLY_AUDITS_KEY = 'kitchen_monthly_audits';
export const KITCHEN_POLICY_META_KEY = 'kitchen_safety_policy';

export type CoaStatus =
  | 'none'
  | 'applied'
  | 'valid'
  | 'expired'
  | 'revoked';

export type SafetyBand = 'green' | 'amber' | 'red' | 'unknown';

export type KitchenType =
  | 'school_kitchen'
  | 'container'
  | 'satellite'
  | 'shared'
  | 'other';

export type R638ItemId =
  | 'structure'
  | 'ventilation'
  | 'handwash'
  | 'pest'
  | 'storage'
  | 'waste'
  | 'staff_hygiene'
  | 'cleaning_schedule';

export type R638Answer = 'yes' | 'no' | 'na';

export type R638Item = {
  id: R638ItemId;
  label: string;
  guidance: string;
};

export const R638_CHECKLIST: R638Item[] = [
  {
    id: 'structure',
    label: 'Structure & finishes washable / sound',
    guidance: 'Floors, walls and work surfaces cleanable; no cracked food-contact surfaces.',
  },
  {
    id: 'ventilation',
    label: 'Ventilation & lighting adequate',
    guidance: 'Cooking area ventilated; lighting sufficient for hygiene control.',
  },
  {
    id: 'handwash',
    label: 'Hand wash facility usable with soap & water',
    guidance: 'Dedicated hand wash basin available to food handlers during service.',
  },
  {
    id: 'pest',
    label: 'Pest control measures in place',
    guidance: 'No open infestations; bait/screening/records as applicable.',
  },
  {
    id: 'storage',
    label: 'Dry & cold storage safe and segregated',
    guidance: 'Food off floor; raw/cooked separation; cold chain working if cold storage claimed.',
  },
  {
    id: 'waste',
    label: 'Waste & drainage controlled',
    guidance: 'Bins covered; waste removed; drains not contaminating prep area.',
  },
  {
    id: 'staff_hygiene',
    label: 'Staff hygiene & illness exclusion understood',
    guidance: 'Handlers know not to work when ill; clean PPE / clothing available.',
  },
  {
    id: 'cleaning_schedule',
    label: 'Cleaning schedule posted / followed',
    guidance: 'Written or posted schedule; evidence of daily cleaning before service.',
  },
];

export type KitchenSafetyPassport = {
  coa_status: CoaStatus;
  coa_number?: string | null;
  coa_municipality?: string | null;
  coa_issued_on?: string | null;
  coa_expires_on?: string | null;
  coa_file_url?: string | null;
  coa_applied_on?: string | null;
  pic_name?: string | null;
  pic_phone?: string | null;
  pic_training_at?: string | null;
  pic_training_file_url?: string | null;
  kitchen_type?: KitchenType | null;
  water_ok?: boolean | null;
  power_ok?: boolean | null;
  cold_storage_ok?: boolean | null;
  r638_score?: number | null;
  r638_band?: SafetyBand | null;
  r638_last_audit_at?: string | null;
  peu_verify_status?: 'none' | 'verified' | 'conditional' | 'noncompliant' | null;
  peu_verify_at?: string | null;
  peu_verify_by?: string | null;
  peu_verify_notes?: string | null;
  principal_attested_at?: string | null;
  updated_at?: string | null;
};

export type KitchenSelfAudit = {
  id: string;
  audited_at: string;
  /** Calendar day this audit was planned for */
  planned_date?: string | null;
  /** Day the checklist was completed */
  completed_date?: string | null;
  items: Record<R638ItemId, R638Answer>;
  score: number;
  band: SafetyBand;
  notes?: string | null;
  by_name?: string | null;
  /** Link to monthly schedule entry */
  monthly_audit_id?: string | null;
};

export type MonthlyAuditStatus = 'planned' | 'done' | 'overdue' | 'cancelled';

/**
 * Monthly R638 audit on the school calendar.
 * One primary entry per month_key; checklist saved onto the planned/done day.
 */
export type KitchenMonthlyAudit = {
  id: string;
  /** YYYY-MM — one schedule slot per calendar month */
  month_key: string;
  /** YYYY-MM-DD — day on the calendar */
  planned_date: string;
  status: MonthlyAuditStatus;
  completed_date?: string | null;
  completed_at?: string | null;
  items?: Partial<Record<R638ItemId, R638Answer>> | null;
  score?: number | null;
  band?: SafetyBand | null;
  notes?: string | null;
  by_name?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type KitchenDailyLog = {
  fridge_temp_ok?: boolean | null;
  fridge_temp_c?: number | null;
  handwash_ok?: boolean | null;
  illness_free?: boolean | null;
  cleaned_ok?: boolean | null;
};

export type KitchenSafetyPolicy = {
  /** soft = banner only; hard = block claim submit */
  claim_gate: 'soft' | 'hard';
  coa_grace_days: number;
  peu_verify_months: number;
  self_audit_max_days: number;
};

export const DEFAULT_KITCHEN_POLICY: KitchenSafetyPolicy = {
  claim_gate: 'soft',
  coa_grace_days: 30,
  peu_verify_months: 12,
  self_audit_max_days: 90,
};

export function emptyKitchenPassport(): KitchenSafetyPassport {
  return {
    coa_status: 'none',
    kitchen_type: 'school_kitchen',
    water_ok: null,
    power_ok: null,
    cold_storage_ok: null,
    r638_band: 'unknown',
    peu_verify_status: 'none',
  };
}

export function readKitchenPassport(
  schoolMeta: Record<string, unknown> | null | undefined
): KitchenSafetyPassport {
  const raw = schoolMeta?.[KITCHEN_SAFETY_META_KEY];
  if (!raw || typeof raw !== 'object') return emptyKitchenPassport();
  const p = raw as Partial<KitchenSafetyPassport>;
  const base = emptyKitchenPassport();
  return {
    ...base,
    ...p,
    coa_status: (p.coa_status as CoaStatus) || 'none',
  };
}

export function readSelfAudits(
  schoolMeta: Record<string, unknown> | null | undefined
): KitchenSelfAudit[] {
  const raw = schoolMeta?.[KITCHEN_SELF_AUDITS_KEY];
  if (!Array.isArray(raw)) return [];
  return raw as KitchenSelfAudit[];
}

export function monthKeyFromDate(iso: string): string {
  return String(iso || '').slice(0, 7);
}

export function todayIsoDate(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

export function readMonthlyAudits(
  schoolMeta: Record<string, unknown> | null | undefined
): KitchenMonthlyAudit[] {
  const raw = schoolMeta?.[KITCHEN_MONTHLY_AUDITS_KEY];
  if (!Array.isArray(raw)) {
    // Back-compat: project completed self-audits into monthly view
    const legacy = readSelfAudits(schoolMeta);
    return legacy.map((a) => {
      const day = String(a.completed_date || a.audited_at || '').slice(0, 10);
      return {
        id: a.monthly_audit_id || a.id,
        month_key: monthKeyFromDate(day || a.audited_at),
        planned_date: String(a.planned_date || day).slice(0, 10),
        status: 'done' as const,
        completed_date: day || null,
        completed_at: a.audited_at,
        items: a.items,
        score: a.score,
        band: a.band,
        notes: a.notes,
        by_name: a.by_name,
      };
    });
  }
  return (raw as KitchenMonthlyAudit[]).map((m) => ({
    ...m,
    month_key: m.month_key || monthKeyFromDate(m.planned_date),
    planned_date: String(m.planned_date || '').slice(0, 10),
    status: (m.status as MonthlyAuditStatus) || 'planned',
  }));
}

/** Mark planned audits past their date as overdue */
export function refreshMonthlyAuditStatuses(
  audits: KitchenMonthlyAudit[],
  today = todayIsoDate()
): KitchenMonthlyAudit[] {
  return audits.map((a) => {
    if (a.status === 'planned' && a.planned_date && a.planned_date < today) {
      return { ...a, status: 'overdue' as const };
    }
    return a;
  });
}

export function monthlyAuditsForMonth(
  audits: KitchenMonthlyAudit[],
  monthKey: string
): KitchenMonthlyAudit[] {
  return audits.filter((a) => a.month_key === monthKey && a.status !== 'cancelled');
}

export function findMonthlyAuditForDate(
  audits: KitchenMonthlyAudit[],
  dateIso: string
): KitchenMonthlyAudit | null {
  const day = String(dateIso).slice(0, 10);
  return (
    audits.find(
      (a) =>
        a.status !== 'cancelled' &&
        (a.planned_date === day || a.completed_date === day)
    ) || null
  );
}

/**
 * Schedule (or reschedule) a monthly audit for a calendar day.
 * Enforces one active entry per month_key.
 */
export function upsertMonthlySchedule(
  audits: KitchenMonthlyAudit[],
  plannedDate: string,
  opts?: { id?: string; notes?: string | null }
): { audits: KitchenMonthlyAudit[]; entry: KitchenMonthlyAudit; error?: string } {
  const day = String(plannedDate).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    return { audits, entry: audits[0], error: 'planned_date must be YYYY-MM-DD' };
  }
  const mk = monthKeyFromDate(day);
  const now = new Date().toISOString();
  const today = todayIsoDate();
  let list = [...audits];

  if (opts?.id) {
    const idx = list.findIndex((a) => a.id === opts.id);
    if (idx < 0) return { audits, entry: list[0], error: 'Schedule entry not found' };
    const prev = list[idx];
    if (prev.status === 'done') {
      return { audits, entry: prev, error: 'Cannot reschedule a completed audit' };
    }
    // conflict if another active entry for that month
    const clash = list.find(
      (a) =>
        a.id !== opts.id &&
        a.month_key === mk &&
        a.status !== 'cancelled'
    );
    if (clash) {
      return {
        audits,
        entry: prev,
        error: `Month ${mk} already has an audit scheduled`,
      };
    }
    const entry: KitchenMonthlyAudit = {
      ...prev,
      planned_date: day,
      month_key: mk,
      status: day < today ? 'overdue' : 'planned',
      notes: opts.notes !== undefined ? opts.notes : prev.notes,
      updated_at: now,
    };
    list[idx] = entry;
    return { audits: list, entry };
  }

  const existing = list.find(
    (a) => a.month_key === mk && a.status !== 'cancelled'
  );
  if (existing) {
    if (existing.status === 'done') {
      return {
        audits,
        entry: existing,
        error: `Month ${mk} already has a completed audit`,
      };
    }
    // reschedule existing planned/overdue
    const entry: KitchenMonthlyAudit = {
      ...existing,
      planned_date: day,
      month_key: mk,
      status: day < today ? 'overdue' : 'planned',
      notes: opts?.notes !== undefined ? opts.notes : existing.notes,
      updated_at: now,
    };
    list = list.map((a) => (a.id === existing.id ? entry : a));
    return { audits: list, entry };
  }

  const entry: KitchenMonthlyAudit = {
    id: `ma_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    month_key: mk,
    planned_date: day,
    status: day < today ? 'overdue' : 'planned',
    notes: opts?.notes ?? null,
    created_at: now,
    updated_at: now,
  };
  list = [entry, ...list].slice(0, 48);
  return { audits: list, entry };
}

export function completeMonthlyAudit(
  monthly: KitchenMonthlyAudit[],
  selfAudits: KitchenSelfAudit[],
  opts: {
    planned_date?: string;
    monthly_audit_id?: string;
    items: Partial<Record<R638ItemId, R638Answer>>;
    notes?: string | null;
    by_name?: string | null;
    completed_date?: string;
  }
): {
  monthly: KitchenMonthlyAudit[];
  selfAudits: KitchenSelfAudit[];
  entry: KitchenMonthlyAudit;
  selfAudit: KitchenSelfAudit;
  scored: ReturnType<typeof scoreR638>;
  error?: string;
} {
  const scored = scoreR638(opts.items);
  const now = new Date().toISOString();
  const completedDate = String(
    opts.completed_date || todayIsoDate()
  ).slice(0, 10);

  let entry =
    (opts.monthly_audit_id
      ? monthly.find((m) => m.id === opts.monthly_audit_id)
      : null) ||
    (opts.planned_date
      ? findMonthlyAuditForDate(monthly, opts.planned_date)
      : null) ||
    monthly.find(
      (m) =>
        m.month_key === monthKeyFromDate(completedDate) &&
        m.status !== 'cancelled' &&
        m.status !== 'done'
    );

  // Auto-create schedule for this month if completing without plan
  let list = [...monthly];
  if (!entry) {
    const planned = String(opts.planned_date || completedDate).slice(0, 10);
    const created = upsertMonthlySchedule(list, planned);
    if (created.error && !created.entry) {
      return {
        monthly,
        selfAudits,
        entry: monthly[0],
        selfAudit: selfAudits[0],
        scored,
        error: created.error,
      };
    }
    list = created.audits;
    entry = created.entry;
  }

  if (entry.status === 'done' && entry.score != null) {
    // Allow re-complete / update same month
  }

  const selfAudit: KitchenSelfAudit = {
    id: `r638_${Date.now().toString(36)}`,
    audited_at: now,
    planned_date: entry.planned_date,
    completed_date: completedDate,
    items: opts.items as Record<R638ItemId, R638Answer>,
    score: scored.score,
    band: scored.band,
    notes: opts.notes ?? null,
    by_name: opts.by_name ?? null,
    monthly_audit_id: entry.id,
  };

  const done: KitchenMonthlyAudit = {
    ...entry,
    status: 'done',
    completed_date: completedDate,
    completed_at: now,
    items: opts.items,
    score: scored.score,
    band: scored.band,
    notes: opts.notes ?? entry.notes ?? null,
    by_name: opts.by_name ?? null,
    updated_at: now,
  };

  list = list.map((m) => (m.id === entry!.id ? done : m));
  const nextSelf = [selfAudit, ...selfAudits].slice(0, 36);

  return {
    monthly: refreshMonthlyAuditStatuses(list),
    selfAudits: nextSelf,
    entry: done,
    selfAudit,
    scored,
  };
}

export type MonthlyAuditMonthCell = {
  date: string;
  inMonth: boolean;
  audit: KitchenMonthlyAudit | null;
};

/** Build a calendar month grid (weeks × 7) for UI */
export function buildAuditCalendarMonth(
  year: number,
  month: number, // 1-12
  audits: KitchenMonthlyAudit[]
): MonthlyAuditMonthCell[][] {
  const first = new Date(Date.UTC(year, month - 1, 1));
  const startPad = first.getUTCDay(); // 0=Sun
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const cells: MonthlyAuditMonthCell[] = [];
  for (let i = 0; i < startPad; i++) {
    const d = new Date(Date.UTC(year, month - 1, 1 - (startPad - i)));
    const iso = d.toISOString().slice(0, 10);
    cells.push({
      date: iso,
      inMonth: false,
      audit: findMonthlyAuditForDate(audits, iso),
    });
  }
  for (let day = 1; day <= daysInMonth; day++) {
    const iso = new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10);
    cells.push({
      date: iso,
      inMonth: true,
      audit: findMonthlyAuditForDate(audits, iso),
    });
  }
  while (cells.length % 7 !== 0) {
    const last = cells[cells.length - 1];
    const d = new Date(`${last.date}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + 1);
    const iso = d.toISOString().slice(0, 10);
    cells.push({
      date: iso,
      inMonth: false,
      audit: findMonthlyAuditForDate(audits, iso),
    });
  }
  const weeks: MonthlyAuditMonthCell[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }
  return weeks;
}

export function monthlyAuditStats(
  audits: KitchenMonthlyAudit[],
  opts?: { from?: string; to?: string; today?: string }
) {
  const today = opts?.today || todayIsoDate();
  const list = refreshMonthlyAuditStatuses(audits, today).filter((a) => {
    if (a.status === 'cancelled') return false;
    if (opts?.from && a.planned_date < opts.from) return false;
    if (opts?.to && a.planned_date > opts.to) return false;
    return true;
  });
  const done = list.filter((a) => a.status === 'done');
  const planned = list.filter((a) => a.status === 'planned');
  const overdue = list.filter((a) => a.status === 'overdue');
  const red = done.filter((a) => a.band === 'red').length;
  const amber = done.filter((a) => a.band === 'amber').length;
  const green = done.filter((a) => a.band === 'green').length;
  const scores = done
    .map((a) => a.score)
    .filter((n): n is number => n != null && Number.isFinite(n));
  const avgScore =
    scores.length > 0
      ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
      : null;
  const thisMonth = monthKeyFromDate(today);
  const thisMonthEntry = list.find((a) => a.month_key === thisMonth) || null;
  return {
    total: list.length,
    done: done.length,
    planned: planned.length,
    overdue: overdue.length,
    red,
    amber,
    green,
    avg_score: avgScore,
    this_month_key: thisMonth,
    this_month_status: thisMonthEntry?.status || 'none',
    this_month_score: thisMonthEntry?.score ?? null,
    this_month_band: thisMonthEntry?.band || null,
    this_month_planned_date: thisMonthEntry?.planned_date || null,
    completion_pct:
      list.length > 0 ? Math.round((done.length / list.length) * 100) : 0,
  };
}

export function readKitchenPolicy(
  agencyMeta: Record<string, unknown> | null | undefined
): KitchenSafetyPolicy {
  const raw = agencyMeta?.[KITCHEN_POLICY_META_KEY];
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_KITCHEN_POLICY };
  const p = raw as Partial<KitchenSafetyPolicy>;
  return {
    claim_gate: p.claim_gate === 'hard' ? 'hard' : 'soft',
    coa_grace_days:
      p.coa_grace_days != null && Number.isFinite(Number(p.coa_grace_days))
        ? Math.max(0, Number(p.coa_grace_days))
        : DEFAULT_KITCHEN_POLICY.coa_grace_days,
    peu_verify_months:
      p.peu_verify_months != null && Number.isFinite(Number(p.peu_verify_months))
        ? Math.max(1, Number(p.peu_verify_months))
        : DEFAULT_KITCHEN_POLICY.peu_verify_months,
    self_audit_max_days:
      p.self_audit_max_days != null &&
      Number.isFinite(Number(p.self_audit_max_days))
        ? Math.max(30, Number(p.self_audit_max_days))
        : DEFAULT_KITCHEN_POLICY.self_audit_max_days,
  };
}

export function scoreR638(
  items: Partial<Record<R638ItemId, R638Answer>>
): { score: number; band: SafetyBand; yes: number; no: number; applicable: number } {
  let yes = 0;
  let no = 0;
  for (const def of R638_CHECKLIST) {
    const a = items[def.id];
    if (a === 'yes') yes += 1;
    else if (a === 'no') no += 1;
  }
  const applicable = yes + no;
  if (applicable === 0) {
    return { score: 0, band: 'unknown', yes: 0, no: 0, applicable: 0 };
  }
  const score = Math.round((yes / applicable) * 100);
  let band: SafetyBand = 'green';
  if (score < 50 || no >= 3) band = 'red';
  else if (score < 80 || no >= 1) band = 'amber';
  return { score, band, yes, no, applicable };
}

function daysBetween(fromIso: string, toIso: string): number {
  const a = new Date(`${fromIso.slice(0, 10)}T12:00:00`).getTime();
  const b = new Date(`${toIso.slice(0, 10)}T12:00:00`).getTime();
  return Math.round((b - a) / 86400000);
}

export function normalizeCoaStatus(
  passport: KitchenSafetyPassport,
  today = new Date().toISOString().slice(0, 10),
  graceDays = DEFAULT_KITCHEN_POLICY.coa_grace_days
): CoaStatus {
  let status = passport.coa_status || 'none';
  if (status === 'valid' && passport.coa_expires_on) {
    const exp = String(passport.coa_expires_on).slice(0, 10);
    if (exp < today) {
      // still within grace?
      const daysPast = daysBetween(exp, today);
      status = daysPast <= graceDays ? 'valid' : 'expired';
      // if past expiry but in grace, keep valid with note via band
      if (daysPast > 0 && daysPast <= graceDays) {
        /* grace: leave as valid for soft scoring but risk will flag amber */
      } else if (daysPast > graceDays) {
        status = 'expired';
      }
    }
  }
  if (status === 'valid' && !passport.coa_number && !passport.coa_file_url) {
    // claimed valid without evidence → treat carefully in band
  }
  return status;
}

export type KitchenRisk = {
  band: SafetyBand;
  coa_status: CoaStatus;
  label: string;
  reasons: string[];
  claim_soft_block: boolean;
  claim_hard_block: boolean;
  prizes_blocked: boolean;
};

export function evaluateKitchenRisk(
  passport: KitchenSafetyPassport,
  opts?: {
    policy?: KitchenSafetyPolicy;
    today?: string;
    /** Optional monthly schedule for this-month overdue / missing signal */
    monthlyAudits?: KitchenMonthlyAudit[];
  }
): KitchenRisk {
  const policy = opts?.policy || DEFAULT_KITCHEN_POLICY;
  const today = opts?.today || new Date().toISOString().slice(0, 10);
  const coa = normalizeCoaStatus(passport, today, policy.coa_grace_days);
  const reasons: string[] = [];

  if (coa === 'none') reasons.push('No Certificate of Acceptability (CoA) on file');
  if (coa === 'applied') reasons.push('CoA applied — awaiting municipal EHP issue');
  if (coa === 'expired') reasons.push('CoA expired');
  if (coa === 'revoked') reasons.push('CoA revoked');
  if (!passport.pic_name) reasons.push('Person in Charge not named');
  if (!passport.pic_training_at) reasons.push('PIC food-hygiene training date missing');
  if (passport.pic_training_at) {
    const age = daysBetween(String(passport.pic_training_at).slice(0, 10), today);
    if (age > 730) reasons.push('PIC training older than 24 months');
  }
  if (!passport.r638_last_audit_at) {
    reasons.push('No R638 self-audit yet');
  } else {
    const age = daysBetween(
      String(passport.r638_last_audit_at).slice(0, 10),
      today
    );
    if (age > policy.self_audit_max_days) {
      reasons.push(
        `R638 self-audit older than ${policy.self_audit_max_days} days`
      );
    }
  }
  if (passport.r638_band === 'red') reasons.push('R638 self-audit score is red');
  if (opts?.monthlyAudits) {
    const st = monthlyAuditStats(opts.monthlyAudits, { today });
    if (st.this_month_status === 'overdue') {
      reasons.push('This month’s R638 kitchen audit is overdue');
    } else if (st.this_month_status === 'none' && Number(today.slice(8, 10)) >= 20) {
      reasons.push('No R638 kitchen audit scheduled for this month');
    } else if (st.overdue > 0) {
      reasons.push(`${st.overdue} overdue monthly kitchen audit(s)`);
    }
  }
  if (passport.peu_verify_status === 'noncompliant') {
    reasons.push('PEU kitchen verification non-compliant');
  }
  if (passport.water_ok === false) reasons.push('Water supply flagged inadequate');
  if (passport.power_ok === false) reasons.push('Power supply flagged inadequate');

  // CoA expiry within grace → amber reason
  if (
    coa === 'valid' &&
    passport.coa_expires_on &&
    String(passport.coa_expires_on).slice(0, 10) < today
  ) {
    reasons.push(
      `CoA past expiry but within ${policy.coa_grace_days}-day grace`
    );
  }

  let band: SafetyBand = 'green';
  const critical =
    coa === 'none' ||
    coa === 'expired' ||
    coa === 'revoked' ||
    passport.r638_band === 'red' ||
    passport.peu_verify_status === 'noncompliant';
  const amber =
    coa === 'applied' ||
    passport.r638_band === 'amber' ||
    !passport.pic_name ||
    !passport.pic_training_at ||
    !passport.r638_last_audit_at ||
    reasons.some((r) => r.includes('older than'));

  if (critical) band = 'red';
  else if (amber || reasons.length > 0) band = 'amber';
  else if (coa === 'valid' && passport.r638_band === 'green') band = 'green';
  else if (coa === 'valid') band = 'green';
  else band = 'unknown';

  const label =
    band === 'green'
      ? 'Kitchen food safety: compliant'
      : band === 'amber'
        ? 'Kitchen food safety: at risk'
        : band === 'red'
          ? 'Kitchen food safety: non-compliant'
          : 'Kitchen food safety: unknown';

  const claim_soft_block = band === 'red' || band === 'amber';
  const claim_hard_block =
    policy.claim_gate === 'hard' && (band === 'red' || coa === 'none' || coa === 'expired');

  return {
    band,
    coa_status: coa,
    label,
    reasons,
    claim_soft_block,
    claim_hard_block,
    prizes_blocked: band === 'red' || coa === 'none' || coa === 'expired' || coa === 'revoked',
  };
}

export function mergePassport(
  prev: KitchenSafetyPassport,
  patch: Partial<KitchenSafetyPassport>
): KitchenSafetyPassport {
  return {
    ...prev,
    ...patch,
    updated_at: new Date().toISOString(),
  };
}

export function writeKitchenToSchoolMeta(
  schoolMeta: Record<string, unknown> | null | undefined,
  passport: KitchenSafetyPassport,
  audits?: KitchenSelfAudit[],
  monthlyAudits?: KitchenMonthlyAudit[]
): Record<string, unknown> {
  const meta = { ...(schoolMeta || {}) };
  meta[KITCHEN_SAFETY_META_KEY] = passport;
  if (audits) {
    meta[KITCHEN_SELF_AUDITS_KEY] = audits.slice(0, 36);
  }
  if (monthlyAudits) {
    meta[KITCHEN_MONTHLY_AUDITS_KEY] = refreshMonthlyAuditStatuses(
      monthlyAudits
    ).slice(0, 48);
  }
  return meta;
}

export type KitchenRegisterRow = {
  school_profile_id: number;
  school_name: string;
  emis_number?: string | null;
  district?: string | null;
  province?: string | null;
  coa_status: CoaStatus;
  coa_expires_on?: string | null;
  r638_band?: SafetyBand | null;
  r638_score?: number | null;
  r638_last_audit_at?: string | null;
  pic_name?: string | null;
  peu_verify_status?: string | null;
  risk_band: SafetyBand;
  reasons: string[];
  /** This calendar month audit */
  monthly_audit_status?: MonthlyAuditStatus | 'none';
  monthly_audit_planned_date?: string | null;
  monthly_audit_score?: number | null;
  monthly_audit_band?: SafetyBand | null;
  monthly_audits_done_12m?: number;
  monthly_audits_overdue?: number;
};

export function passportFromSchoolRow(
  school: Record<string, unknown>
): KitchenSafetyPassport {
  const meta =
    school.metadata && typeof school.metadata === 'object'
      ? (school.metadata as Record<string, unknown>)
      : {};
  return readKitchenPassport(meta);
}

export function registerRowFromSchool(
  school: Record<string, unknown>,
  policy?: KitchenSafetyPolicy
): KitchenRegisterRow {
  const meta =
    school.metadata && typeof school.metadata === 'object'
      ? (school.metadata as Record<string, unknown>)
      : {};
  const passport = readKitchenPassport(meta);
  const risk = evaluateKitchenRisk(passport, { policy });
  const monthly = refreshMonthlyAuditStatuses(readMonthlyAudits(meta));
  const stats = monthlyAuditStats(monthly);
  return {
    school_profile_id: Number(school.id),
    school_name: String(school.school_name || 'School'),
    emis_number: school.emis_number != null ? String(school.emis_number) : null,
    district: school.district != null ? String(school.district) : null,
    province: school.province != null ? String(school.province) : null,
    coa_status: risk.coa_status,
    coa_expires_on: passport.coa_expires_on || null,
    r638_band: passport.r638_band || null,
    r638_score: passport.r638_score ?? null,
    r638_last_audit_at: passport.r638_last_audit_at || null,
    pic_name: passport.pic_name || null,
    peu_verify_status: passport.peu_verify_status || null,
    risk_band: risk.band,
    reasons: risk.reasons,
    monthly_audit_status:
      stats.this_month_status === 'none'
        ? 'none'
        : (stats.this_month_status as MonthlyAuditStatus),
    monthly_audit_planned_date: stats.this_month_planned_date,
    monthly_audit_score: stats.this_month_score,
    monthly_audit_band: stats.this_month_band as SafetyBand | null,
    monthly_audits_done_12m: stats.done,
    monthly_audits_overdue: stats.overdue,
  };
}

export function kitchenSafetySummary(rows: KitchenRegisterRow[]) {
  const total = rows.length || 1;
  const validCoa = rows.filter((r) => r.coa_status === 'valid').length;
  const none = rows.filter((r) => r.coa_status === 'none').length;
  const expired = rows.filter((r) => r.coa_status === 'expired').length;
  const red = rows.filter((r) => r.risk_band === 'red').length;
  const amber = rows.filter((r) => r.risk_band === 'amber').length;
  const green = rows.filter((r) => r.risk_band === 'green').length;
  const monthDone = rows.filter((r) => r.monthly_audit_status === 'done').length;
  const monthOverdue = rows.filter(
    (r) => r.monthly_audit_status === 'overdue'
  ).length;
  const monthPlanned = rows.filter(
    (r) => r.monthly_audit_status === 'planned'
  ).length;
  const monthMissing = rows.filter(
    (r) => !r.monthly_audit_status || r.monthly_audit_status === 'none'
  ).length;
  const monthScores = rows
    .map((r) => r.monthly_audit_score)
    .filter((n): n is number => n != null && Number.isFinite(n));
  return {
    schools: rows.length,
    valid_coa: validCoa,
    valid_coa_pct: Math.round((validCoa / total) * 100),
    none_coa: none,
    expired_coa: expired,
    red,
    amber,
    green,
    monthly_audit_done: monthDone,
    monthly_audit_done_pct: Math.round((monthDone / total) * 100),
    monthly_audit_overdue: monthOverdue,
    monthly_audit_planned: monthPlanned,
    monthly_audit_missing: monthMissing,
    monthly_audit_avg_score:
      monthScores.length > 0
        ? Math.round(
            monthScores.reduce((a, b) => a + b, 0) / monthScores.length
          )
        : null,
  };
}
