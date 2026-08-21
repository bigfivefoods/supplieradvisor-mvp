/**
 * Server load of a company-branded member PWA.
 */
import { isAdvisorModuleKey, loadAdvisorModuleStore } from '@/lib/business/company-data';
import { resolveAdvisorCompanyId } from '@/lib/business/advisor-store-resolve';
import {
  ADVISOR_PWA_INDEX_KEYS,
  buildAdvisorPwaBrand,
  isAdvisorPwaModule,
  settingsFromAdvisorMeta,
  type AdvisorPwaBrand,
} from '@/lib/advisors/member-pwa';

export async function loadAdvisorPwaBrand(
  moduleRaw: string,
  tokenRaw: string
): Promise<AdvisorPwaBrand | null> {
  if (!isAdvisorPwaModule(moduleRaw) || !isAdvisorModuleKey(moduleRaw)) return null;
  const token = String(tokenRaw || '').trim();
  if (token.length < 8) return null;
  const companyId = await resolveAdvisorCompanyId({
    token,
    moduleKey: moduleRaw,
    indexKeys: ADVISOR_PWA_INDEX_KEYS[moduleRaw],
  });
  if (!companyId) return null;
  const loaded = await loadAdvisorModuleStore(companyId, moduleRaw, (meta) =>
    settingsFromAdvisorMeta(moduleRaw, meta)
  );
  const settings = loaded.store || {};
  const storedToken = String(settings.public_token || '').trim();
  if (storedToken && storedToken !== token) return null;
  return buildAdvisorPwaBrand({
    module: moduleRaw,
    publicToken: storedToken || token,
    companyId,
    settings,
  });
}
