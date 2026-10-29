import { companyAllowed } from '@/lib/fitness/netcash/guard';
import type { NetcashRepo, JobDraft } from '@/lib/fitness/netcash/repo';
import type {
  AccessHold,
  AuditEvent,
  BillingLine,
  BillingRun,
  JobRecord,
  Mandate,
  NetcashSettings,
} from '@/lib/fitness/netcash/types';

type BatchRow = {
  id: string;
  companyId: number;
  runId: string;
  kind: string;
  sha256: string;
  count: number;
  totalCents: number;
  fileEnc: string;
  createdAt: string;
};

export function memoryRepo(): NetcashRepo & { batches: BatchRow[] } {
  const settings = new Map<number, NetcashSettings>();
  const mandates: Mandate[] = [];
  const runs: BillingRun[] = [];
  const lines: BillingLine[] = [];
  const audit: AuditEvent[] = [];
  const holds: AccessHold[] = [];
  const jobs: JobRecord[] = [];
  const sequences = new Map<string, number>();
  const batches: BatchRow[] = [];

  function gate(companyId: number) {
    const allowed = companyAllowed(companyId);
    if (!allowed.ok) throw new Error(allowed.error);
  }

  return {
    batches,
    async getSettings(companyId) {
      gate(companyId);
      return settings.get(companyId) || null;
    },
    async saveSettings(next) {
      gate(next.companyId);
      settings.set(next.companyId, next);
      return next;
    },
    async listMandates(companyId) {
      gate(companyId);
      return mandates.filter((row) => row.companyId === companyId);
    },
    async saveMandate(mandate) {
      gate(mandate.companyId);
      const index = mandates.findIndex((row) => row.id === mandate.id);
      if (index >= 0) mandates[index] = mandate;
      else mandates.push(mandate);
      return mandate;
    },
    async listRuns(companyId) {
      gate(companyId);
      return runs.filter((row) => row.companyId === companyId);
    },
    async saveRun(run) {
      gate(run.companyId);
      const index = runs.findIndex((row) => row.id === run.id);
      if (index >= 0) runs[index] = run;
      else runs.push(run);
      return run;
    },
    async listLines(companyId, runId) {
      gate(companyId);
      return lines.filter((row) => row.companyId === companyId && (runId ? row.runId === runId : true));
    },
    async listMemberLines(companyId, memberId) {
      gate(companyId);
      return lines.filter((row) => row.companyId === companyId && row.memberId === memberId);
    },
    async saveLines(next) {
      for (const line of next) {
        gate(line.companyId);
        const index = lines.findIndex((row) => row.id === line.id);
        if (index >= 0) lines[index] = line;
        else lines.push(line);
      }
    },
    async replaceRunLines(companyId, runId, next) {
      gate(companyId);
      for (let i = lines.length - 1; i >= 0; i -= 1) {
        if (lines[i].companyId === companyId && lines[i].runId === runId) lines.splice(i, 1);
      }
      lines.push(...next);
    },
    async findRunByKey(companyId, idempotencyKey) {
      gate(companyId);
      return runs.find((row) => row.companyId === companyId && row.idempotencyKey === idempotencyKey) || null;
    },
    async appendAudit(event) {
      gate(event.companyId);
      audit.push(event);
    },
    async listAudit(companyId, limit) {
      gate(companyId);
      return audit.filter((row) => row.companyId === companyId).slice(-limit).reverse();
    },
    async listHolds(companyId) {
      gate(companyId);
      return holds.filter((row) => row.companyId === companyId && row.active);
    },
    async saveHold(hold) {
      gate(hold.companyId);
      const index = holds.findIndex((row) => row.companyId === hold.companyId && row.memberId === hold.memberId && row.active);
      if (index >= 0) holds[index] = hold;
      else holds.push(hold);
    },
    async releaseHold(companyId, memberId, at) {
      gate(companyId);
      for (const hold of holds) {
        if (hold.companyId === companyId && hold.memberId === memberId && hold.active) {
          hold.active = false;
          hold.releasedAt = at;
        }
      }
    },
    async nextNumber(companyId, name) {
      gate(companyId);
      const key = `${companyId}:${name}`;
      const next = (sequences.get(key) || 0) + 1;
      sequences.set(key, next);
      return next;
    },
    async claimJob(draft: JobDraft, nowIso: string) {
      gate(draft.companyId);
      const existing = jobs.find((job) => job.companyId === draft.companyId && job.idempotencyKey === draft.idempotencyKey);
      if (existing && (existing.status === 'succeeded' || existing.status === 'running')) {
        return { state: existing.status === 'succeeded' ? 'duplicate' : 'busy', job: existing };
      }
      if (existing && existing.status === 'failed') {
        existing.status = 'running';
        existing.attempts += 1;
        existing.lockedAt = nowIso;
        existing.updatedAt = nowIso;
        existing.lastError = '';
        return { state: 'claimed', job: existing };
      }
      const job: JobRecord = {
        id: draft.id || `job_${jobs.length + 1}`,
        companyId: draft.companyId,
        kind: draft.kind,
        idempotencyKey: draft.idempotencyKey,
        status: 'running',
        attempts: 1,
        runId: draft.runId,
        lastError: '',
        lockedAt: nowIso,
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      jobs.push(job);
      return { state: 'claimed', job };
    },
    async finishJob(id, patch) {
      const job = jobs.find((row) => row.id === id);
      if (!job) return;
      job.status = patch.status;
      job.lastError = patch.lastError;
      job.updatedAt = new Date().toISOString();
      job.lockedAt = null;
    },
    async saveBatch(batch) {
      gate(batch.companyId);
      batches.push(batch);
    },
  };
}
