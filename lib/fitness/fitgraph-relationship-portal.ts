/**
 * Helpers to attach relationship summary onto member / coach portal payloads.
 * Keeps fitgraph.ts smaller; call from API routes when building portal JSON.
 */

import type { FitClient, FitgraphStore } from '@/lib/fitness/fitgraph';
import { buildRelationshipSummary } from '@/lib/fitness/fitgraph-relationship';

/** Merge relationship layer into an existing member portal payload object. */
export function withMemberRelationship(
  store: FitgraphStore,
  client: FitClient,
  base: Record<string, unknown>
): Record<string, unknown> {
  const rel = buildRelationshipSummary(store, client.id, client.coach_id);
  return {
    ...base,
    relationship: {
      health: rel.health,
      journey_preview: rel.journey_preview,
      active_goals: rel.active_goals,
      ledger: rel.ledger,
      stories_count: rel.stories_count,
    },
  };
}

/** Compact health badges for coach roster / client list rows. */
export function clientHealthBadge(
  store: FitgraphStore,
  clientId: string,
  coachId?: string | null
): { score: number; level: string; label: string } {
  const { health } = buildRelationshipSummary(store, clientId, coachId);
  return {
    score: health.score,
    level: health.level,
    label: health.label,
  };
}
