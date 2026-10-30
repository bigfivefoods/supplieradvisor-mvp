import 'server-only';
import { loadAdvisorStoreForPublicToken } from '@/lib/business/advisor-store-resolve';
import {
  clientMatchesPortalToken,
  FITGRAPH_META_KEY,
  parseCompanyIdFromToken,
  readFitgraphFromMetadata,
} from '@/lib/fitness/fitgraph';
import { companyAllowed } from '@/lib/fitness/netcash/guard';
import { buildMemberStatements, type MonthStatement } from '@/lib/fitness/netcash/member-statement';
import { netcashDeps } from '@/lib/fitness/netcash/server/runtime';

export async function memberStatementsForToken(token: string): Promise<
  | { ok: true; companyId: number; memberId: string; memberName: string; gymName: string; statements: MonthStatement[] }
  | { ok: false; status: number; error: string }
> {
  const clean = String(token || '').trim();
  const companyFromToken = parseCompanyIdFromToken(clean);
  if (!clean || !companyFromToken) {
    return { ok: false, status: 400, error: 'Open this page from your GymAdvisor® member link.' };
  }
  const allowed = companyAllowed(companyFromToken);
  if (!allowed.ok) return { ok: false, status: 403, error: allowed.error };
  const loaded = await loadAdvisorStoreForPublicToken({
    token: clean,
    moduleKey: FITGRAPH_META_KEY,
    read: readFitgraphFromMetadata,
    parseCompanyId: parseCompanyIdFromToken,
  });
  if (!loaded) return { ok: false, status: 404, error: 'This member link is not valid.' };
  if (!companyAllowed(loaded.companyId).ok) {
    return { ok: false, status: 403, error: 'This gym is locked until debit-order go-live is approved.' };
  }
  const client = (loaded.store.clients || []).find((member) => clientMatchesPortalToken(member, clean) && member.active !== false);
  if (!client) return { ok: false, status: 404, error: 'This member link is not valid.' };
  const deps = netcashDeps(String(loaded.store.settings?.brand_name || 'GymAdvisor®'), loaded.companyId);
  const lines = await deps.repo.listMemberLines(loaded.companyId, client.id);
  const own = lines.filter((line) => line.memberId === client.id && line.companyId === loaded.companyId);
  const runIds = new Set(own.map((line) => line.runId));
  const runs = (await deps.repo.listRuns(loaded.companyId)).filter((run) => runIds.has(run.id));
  return {
    ok: true,
    companyId: loaded.companyId,
    memberId: client.id,
    memberName: client.name,
    gymName: String(loaded.store.settings?.brand_name || 'GymAdvisor®'),
    statements: buildMemberStatements(client.id, own, runs),
  };
}
