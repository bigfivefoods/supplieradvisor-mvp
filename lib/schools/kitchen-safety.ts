/**
 * School kitchen food safety (R638 / Certificate of Acceptability).
 * Stored on school_profiles.metadata.kitchen_safety (+ self_audits array).
 * Aligns SchoolAdvisor® with SA Regulation R638 legal kitchen requirements.
 */

export const KITCHEN_SAFETY_META_KEY = 'kitchen_safety';
export const KITCHEN_SELF_AUDITS_KEY = 'kitchen_self_audits';
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
  items: Record<R638ItemId, R638Answer>;
  score: number;
  band: SafetyBand;
  notes?: string | null;
  by_name?: string | null;
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
  audits?: KitchenSelfAudit[]
): Record<string, unknown> {
  const meta = { ...(schoolMeta || {}) };
  meta[KITCHEN_SAFETY_META_KEY] = passport;
  if (audits) {
    meta[KITCHEN_SELF_AUDITS_KEY] = audits.slice(0, 24);
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
  const passport = passportFromSchoolRow(school);
  const risk = evaluateKitchenRisk(passport, { policy });
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
  return {
    schools: rows.length,
    valid_coa: validCoa,
    valid_coa_pct: Math.round((validCoa / total) * 100),
    none_coa: none,
    expired_coa: expired,
    red,
    amber,
    green,
  };
}
