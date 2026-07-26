/**
 * Generate NSNP programme alerts for a school.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

export async function refreshSchoolAlerts(
  supabase: SupabaseClient,
  schoolProfileId: number,
  companyId: number,
  agencyProfileId?: number | null
): Promise<{ created: number; codes: string[] }> {
  const codes: string[] = [];
  const today = new Date();
  const todayS = today.toISOString().slice(0, 10);
  const d3 = new Date(today);
  d3.setDate(d3.getDate() - 3);
  const d3s = d3.toISOString().slice(0, 10);

  // Clear open auto alerts for this school (recompute)
  await supabase
    .from('nsnp_alerts')
    .delete()
    .eq('school_profile_id', schoolProfileId)
    .eq('status', 'open')
    .in('code', [
      'NO_FEEDING_3D',
      'STOCKOUT_RISK',
      'LOW_VERIFY',
      'NON_APPROVED_GRN',
    ]);

  // No feeding in last 3 school-ish days
  const { data: feeding } = await supabase
    .from('school_feeding_days')
    .select('feed_date, served_meals')
    .eq('school_profile_id', schoolProfileId)
    .gte('feed_date', d3s)
    .lte('feed_date', todayS)
    .limit(20);
  const fed = (feeding || []).some((f) => Number(f.served_meals || 0) > 0);
  if (!fed) {
    codes.push('NO_FEEDING_3D');
    await supabase.from('nsnp_alerts').insert({
      school_profile_id: schoolProfileId,
      agency_profile_id: agencyProfileId || null,
      profile_id: companyId,
      severity: 'critical',
      code: 'NO_FEEDING_3D',
      title: 'No feeding logged (3 days)',
      body: 'No meals served recorded in the last 3 days. Log serve-day or mark non-school day.',
      status: 'open',
    });
  }

  // Low stock lines
  const { data: stock } = await supabase
    .from('school_kitchen_stock')
    .select('qty_on_hand, product_name')
    .eq('school_profile_id', schoolProfileId)
    .limit(200);
  const low = (stock || []).filter((s) => Number(s.qty_on_hand || 0) <= 0);
  if (low.length > 0 && (stock || []).length > 0) {
    codes.push('STOCKOUT_RISK');
    await supabase.from('nsnp_alerts').insert({
      school_profile_id: schoolProfileId,
      agency_profile_id: agencyProfileId || null,
      profile_id: companyId,
      severity: 'warn',
      code: 'STOCKOUT_RISK',
      title: `${low.length} stock line(s) at zero`,
      body: low
        .slice(0, 5)
        .map((s) => s.product_name)
        .join(', '),
      status: 'open',
    });
  }

  // Learner verify rate
  const { data: school } = await supabase
    .from('school_profiles')
    .select(
      'learner_count_enrolled, learner_count_verified, primary_agency_profile_id'
    )
    .eq('id', schoolProfileId)
    .maybeSingle();
  const enrolled = Number(school?.learner_count_enrolled || 0);
  const verified = Number(school?.learner_count_verified || 0);
  if (enrolled >= 30 && verified / enrolled < 0.5) {
    codes.push('LOW_VERIFY');
    await supabase.from('nsnp_alerts').insert({
      school_profile_id: schoolProfileId,
      agency_profile_id:
        agencyProfileId ||
        (school?.primary_agency_profile_id
          ? Number(school.primary_agency_profile_id)
          : null),
      profile_id: companyId,
      severity: 'warn',
      code: 'LOW_VERIFY',
      title: 'Learner verification below 50%',
      body: `${verified}/${enrolled} learners school-verified or attested.`,
      status: 'open',
    });
  }

  // Non-approved GRN last 14 days
  const d14 = new Date(today);
  d14.setDate(d14.getDate() - 14);
  const { data: receipts } = await supabase
    .from('school_kitchen_receipts')
    .select('id, compliance_ok')
    .eq('school_profile_id', schoolProfileId)
    .gte('received_at', d14.toISOString().slice(0, 10))
    .eq('compliance_ok', false)
    .limit(20);
  if ((receipts || []).length > 0) {
    codes.push('NON_APPROVED_GRN');
    await supabase.from('nsnp_alerts').insert({
      school_profile_id: schoolProfileId,
      agency_profile_id: agencyProfileId || null,
      profile_id: companyId,
      severity: 'critical',
      code: 'NON_APPROVED_GRN',
      title: 'Non-approved GRN attempts',
      body: `${receipts!.length} non-compliant receipt(s) in 14 days — prize score at risk.`,
      status: 'open',
    });
  }

  return { created: codes.length, codes };
}
