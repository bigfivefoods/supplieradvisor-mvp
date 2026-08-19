/**
 * Medical-aid switch adapter.
 * MediKredit XML pack is not in-repo yet — sandbox simulates HealthNet ST
 * submit / status / ERA so the desk and patient app can ship now.
 */
import type { MedicalAidClaim, PatientMedicalRecord } from '@/lib/clinic/patient-medical';
import { validateMedicalAidClaim } from '@/lib/clinic/medical-aid-claim-validate';

export type ClaimsSwitchProvider = 'medikredit' | 'manual';
export type ClaimsSwitchMode = 'sandbox' | 'live';

export type PracticeClaimsSwitch = {
  provider?: ClaimsSwitchProvider;
  mode?: ClaimsSwitchMode;
  pcns_verified?: boolean;
  username?: string | null;
  /** Encrypted secret — never returned to the browser */
  secret_enc?: string | null;
  has_secret?: boolean;
  last_submitted_at?: string | null;
};

export type SwitchSubmitInput = {
  claim: MedicalAidClaim;
  medical?: PatientMedicalRecord | null;
  billing?: { pcns_number?: string; bhf_number?: string; practice_number?: string } | null;
  patientName: string;
  patientCode?: string;
  switch: PracticeClaimsSwitch;
};

export type SwitchSubmitResult = {
  ok: boolean;
  tracking_number?: string;
  status: 'submitted' | 'accepted' | 'rejected';
  rejection_codes?: string[];
  message: string;
  raw: string;
};

export type SwitchStatusResult = {
  ok: boolean;
  status: 'submitted' | 'accepted' | 'rejected' | 'paid' | 'partial';
  message: string;
  raw: string;
};

export function publicClaimsSwitch(
  raw?: PracticeClaimsSwitch | null
): PracticeClaimsSwitch {
  const s = raw || {};
  return {
    provider: s.provider === 'manual' ? 'manual' : 'medikredit',
    mode: s.mode === 'live' ? 'live' : 'sandbox',
    pcns_verified: s.pcns_verified === true,
    username: s.username || null,
    has_secret: Boolean(s.secret_enc),
    last_submitted_at: s.last_submitted_at || null,
  };
}

export async function submitToMedicalAidSwitch(
  input: SwitchSubmitInput
): Promise<SwitchSubmitResult> {
  const mode = input.switch.mode === 'live' ? 'live' : 'sandbox';
  const provider = input.switch.provider === 'manual' ? 'manual' : 'medikredit';

  if (provider === 'manual') {
    return {
      ok: true,
      tracking_number: input.claim.claim_number || input.claim.id,
      status: 'submitted',
      message: 'Marked submitted for manual / paper pack',
      raw: JSON.stringify({ provider: 'manual' }),
    };
  }

  if (mode === 'live') {
    return {
      ok: false,
      status: 'rejected',
      rejection_codes: ['SWITCH_NOT_ACCREDITED'],
      message:
        'Live MediKredit (HealthNet ST) is waiting on the official PMS integration pack and practice accreditation. Use sandbox until then, or submit the PDF pack.',
      raw: JSON.stringify({ provider: 'medikredit', mode: 'live', pending: true }),
    };
  }

  const check = validateMedicalAidClaim({
    claim: input.claim,
    medical: input.medical,
    billing: input.billing,
  });
  const tracking = `MK-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${input.claim.id.slice(-6).toUpperCase()}`;
  const payload = {
    provider: 'medikredit',
    mode: 'sandbox',
    tracking_number: tracking,
    pcns: input.billing?.pcns_number || input.billing?.bhf_number || null,
    member: input.medical?.medical_aid?.membership_number || null,
    scheme: input.medical?.medical_aid?.scheme_name || null,
    patient: input.patientName,
    amount_zar: input.claim.amount_zar,
    tariff: input.claim.tariff_code,
    icd10: input.claim.diagnosis_codes || [input.claim.diagnosis_code],
  };

  if (!check.ok) {
    return {
      ok: false,
      tracking_number: tracking,
      status: 'rejected',
      rejection_codes: check.errors.map((_, i) => `VAL${String(i + 1).padStart(2, '0')}`),
      message: check.errors.join('; '),
      raw: JSON.stringify({ ...payload, errors: check.errors }),
    };
  }

  return {
    ok: true,
    tracking_number: tracking,
    status: 'accepted',
    message: `Sandbox MediKredit accepted claim ${tracking}`,
    raw: JSON.stringify({ ...payload, result: 'accepted' }),
  };
}

export async function pollMedicalAidSwitch(opts: {
  tracking_number: string;
  switch: PracticeClaimsSwitch;
  claim: MedicalAidClaim;
}): Promise<SwitchStatusResult> {
  if (opts.switch.mode === 'live') {
    return {
      ok: false,
      status: 'submitted',
      message: 'Live status poll unavailable until MediKredit accreditation',
      raw: '{}',
    };
  }
  if (opts.claim.status === 'accepted' || opts.claim.status === 'submitted') {
    return {
      ok: true,
      status: 'accepted',
      message: `Sandbox status for ${opts.tracking_number}: accepted`,
      raw: JSON.stringify({ tracking_number: opts.tracking_number, status: 'accepted' }),
    };
  }
  return {
    ok: true,
    status: opts.claim.status === 'partial' ? 'partial' : (opts.claim.status as SwitchStatusResult['status']),
    message: `Current status ${opts.claim.status}`,
    raw: '{}',
  };
}
