import { reasonInfo } from '@/lib/fitness/netcash/reasons';
import type { AccessHold, BatchLineResult, BillingLine, Mandate, NetcashSettings } from '@/lib/fitness/netcash/types';

export type ReconcileOutcome = {
  lines: BillingLine[];
  retryLines: BillingLine[];
  holds: AccessHold[];
  releasedMemberIds: string[];
  notifications: Array<{ lineId: string; kind: 'unpaid' | 'paid' }>;
};

export function applyResults(input: {
  lines: BillingLine[];
  mandates: Mandate[];
  results: BatchLineResult[];
  settings: NetcashSettings;
  nowIso: string;
  id: () => string;
}): ReconcileOutcome {
  const byRef = new Map(input.mandates.map((mandate) => [mandate.netcashRef, mandate]));
  const resultByMandate = new Map<string, BatchLineResult>();
  for (const result of input.results) {
    const mandate = byRef.get(result.netcashRef);
    if (mandate) resultByMandate.set(mandate.id, result);
  }
  const lines = input.lines.map((line) => ({ ...line }));
  const retryLines: BillingLine[] = [];
  const holds: AccessHold[] = [];
  const releasedMemberIds: string[] = [];
  const notifications: ReconcileOutcome['notifications'] = [];

  for (const line of lines) {
    if (line.collectionStatus !== 'submitted' || !line.mandateId) continue;
    const result = resultByMandate.get(line.mandateId);
    if (!result) continue;
    const reason = reasonInfo(result.reasonCode);
    line.updatedAt = input.nowIso;
    line.netcashReasonCode = reason.code;
    line.netcashReasonText = reason.label;
    if (result.outcome === 'paid') {
      line.collectionStatus = 'paid';
      line.accessSuspended = false;
      releasedMemberIds.push(line.memberId);
      notifications.push({ lineId: line.id, kind: 'paid' });
      continue;
    }
    if (result.outcome === 'reversed') {
      line.collectionStatus = 'reversed';
      notifications.push({ lineId: line.id, kind: 'unpaid' });
      continue;
    }
    line.collectionStatus = 'unpaid';
    notifications.push({ lineId: line.id, kind: 'unpaid' });
    const canRetry = reason.retryable && line.attempt < input.settings.retryMaxAttempts;
    if (canRetry) {
      const attempt = line.attempt + 1;
      retryLines.push({
        ...line,
        id: input.id(),
        collectionStatus: 'scheduled',
        attempt,
        retryOfLineId: line.id,
        idempotencyKey: `${line.runId}:${line.memberId}:${attempt}`,
        netcashReasonCode: '',
        netcashReasonText: '',
        invoiceId: line.invoiceId,
        invoiceNumber: line.invoiceNumber,
        feeCents: 0,
        skipReason: '',
        notifiedAt: null,
        accessSuspended: false,
        createdAt: input.nowIso,
        updatedAt: input.nowIso,
      });
    }
    if (input.settings.autoSuspendAccess && reason.suspendSuggested) {
      line.accessSuspended = true;
      holds.push({
        id: input.id(),
        companyId: line.companyId,
        memberId: line.memberId,
        memberName: line.memberName,
        reason: reason.label,
        active: true,
        createdAt: input.nowIso,
        releasedAt: null,
      });
    }
  }
  return { lines, retryLines, holds, releasedMemberIds, notifications };
}

export function pendingLateFees(lines: BillingLine[], settings: NetcashSettings): Map<string, number> {
  const fees = new Map<string, number>();
  if (settings.lateFeeCents <= 0) return fees;
  const latest = new Map<string, BillingLine>();
  for (const line of lines) {
    const prev = latest.get(line.memberId);
    if (!prev || line.createdAt >= prev.createdAt) latest.set(line.memberId, line);
  }
  for (const line of latest.values()) {
    if (line.collectionStatus !== 'unpaid' && line.collectionStatus !== 'reversed') continue;
    if (line.feeCents > 0) continue;
    fees.set(line.memberId, settings.lateFeeCents);
  }
  return fees;
}
