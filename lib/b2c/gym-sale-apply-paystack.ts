/**
 * Apply a verified Paystack gym shop charge (membership / programme).
 */
import {
  loadWalletCompany,
  saveWalletCompanyMeta,
} from '@/lib/b2c/load-company';
import { writeFitgraphToMetadata, readFitgraphFromMetadata } from '@/lib/fitness/fitgraph';
import {
  applyPaidGymSale,
  findGymSaleByRef,
  isGymSalePaystack,
} from '@/lib/fitness/gym-shop';

export { isGymSalePaystack };

export async function applyGymSalePaystack(opts: {
  data: Record<string, unknown>;
  reference: string;
}): Promise<
  | { ok: true; companyId: number; saleId: string; clientId: string }
  | { ok: false; error: string }
> {
  const metaIn =
    opts.data.metadata && typeof opts.data.metadata === 'object'
      ? (opts.data.metadata as Record<string, unknown>)
      : {};
  const companyId = Number(metaIn.company_id || 0);
  if (!Number.isFinite(companyId) || companyId <= 0) {
    return { ok: false, error: 'Missing company_id on gym sale' };
  }

  let lastError = 'Gym sale not found for this reference';
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const company = await loadWalletCompany(companyId);
    if (!company) return { ok: false, error: 'Company not found' };
    const store = readFitgraphFromMetadata(company.meta);
    const existing = findGymSaleByRef(store, opts.reference);
    if (!existing) {
      lastError = 'Gym sale not found for this reference';
      break;
    }
    if (existing.status === 'paid') {
      return {
        ok: true,
        companyId,
        saleId: existing.id,
        clientId: existing.client_id || '',
      };
    }
    const applied = applyPaidGymSale(store, existing, { companyId });
    const { attachCrmToAdvisorPerson } = await import(
      '@/lib/b2c/member-account-ar'
    );
    await attachCrmToAdvisorPerson({
      companyId,
      kind: 'gym',
      person: applied.client,
    });
    const ci = applied.store.clients.findIndex((c) => c.id === applied.client.id);
    if (ci >= 0) applied.store.clients[ci] = applied.client;
    await saveWalletCompanyMeta(
      companyId,
      writeFitgraphToMetadata(company.meta, applied.store)
    );
    const check = await loadWalletCompany(companyId);
    const paid = check
      ? findGymSaleByRef(readFitgraphFromMetadata(check.meta), opts.reference)
      : null;
    if (paid?.status === 'paid') {
      return {
        ok: true,
        companyId,
        saleId: applied.sale.id,
        clientId: applied.client.id,
      };
    }
    lastError = 'Gym sale save raced; retrying';
  }
  return { ok: false, error: lastError };
}
