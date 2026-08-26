/**
 * Load / save clinic Advisor stores by module key.
 */
import { saveAdvisorModuleStore } from '@/lib/business/company-data';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  isClinicModule,
  type ClinicModuleKey,
  type ClinicMemberStore,
} from '@/lib/services/advisor-member-calendar';
import {
  readPhysiographFromMetadata,
  writePhysiographToMetadata,
  newId as physioNewId,
} from '@/lib/clinic/physiograph';
import {
  readDentalgraphFromMetadata,
  writeDentalgraphToMetadata,
  newId as dentalNewId,
} from '@/lib/dental/dentalgraph';
import {
  readMedicalgraphFromMetadata,
  writeMedicalgraphToMetadata,
  newId as medicalNewId,
} from '@/lib/clinic/medicalgraph';
import {
  readPsychiatrygraphFromMetadata,
  writePsychiatrygraphToMetadata,
  newId as psychNewId,
} from '@/lib/clinic/psychiatrygraph';
import {
  readVetgraphFromMetadata,
  writeVetgraphToMetadata,
  newId as vetNewId,
} from '@/lib/clinic/vetgraph';

export async function loadClinicModuleStore(
  companyId: number,
  module: ClinicModuleKey
): Promise<ClinicMemberStore> {
  const supabase = getSupabaseServer();
  const { data } = await supabase
    .from('profiles')
    .select('metadata')
    .eq('id', companyId)
    .maybeSingle();
  const meta =
    data?.metadata && typeof data.metadata === 'object'
      ? (data.metadata as Record<string, unknown>)
      : {};
  if (module === 'physiograph') return readPhysiographFromMetadata(meta);
  if (module === 'dentalgraph') return readDentalgraphFromMetadata(meta);
  if (module === 'medicalgraph') return readMedicalgraphFromMetadata(meta);
  if (module === 'vetgraph') return readVetgraphFromMetadata(meta);
  return readPsychiatrygraphFromMetadata(meta);
}

export async function saveClinicModuleStore(
  companyId: number,
  module: ClinicModuleKey,
  store: ClinicMemberStore
) {
  if (module === 'physiograph') {
    await saveAdvisorModuleStore(
      companyId,
      'physiograph',
      store as never,
      writePhysiographToMetadata
    );
    return;
  }
  if (module === 'dentalgraph') {
    await saveAdvisorModuleStore(
      companyId,
      'dentalgraph',
      store as never,
      writeDentalgraphToMetadata
    );
    return;
  }
  if (module === 'medicalgraph') {
    await saveAdvisorModuleStore(
      companyId,
      'medicalgraph',
      store as never,
      writeMedicalgraphToMetadata
    );
    return;
  }
  if (module === 'vetgraph') {
    await saveAdvisorModuleStore(
      companyId,
      'vetgraph',
      store as never,
      writeVetgraphToMetadata
    );
    return;
  }
  await saveAdvisorModuleStore(
    companyId,
    'psychiatrygraph',
    store as never,
    writePsychiatrygraphToMetadata
  );
}

export function clinicNewId(module: ClinicModuleKey, prefix: string) {
  if (module === 'physiograph') return physioNewId(prefix);
  if (module === 'dentalgraph') return dentalNewId(prefix);
  if (module === 'medicalgraph') return medicalNewId(prefix);
  if (module === 'vetgraph') return vetNewId(prefix);
  return psychNewId(prefix);
}

export function parseClinicModule(
  raw: string | null | undefined
): ClinicModuleKey | null {
  const m = String(raw || '').trim();
  return isClinicModule(m) ? m : null;
}
