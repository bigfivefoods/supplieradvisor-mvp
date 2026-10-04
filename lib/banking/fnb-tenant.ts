/**
 * FNB Integration Channel env (FNB_CLIENT_ID / secret / account) belongs to
 * Big Five Foods on supplieradvisor.com only — profile 102.
 * Other companies must not see or use that feed.
 */
import { banklinkConfig } from './providers/banklink';
import { fnbConfig } from './providers/fnb';

export const FNB_INTEGRATION_COMPANY_ID = 102;

export function isFnbIntegrationCompany(companyId: number): boolean {
  const n = Math.trunc(Number(companyId) || 0);
  if (!(n > 0)) return false;
  const override = Math.trunc(Number(process.env.FNB_COMPANY_ID || '') || 0);
  if (override > 0) return n === override;
  return n === FNB_INTEGRATION_COMPANY_ID;
}

export function fnbConfiguredForCompany(companyId: number): boolean {
  return isFnbIntegrationCompany(companyId) && fnbConfig().configured;
}

export function bankingProviderStatus(companyId: number) {
  const fnbOn = fnbConfiguredForCompany(companyId);
  const cfg = banklinkConfig();
  const fnb = fnbConfig();
  return {
    mode: fnbOn ? 'fnb' : cfg.mode,
    configured: fnbOn || cfg.configured,
    name: fnbOn ? 'FNB Integration Channel' : 'BankLink',
    docs: fnbOn
      ? 'https://www.fnb.co.za/integration-channel/index.html'
      : 'https://www.banklink.co.za/docs',
    fnb: {
      configured: fnbOn,
      hasAccountNumber: fnbOn && Boolean(fnb.accountNumber),
      statementPath: fnbOn ? fnb.statementPath || null : null,
    },
    banklink: {
      configured: cfg.configured,
      mode: cfg.mode,
    },
  };
}
