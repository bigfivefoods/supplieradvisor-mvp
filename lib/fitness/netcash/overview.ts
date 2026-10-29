import type { BillingLine, BillingRun } from '@/lib/fitness/netcash/types';

export type ReasonSlice = { code: string; label: string; count: number; cents: number };

export type CollectionsOverview = {
  expectedCents: number;
  collectedCents: number;
  unpaidCents: number;
  unpaidRateBps: number;
  memberCount: number;
  reasons: ReasonSlice[];
  upcoming: {
    runId: string;
    actionDate: string;
    status: string;
    expectedCents: number;
    memberCount: number;
    note: string;
  } | null;
};

function latestAttempt(lines: BillingLine[]): BillingLine[] {
  const map = new Map<string, BillingLine>();
  for (const line of lines) {
    const key = `${line.runId}:${line.memberId}`;
    const prev = map.get(key);
    if (!prev || line.attempt >= prev.attempt) map.set(key, line);
  }
  return [...map.values()];
}

export function summariseCollections(runs: BillingRun[], lines: BillingLine[]): CollectionsOverview {
  const current = latestAttempt(lines);
  const collected = current.filter((line) => line.collectionStatus === 'paid').reduce((sum, line) => sum + line.totalCents, 0);
  const unpaid = current
    .filter((line) => line.collectionStatus === 'unpaid' || line.collectionStatus === 'reversed')
    .reduce((sum, line) => sum + line.totalCents, 0);
  const expected = current
    .filter((line) => line.collectionStatus !== 'skipped' && line.collectionStatus !== 'review')
    .reduce((sum, line) => sum + line.totalCents, 0);
  const reasons = new Map<string, ReasonSlice>();
  for (const line of lines) {
    if (!line.netcashReasonCode || line.netcashReasonCode === '00') continue;
    const current = reasons.get(line.netcashReasonCode) || {
      code: line.netcashReasonCode,
      label: line.netcashReasonText || line.netcashReasonCode,
      count: 0,
      cents: 0,
    };
    current.count += 1;
    current.cents += line.totalCents;
    reasons.set(line.netcashReasonCode, current);
  }
  const open = [...runs]
    .filter((run) => run.status === 'preview' || run.status === 'submitted' || run.status === 'polling')
    .sort((a, b) => a.actionDate.localeCompare(b.actionDate));
  const next = open[0];
  const decided = collected + unpaid;
  return {
    expectedCents: expected,
    collectedCents: collected,
    unpaidCents: unpaid,
    unpaidRateBps: decided > 0 ? Math.round((unpaid * 10000) / decided) : 0,
    memberCount: new Set(current.map((line) => line.memberId)).size,
    reasons: [...reasons.values()].sort((a, b) => b.cents - a.cents),
    upcoming: next
      ? {
          runId: next.id,
          actionDate: next.actionDate,
          status: next.status,
          expectedCents: next.expectedCents,
          memberCount: next.memberCount,
          note: next.actionDateNote,
        }
      : null,
  };
}
