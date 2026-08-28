/**
 * Dual-write every gym/clinic/retail person onto CRM so CoA can
 * create nested AR leaves under 1180 Members & patients (AR).
 */
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { loadAdvisorModuleStore } from '@/lib/business/company-data';
import { loadFitgraphMerged } from '@/lib/fitness/fitgraph-io';
import { readPhysiographFromMetadata } from '@/lib/clinic/physiograph';
import { readDentalgraphFromMetadata } from '@/lib/dental/dentalgraph';
import { readMedicalgraphFromMetadata } from '@/lib/clinic/medicalgraph';
import { readPsychiatrygraphFromMetadata } from '@/lib/clinic/psychiatrygraph';
import { readVetgraphFromMetadata } from '@/lib/clinic/vetgraph';
import { readRetailgraphFromMetadata } from '@/lib/retail/retailgraph';
import {
  collectAdvisorCustomerPeople,
  unsyncedAdvisorCustomerPeople,
} from '@/lib/core-os/customer-360';
import { ensureAdvisorCrmCustomer } from '@/lib/b2c/member-account-ar';

export async function syncAdvisorModulePeopleToCrm(
  companyId: number
): Promise<{ people: number; created: number }> {
  if (!Number.isFinite(companyId) || companyId <= 0) {
    return { people: 0, created: 0 };
  }
  const [gym, physio, dental, medical, psychiatry, vet, retail] =
    await Promise.all([
      loadFitgraphMerged(companyId).catch(() => null),
      loadAdvisorModuleStore(
        companyId,
        'physiograph',
        readPhysiographFromMetadata
      ).catch(() => null),
      loadAdvisorModuleStore(
        companyId,
        'dentalgraph',
        readDentalgraphFromMetadata
      ).catch(() => null),
      loadAdvisorModuleStore(
        companyId,
        'medicalgraph',
        readMedicalgraphFromMetadata
      ).catch(() => null),
      loadAdvisorModuleStore(
        companyId,
        'psychiatrygraph',
        readPsychiatrygraphFromMetadata
      ).catch(() => null),
      loadAdvisorModuleStore(
        companyId,
        'vetgraph',
        readVetgraphFromMetadata
      ).catch(() => null),
      loadAdvisorModuleStore(
        companyId,
        'retailgraph',
        readRetailgraphFromMetadata
      ).catch(() => null),
    ]);

  const people = collectAdvisorCustomerPeople({
    gymClients: gym?.store.clients || [],
    clinics: [
      { module: 'physiograph', patients: physio?.store.patients || [] },
      { module: 'dentalgraph', patients: dental?.store.patients || [] },
      { module: 'medicalgraph', patients: medical?.store.patients || [] },
      { module: 'psychiatrygraph', patients: psychiatry?.store.patients || [] },
      { module: 'vetgraph', patients: vet?.store.patients || [] },
    ],
    retailCustomers: (retail?.store.customers || []).map((c) => ({
      id: c.id,
      name: c.name,
      email: c.email ?? null,
      phone: c.phone ?? null,
      crm_customer_id: c.crm_customer_id ?? null,
    })),
  });
  if (!people.length) return { people: 0, created: 0 };

  const supabase = getSupabaseServer();
  const { data: customers } = await supabase
    .from('customers')
    .select('id, email, notes')
    .eq('profile_id', companyId)
    .limit(5000);
  const missing = unsyncedAdvisorCustomerPeople(people, customers || []);
  let created = 0;
  const chunk = 12;
  for (let i = 0; i < missing.length; i += chunk) {
    const slice = missing.slice(i, i + chunk);
    const ids = await Promise.all(
      slice.map((row) =>
        ensureAdvisorCrmCustomer({
          companyId,
          name: row.person.name,
          email: row.person.email || null,
          phone: row.person.phone || null,
          kind: row.kind,
          refId: row.person.id,
          skipPartyGl: true,
        })
      )
    );
    created += ids.filter((id) => id?.id).length;
  }
  return { people: people.length, created };
}
