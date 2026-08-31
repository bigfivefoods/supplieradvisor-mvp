/**
 * Dual-write independent contractor coaches / clinicians onto SRM
 * suppliers so each one gets a unique AP sub-account (2180-0000001 …).
 *
 * Employed staff stay on People / payroll (IAS 19) — no AP leaf.
 */
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { loadAdvisorModuleStore } from '@/lib/business/company-data';
import { loadFitgraphMerged } from '@/lib/fitness/fitgraph-io';
import { readPhysiographFromMetadata } from '@/lib/clinic/physiograph';
import { readDentalgraphFromMetadata } from '@/lib/dental/dentalgraph';
import { readMedicalgraphFromMetadata } from '@/lib/clinic/medicalgraph';
import { readPsychiatrygraphFromMetadata } from '@/lib/clinic/psychiatrygraph';
import { readVetgraphFromMetadata } from '@/lib/clinic/vetgraph';
import { readFieldgraphFromMetadata } from '@/lib/agri/fieldgraph';
import { readQuarrygraphFromMetadata } from '@/lib/quarry/quarrygraph';
import { resolveAdvisorEngagement } from '@/lib/services/advisor-workforce';

export const ADVISOR_AP_PREFIX = 'advisor_ap:';

export type AdvisorContractorPerson = {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  engagement?: string | null;
  employment_type?: string | null;
  hr_employee_id?: number | null;
  active?: boolean;
  end_date?: string | null;
  srm_supplier_id?: number | null;
  ap_account_code?: string | null;
};

export function advisorApRefTag(kind: string, refId: string): string {
  return `${ADVISOR_AP_PREFIX}${kind}:${refId}`;
}

export function isAdvisorContractorForAp(
  person: AdvisorContractorPerson
): boolean {
  if (!person?.id || !String(person.name || '').trim()) return false;
  if (person.active === false) return false;
  const end = String(person.end_date || '').slice(0, 10);
  if (end && end < new Date().toISOString().slice(0, 10)) return false;
  // People-directory dual-write (hr_employee_id) is not IAS 19 payroll.
  // Only an explicit employed engagement stays off contractor AP.
  return (
    resolveAdvisorEngagement({
      engagement: person.engagement,
      employment_type: person.employment_type,
    }) === 'contractor'
  );
}

export function collectAdvisorContractorPeople(opts: {
  coaches?: AdvisorContractorPerson[];
  clinics?: Array<{
    kind: string;
    people: AdvisorContractorPerson[];
  }>;
}): Array<{ kind: string; person: AdvisorContractorPerson }> {
  const out: Array<{ kind: string; person: AdvisorContractorPerson }> = [];
  for (const person of opts.coaches || []) {
    if (isAdvisorContractorForAp(person)) {
      out.push({ kind: 'fitgraph_coach', person });
    }
  }
  for (const clinic of opts.clinics || []) {
    for (const person of clinic.people || []) {
      if (isAdvisorContractorForAp(person)) {
        out.push({ kind: clinic.kind, person });
      }
    }
  }
  return out;
}

export async function attachApToAdvisorContractor(opts: {
  companyId: number;
  kind: string;
  person: AdvisorContractorPerson;
}): Promise<number | null> {
  try {
    if (!isAdvisorContractorForAp(opts.person)) return null;
    const row = await ensureAdvisorContractorSupplier({
      companyId: opts.companyId,
      name: opts.person.name,
      email: opts.person.email || null,
      phone: opts.person.phone || null,
      kind: opts.kind,
      refId: opts.person.id,
    });
    if (row?.id) {
      opts.person.srm_supplier_id = row.id;
      if (row.ap_account_code) opts.person.ap_account_code = row.ap_account_code;
      return row.id;
    }
  } catch (err) {
    console.warn('[advisor-ap] attach', err);
  }
  return null;
}

