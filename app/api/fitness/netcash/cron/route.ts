import { NextRequest, NextResponse } from 'next/server';
import { assertCronSecret } from '@/lib/auth/api-auth';
import { companyAllowed } from '@/lib/fitness/netcash/guard';
import { pollBilling, runScheduled } from '@/lib/fitness/netcash/service';
import { loadBillable, netcashDeps, publicError } from '@/lib/fitness/netcash/server/runtime';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { rateLimit } from '@/lib/security/rate-limit';

export async function GET(request: NextRequest) {
  const cron = assertCronSecret(request);
  if (!cron.ok) return cron.response;
  const limited = rateLimit({ key: 'gym-netcash-cron', limit: 4, windowMs: 60_000 });
  if (!limited.ok) return NextResponse.json({ error: 'Too many requests', code: 'RATE_LIMIT' }, { status: 429 });
  try {
    const db = getSupabaseServer();
    const { data, error } = await db.from('gym_netcash_settings').select('company_id').limit(500);
    if (error) {
      return NextResponse.json({ error: 'Debit order tables are not installed yet.', code: 'MIGRATION' }, { status: 503 });
    }
    const results: Array<{ companyId: number; ok: boolean; error?: string }> = [];
    for (const row of data || []) {
      const companyId = Number((row as { company_id: number }).company_id);
      if (!companyAllowed(companyId).ok) continue;
      try {
        const loaded = await loadBillable(companyId);
        const deps = netcashDeps(loaded.gymName, companyId);
        const preview = await runScheduled(deps, { companyId, members: loaded.members });
        if (preview.run.status === 'submitted' || preview.run.status === 'polling') {
          await pollBilling(deps, { companyId, runId: preview.run.id, actor: 'cron' });
        }
        const open = (await deps.repo.listRuns(companyId)).filter((run) => run.status === 'submitted' || run.status === 'polling');
        for (const run of open) {
          await pollBilling(deps, { companyId, runId: run.id, actor: 'cron' });
        }
        results.push({ companyId, ok: true });
      } catch (err) {
        results.push({ companyId, ok: false, error: err instanceof Error ? err.message : 'failed' });
      }
    }
    return NextResponse.json({ ok: true, companies: results.length });
  } catch (error) {
    return publicError(error);
  }
}
