/**
 * Structured audit events for critical mutations.
 * Soft-fails into activity_log (never blocks the primary request).
 */
import { logActivity } from '@/lib/customers/access';

export type AuditAction =
  | 'period.lock'
  | 'period.unlock'
  | 'bank.allocate'
  | 'bank.unallocate'
  | 'bank.auto_match'
  | 'journal.post'
  | 'journal.reverse'
  | 'qa.inspection.create'
  | 'qa.inspection.update'
  | 'qa.hold.ship_blocked'
  | 'escrow.onchain'
  | 'team.invite'
  | 'recall.export'
  | 'override.qa_hold';

export async function auditLog(params: {
  companyId: number;
  actorUserId?: string | null;
  action: AuditAction | string;
  entityType?: string;
  entityId?: string | number | null;
  summary: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await logActivity({
    profile_id: params.companyId,
    actor_user_id: params.actorUserId ?? null,
    action: params.action,
    entity_type: params.entityType,
    entity_id:
      params.entityId != null && params.entityId !== ''
        ? String(params.entityId)
        : undefined,
    summary: params.summary,
    metadata: {
      ...(params.metadata || {}),
      audited_at: new Date().toISOString(),
    },
  });
}