export async function ensureAdvisorContractorSupplier(opts: {
  companyId: number;
  name: string;
  email?: string | null;
  phone?: string | null;
  kind: string;
  refId: string;
  skipPartyGl?: boolean;
}): Promise<{
  id: number;
  name: string;
  ap_account_code: string | null;
} | null> {
  const supabase = getSupabaseServer();
  const email = String(opts.email || '')
    .trim()
    .toLowerCase();
  const phone = String(opts.phone || '').trim() || null;
  const tag = advisorApRefTag(opts.kind, opts.refId);
  const name = String(opts.name || '').trim() || 'Contractor';

  if (email) {
    const { data: hits } = await supabase
      .from('srm_suppliers')
      .select('id, trading_name, email, notes, metadata')
      .eq('profile_id', opts.companyId)
      .ilike('email', email)
      .limit(5);
    const match = (hits || [])[0];
    if (match?.id) {
      await stampSupplierTag(opts.companyId, Number(match.id), tag, match);
      return finishAdvisorSupplier(
        opts.companyId,
        {
          id: Number(match.id),
          name: String(match.trading_name || name),
        },
        opts.skipPartyGl
      );
    }
  }

  const tagged = await supabase
    .from('srm_suppliers')
    .select('id, trading_name, notes, metadata')
    .eq('profile_id', opts.companyId)
    .ilike('notes', `%${tag}%`)
    .limit(1)
    .maybeSingle();
  if (tagged.data?.id) {
    return finishAdvisorSupplier(
      opts.companyId,
      {
        id: Number(tagged.data.id),
        name: String(tagged.data.trading_name || name),
      },
      opts.skipPartyGl
    );
  }

  const { data: named } = await supabase
    .from('srm_suppliers')
    .select('id, trading_name, notes, metadata')
    .eq('profile_id', opts.companyId)
    .ilike('trading_name', name)
    .limit(5);
  const nameHit = (named || []).find(
    (row) =>
      String(row.trading_name || '').trim().toLowerCase() === name.toLowerCase()
  );
  if (nameHit?.id) {
    await stampSupplierTag(opts.companyId, Number(nameHit.id), tag, nameHit);
    return finishAdvisorSupplier(
      opts.companyId,
      {
        id: Number(nameHit.id),
        name: String(nameHit.trading_name || name),
      },
      opts.skipPartyGl
    );
  }

  const payload: Record<string, unknown> = {
    profile_id: opts.companyId,
    trading_name: name,
    legal_name: name,
    contact_name: name,
    email: email || null,
    phone,
    status: 'active',
    category: 'Professional services',
    country: 'South Africa',
    notes: tag,
    tags: ['contractor', 'advisor'],
    metadata: {
      advisor_ap: true,
      advisor_kind: opts.kind,
      advisor_person_id: opts.refId,
      party_kind: 'contractor',
    },
    updated_at: new Date().toISOString(),
  };
  let { data, error } = await supabase
    .from('srm_suppliers')
    .insert(payload)
    .select('id, trading_name')
    .maybeSingle();
  if (error && /column|schema cache|does not exist/i.test(error.message || '')) {
    delete payload.tags;
    delete payload.category;
    delete payload.contact_name;
    delete payload.phone;
    delete payload.country;
    const retry = await supabase
      .from('srm_suppliers')
      .insert(payload)
      .select('id, trading_name')
      .maybeSingle();
    data = retry.data;
    error = retry.error;
  }
  if (error || !data?.id) {
    console.warn('[advisor-ap] supplier', error?.message);
    return null;
  }
  return finishAdvisorSupplier(
    opts.companyId,
    {
      id: Number(data.id),
      name: String(data.trading_name || name),
    },
    opts.skipPartyGl
  );
}

