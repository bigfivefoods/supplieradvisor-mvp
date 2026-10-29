import type {
  AccessHold,
  AuditEvent,
  BillingLine,
  BillingRun,
  JobRecord,
  Mandate,
  NetcashSettings,
} from '@/lib/fitness/netcash/types';

export type JobDraft = Omit<JobRecord, 'id' | 'status' | 'attempts' | 'lastError' | 'lockedAt' | 'createdAt' | 'updatedAt'> & {
  id?: string;
};

export type NetcashRepo = {
  getSettings(companyId: number): Promise<NetcashSettings | null>;
  saveSettings(settings: NetcashSettings): Promise<NetcashSettings>;
  listMandates(companyId: number): Promise<Mandate[]>;
  saveMandate(mandate: Mandate): Promise<Mandate>;
  listRuns(companyId: number): Promise<BillingRun[]>;
  saveRun(run: BillingRun): Promise<BillingRun>;
  listLines(companyId: number, runId?: string): Promise<BillingLine[]>;
  listMemberLines(companyId: number, memberId: string): Promise<BillingLine[]>;
  saveLines(lines: BillingLine[]): Promise<void>;
  replaceRunLines(companyId: number, runId: string, lines: BillingLine[]): Promise<void>;
  findRunByKey(companyId: number, idempotencyKey: string): Promise<BillingRun | null>;
  appendAudit(event: AuditEvent): Promise<void>;
  listAudit(companyId: number, limit: number): Promise<AuditEvent[]>;
  listHolds(companyId: number): Promise<AccessHold[]>;
  saveHold(hold: AccessHold): Promise<void>;
  releaseHold(companyId: number, memberId: string, at: string): Promise<void>;
  nextNumber(companyId: number, name: string): Promise<number>;
  claimJob(draft: JobDraft, nowIso: string): Promise<{ state: 'claimed' | 'duplicate' | 'busy'; job: JobRecord }>;
  finishJob(id: string, patch: Pick<JobRecord, 'status' | 'lastError'>): Promise<void>;
  saveBatch(batch: { id: string; companyId: number; runId: string; kind: string; sha256: string; count: number; totalCents: number; fileEnc: string; createdAt: string }): Promise<void>;
};
