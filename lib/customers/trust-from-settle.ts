/**
 * Nudge trust_score after settle events (claim confirm / invoice paid).
 * Soft-fail always.
 */
import { getSupabaseServer } from '@/lib/supabase/server-client';

export async function bumpTrustOnSettle(opts: {
  sellerProfileId: number;
  buyerProfileId?: number | null;
  delta?: number;
  reason: string;
}): Promise<void> {
  const delta = opts.delta ?? 1;
  const supabase = getSupabaseServer();

  async function bump(profileId: number, label: string) {
    if (!profileId || profileId <= 0) return;
    try {
      const { data: prof } = await supabase
        .from('profiles')
        .select('id, trust_score')
        .eq('id', profileId)
        .maybeSingle();
      if (!prof) return;
      const prev =
        prof.trust_score != null && Number.isFinite(Number(prof.trust_score))
          ? Number(prof.trust_score)
          : 50;
      const next = Math.min(100, Math.max(0, Math.round(prev + delta)));
      await supabase
        .from('profiles')
        .update({
          trust_score: next,
          updated_at: new Date().toISOString(),
        })
        .eq('id', profileId);
      try {
        await supabase.from('activity_log').insert({
          profile_id: profileId,
          actor_user_id: 'system:trust-settle',
          action: 'trust.settle_bump',
          entity_type: 'profiles',
          entity_id: String(profileId),
          summary: `Trust ${prev} → ${next} (${label}: ${opts.reason})`,
          metadata: { prev, next, delta, reason: opts.reason },
        });
      } catch {
        /* soft */
      }
    } catch {
      /* soft */
    }
  }

  await bump(opts.sellerProfileId, 'seller');
  if (opts.buyerProfileId) {
    await bump(Number(opts.buyerProfileId), 'buyer');
  }
}
