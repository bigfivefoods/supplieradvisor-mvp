import { userIdMatchVariants } from '@/lib/auth/identity';
import { contractorContractingParty, readContractorEntity } from './party';
import { isLifetimeSalesAccess } from './subscription';

/** One stored sales-contractor agreement. The PDF is rebuilt from these fields. */
export type AgreementStoreRow = {
  id: number;
  profile_id: number;
  business_user_id: number | null;
  user_id: string | null;
  contractor_email?: string | null;
  contractor_name?: string | null;
  status: string;
  contract_version?: string | null;
  signed_at?: string | null;
  signature_name?: string | null;
  signature_email?: string | null;
  accepted_ip?: string | null;
  subscription_status?: string | null;
  subscription_ends_at?: string | null;
  metadata?: unknown;
};

export type SalesContractorProof = {
  memberId: number;
  onFile: boolean;
  agreementId: number | null;
  status: 'none' | 'pending' | 'signed' | 'suspended' | 'terminated';
  signedAt: string | null;
  signatureName: string | null;
  signatureEmail: string | null;
  contractorName: string | null;
  contractorCompanyName: string | null;
  contractorRegistrationNumber: string | null;
  signerCapacity: string | null;
  contractVersion: string | null;
  acceptedIp: string | null;
  contractResentAt: string | null;
  contractResendCount: number;
  lifetime: boolean;
};

const KNOWN_STATUS = new Set(['pending', 'signed', 'suspended', 'terminated']);

function asStatus(raw: string | null | undefined): SalesContractorProof['status'] {
  const status = String(raw || '').toLowerCase();
  return KNOWN_STATUS.has(status)
    ? (status as SalesContractorProof['status'])
    : 'none';
}

function metaObject(raw: unknown): Record<string, unknown> | null {
  if (!raw) return null;
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return null;
    }
  }
  return null;
}

function rankStatus(status: string): number {
  switch (String(status || '').toLowerCase()) {
    case 'signed':
      return 0;
    case 'suspended':
      return 1;
    case 'pending':
      return 2;
    case 'terminated':
      return 3;
    default:
      return 4;
  }
}

/**
 * The agreement that belongs to this membership.
 * Prefer the membership id, then the person's user id. A signed row wins over a newer draft.
 * Does not create a row.
 */
export function pickStoredAgreement<T extends AgreementStoreRow>(
  member: { id: number; user_id?: string | null },
  rows: T[],
  companyId?: number
): T | null {
  const variants = new Set(
    member.user_id ? userIdMatchVariants(String(member.user_id)) : []
  );
  const mine = rows.filter((row) => {
    if (companyId != null && Number(row.profile_id) !== Number(companyId)) return false;
    if (
      row.business_user_id != null &&
      Number(row.business_user_id) === Number(member.id)
    ) {
      return true;
    }
    const userId = row.user_id ? String(row.user_id) : '';
    return Boolean(userId && variants.has(userId));
  });
  if (!mine.length) return null;
  return [...mine].sort((a, b) => {
    const byStatus = rankStatus(a.status) - rankStatus(b.status);
    if (byStatus !== 0) return byStatus;
    return Number(b.id) - Number(a.id);
  })[0];
}

function isComplimentary(row: AgreementStoreRow): boolean {
  if (isLifetimeSalesAccess(row)) return true;
  return metaObject(row.metadata)?.complimentary_lifetime === true;
}

export function proofFromMember(
  memberId: number,
  row: AgreementStoreRow | null
): SalesContractorProof {
  if (!row) {
    return {
      memberId,
      onFile: false,
      agreementId: null,
      status: 'none',
      signedAt: null,
      signatureName: null,
      signatureEmail: null,
      contractorName: null,
      contractorCompanyName: null,
      contractorRegistrationNumber: null,
      signerCapacity: null,
      contractVersion: null,
      acceptedIp: null,
      contractResentAt: null,
      contractResendCount: 0,
      lifetime: false,
    };
  }
  const entity = readContractorEntity(row);
  return {
    memberId,
    onFile: true,
    agreementId: Number(row.id),
    status: asStatus(row.status),
    signedAt: row.signed_at ? String(row.signed_at) : null,
    signatureName: row.signature_name ? String(row.signature_name) : null,
    signatureEmail: row.signature_email ? String(row.signature_email) : null,
    contractorName: row.contractor_name ? String(row.contractor_name) : null,
    contractorCompanyName: entity.contractor_company_name,
    contractorRegistrationNumber: entity.contractor_registration_number,
    signerCapacity: entity.contractor_signer_capacity,
    contractVersion: row.contract_version ? String(row.contract_version) : null,
    acceptedIp: row.accepted_ip ? String(row.accepted_ip) : null,
    contractResentAt: entity.contract_resent_at,
    contractResendCount: entity.contract_resend_count,
    lifetime: isComplimentary(row),
  };
}

/** Name shown to admins. Blank company keeps the person's name. */
export function agreementPartyLabel(proof: {
  signatureName?: string | null;
  contractorName?: string | null;
  contractorCompanyName?: string | null;
  contractorRegistrationNumber?: string | null;
  signerCapacity?: string | null;
}): string {
  const person = proof.signatureName || proof.contractorName || '';
  const party = contractorContractingParty({
    personName: person,
    companyName: proof.contractorCompanyName,
    registrationNumber: proof.contractorRegistrationNumber,
  });
  if (!proof.contractorCompanyName) return party || 'Signature not on file';
  const capacity = String(proof.signerCapacity || '').trim();
  return capacity ? `${party} · ${capacity}` : party || 'Signature not on file';
}

export function proofsForContractors(
  members: Array<{ id: number; user_id?: string | null }>,
  rows: AgreementStoreRow[],
  companyId?: number
): SalesContractorProof[] {
  return members.map((member) =>
    proofFromMember(member.id, pickStoredAgreement(member, rows, companyId))
  );
}

export function agreementProofLabel(proof: SalesContractorProof): string {
  if (!proof.onFile || proof.status === 'none') return 'No agreement on file';
  if (proof.status === 'signed' && proof.signedAt) return 'Signed';
  if (proof.status === 'signed') return 'Marked signed';
  if (proof.status === 'pending') return 'Waiting for signature';
  if (proof.status === 'suspended') return 'Suspended';
  if (proof.status === 'terminated') return 'Terminated';
  return 'No agreement on file';
}
