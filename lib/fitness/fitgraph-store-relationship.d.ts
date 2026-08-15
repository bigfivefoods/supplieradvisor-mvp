/**
 * Ambient extension: optional relationship fields on FitgraphStore.
 * Runtime arrays are stored in company metadata.fitgraph alongside sessions, etc.
 * See docs/product/gymadvisor-relationship.md and lib/fitness/fitgraph-relationship.ts.
 */

import type {
  FitConsentShare,
  FitGoal,
  FitJourneyEvent,
  FitMemberStory,
} from '@/lib/fitness/fitgraph-relationship';

declare module '@/lib/fitness/fitgraph' {
  interface FitgraphStore {
    /** Structured member goals (shared with assigned coach) */
    goals?: FitGoal[];
    /** Explicit journey / progress timeline events */
    journey_events?: FitJourneyEvent[];
    /** Member progress stories (voice + reputation) */
    member_stories?: FitMemberStory[];
    /** Cross-advisor consent grants (POPIA) */
    consent_shares?: FitConsentShare[];
  }
}

export {};
