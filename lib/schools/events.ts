/**
 * Soft activity events for NSNP (in-app notifications / audit feed).
 */
import type { SupabaseClient } from '@supabase/supabase-js';

export async function logNsnpEvent(
  supabase: SupabaseClient,
  opts: {
    companyId: number;
    targetCompanyId?: number | null;
    schoolProfileId?: number | null;
    kind: string;
    title: string;
    body?: string;
    href?: string;
    metadata?: Record<string, unknown>;
  }
): Promise<void> {
  try {
    await supabase.from('nsnp_activity_events').insert({
      company_id: opts.companyId,
      target_company_id: opts.targetCompanyId ?? null,
      school_profile_id: opts.schoolProfileId ?? null,
      kind: opts.kind,
      title: opts.title,
      body: opts.body || null,
      href: opts.href || null,
      metadata: opts.metadata || {},
    });
  } catch {
    /* table may not exist yet */
  }

  // Best-effort in-app notification for counterparty
  if (opts.targetCompanyId && opts.targetCompanyId !== opts.companyId) {
    try {
      await supabase.from('notifications').insert({
        profile_id: opts.targetCompanyId,
        title: opts.title,
        body: opts.body || opts.title,
        type: opts.kind,
        link: opts.href || '/dashboard/schools/deliveries',
        read: false,
      });
    } catch {
      /* soft — notifications schema varies */
    }
  }
}