async function stampSupplierTag(
  companyId: number,
  id: number,
  tag: string,
  row: { notes?: string | null; metadata?: unknown }
): Promise<void> {
  const notes = String(row.notes || '');
  const meta =
    row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata)
      ? { ...(row.metadata as Record<string, unknown>) }
      : {};
  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (!notes.includes(tag)) {
    patch.notes = notes ? `${notes}\n${tag}` : tag;
  }
  if (!meta.advisor_ap) {
    patch.metadata = { ...meta, advisor_ap: true, party_kind: 'contractor' };
  }
  if (Object.keys(patch).length > 1) {
    const supabase = getSupabaseServer();
    await supabase
      .from('srm_suppliers')
      .update(patch)
      .eq('id', id)
      .eq('profile_id', companyId);
  }
}

async function finishAdvisorSupplier(
  companyId: number,
  supplier: { id: number; name: string },
  _skipFullCoa?: boolean
): Promise<{
  id: number;
  name: string;
  ap_account_code: string | null;
}> {
  let ap_account_code: string | null = null;
  try {
    const { ensureSupplierApLeaf, supplierApAccountCode } = await import(
      '@/lib/accounting/party-gl-accounts'
    );
    const leaf = await ensureSupplierApLeaf({
      profileId: companyId,
      supplierId: supplier.id,
      name: supplier.name,
      contractor: true,
    });
    ap_account_code = leaf?.code || supplierApAccountCode(supplier.id) || null;
  } catch (err) {
    console.warn('[advisor-ap] AP leaf', err);
  }
  return { ...supplier, ap_account_code };
}

export async function syncAdvisorContractorsToSuppliers(
  companyId: number
): Promise<{ people: number; created: number }> {
  if (!Number.isFinite(companyId) || companyId <= 0) {
    return { people: 0, created: 0 };
  }
  const [gym, physio, dental, medical, psychiatry, vet, field, quarry] =
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
        'fieldgraph',
        readFieldgraphFromMetadata
      ).catch(() => null),
      loadAdvisorModuleStore(
        companyId,
        'quarrygraph',
        readQuarrygraphFromMetadata
      ).catch(() => null),
    ]);

  const people = collectAdvisorContractorPeople({
    coaches: gym?.store.coaches || [],
    clinics: [
      { kind: 'physiograph_practitioner', people: physio?.store.practitioners || [] },
      { kind: 'dentalgraph_staff', people: dental?.store.staff || [] },
      { kind: 'medicalgraph_practitioner', people: medical?.store.practitioners || [] },
      {
        kind: 'psychiatrygraph_practitioner',
        people: psychiatry?.store.practitioners || [],
      },
      { kind: 'vetgraph_practitioner', people: vet?.store.practitioners || [] },
      { kind: 'fieldgraph_gang', people: field?.store.gangs || [] },
      { kind: 'quarrygraph_crew', people: quarry?.store.crews || [] },
    ],
  });
  if (!people.length) return { people: 0, created: 0 };

  const supabase = getSupabaseServer();
  const { data: suppliers } = await supabase
    .from('srm_suppliers')
    .select('id, email, notes')
    .eq('profile_id', companyId)
    .limit(5000);
  const tagged = new Set(
    (suppliers || [])
      .map((s) => String(s.notes || ''))
      .join('\n')
      .split('\n')
      .map((t) => t.trim())
      .filter((t) => t.startsWith(ADVISOR_AP_PREFIX))
  );
  const missing = people.filter((row) => {
    const tag = advisorApRefTag(row.kind, row.person.id);
    if (tagged.has(tag)) return false;
    return true;
  });

  let created = 0;
  const chunk = 12;
  for (let i = 0; i < missing.length; i += chunk) {
    const slice = missing.slice(i, chunk + i);
    const ids = await Promise.all(
      slice.map((row) =>
        ensureAdvisorContractorSupplier({
          companyId,
          name: row.person.name,
          email: row.person.email || null,
          phone: row.person.phone || null,
          kind: row.kind,
          refId: row.person.id,
        })
      )
    );
    created += ids.filter((id) => id?.id).length;
  }
  return { people: people.length, created };
}
