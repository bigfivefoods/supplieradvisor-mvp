/**
 * Load / save Advisor module stores for workforce invites.
 */
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  readFitgraphFromMetadata,
  writeFitgraphToMetadata,
  type FitCoach,
  type FitgraphStore,
} from '@/lib/fitness/fitgraph';
import {
  readPhysiographFromMetadata,
  writePhysiographToMetadata,
  type PhysioPractitioner,
  type PhysiographStore,
} from '@/lib/clinic/physiograph';
import {
  readMedicalgraphFromMetadata,
  writeMedicalgraphToMetadata,
  type MedicalPractitioner,
  type MedicalgraphStore,
} from '@/lib/clinic/medicalgraph';
import {
  readPsychiatrygraphFromMetadata,
  writePsychiatrygraphToMetadata,
  type PsychiatryPractitioner,
  type PsychiatrygraphStore,
} from '@/lib/clinic/psychiatrygraph';
import {
  readDentalgraphFromMetadata,
  writeDentalgraphToMetadata,
  type DentalStaff,
  type DentalgraphStore,
} from '@/lib/dental/dentalgraph';
import {
  readHiregraphFromMetadata,
  writeHiregraphToMetadata,
  type HiregraphStore,
} from '@/lib/hire/hiregraph';
import {
  readRetailgraphFromMetadata,
  writeRetailgraphToMetadata,
  type RetailgraphStore,
} from '@/lib/retail/retailgraph';
import type {
  AdvisorDeskInviteFields,
  AdvisorPersonInviteFields,
  AdvisorWorkforceModule,
} from '@/lib/services/advisor-workforce';

export type AdvisorPersonRow = AdvisorPersonInviteFields & {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  portal_token?: string | null;
  hr_employee_id?: number | null;
  active?: boolean;
};

export type AdvisorWorkforceBundle = {
  companyId: number;
  meta: Record<string, unknown>;
  module: AdvisorWorkforceModule;
  brand: string;
  settings: AdvisorDeskInviteFields & Record<string, unknown>;
  people: AdvisorPersonRow[];
  applyDesk: (patch: AdvisorDeskInviteFields) => void;
  applyPerson: (id: string, patch: Partial<AdvisorPersonRow>) => AdvisorPersonRow | null;
  persist: () => Promise<void>;
};

export async function loadAdvisorWorkforce(
  companyId: number,
  module: AdvisorWorkforceModule
): Promise<AdvisorWorkforceBundle | null> {
  const supabase = getSupabaseServer();
  const { data: prof } = await supabase
    .from('profiles')
    .select('id, metadata, trading_name, legal_name')
    .eq('id', companyId)
    .maybeSingle();
  if (!prof) return null;
  const meta =
    prof.metadata && typeof prof.metadata === 'object'
      ? { ...(prof.metadata as Record<string, unknown>) }
      : {};
  const brand = String(prof.trading_name || prof.legal_name || 'Advisor');

  if (module === 'fitgraph') {
    const store = readFitgraphFromMetadata(meta);
    return wrap({
      companyId,
      meta,
      module,
      brand: store.settings?.brand_name || brand,
      settings: store.settings || {},
      people: (store.coaches || []).map(coachToPerson),
      write: (nextSettings, people) => {
        store.settings = { ...(store.settings || {}), ...nextSettings };
        for (const p of people) {
          const i = store.coaches.findIndex((c) => c.id === p.id);
          if (i >= 0) store.coaches[i] = personToCoach(store.coaches[i], p);
        }
        return writeFitgraphToMetadata(meta, store);
      },
    });
  }

  if (module === 'physiograph') {
    const store = readPhysiographFromMetadata(meta);
    return wrapClinic(companyId, meta, module, brand, store, {
      read: readPhysiographFromMetadata,
      write: writePhysiographToMetadata,
    });
  }
  if (module === 'medicalgraph') {
    const store = readMedicalgraphFromMetadata(meta);
    return wrapClinic(companyId, meta, module, brand, store, {
      read: readMedicalgraphFromMetadata,
      write: writeMedicalgraphToMetadata,
    });
  }
  if (module === 'psychiatrygraph') {
    const store = readPsychiatrygraphFromMetadata(meta);
    return wrapClinic(companyId, meta, module, brand, store, {
      read: readPsychiatrygraphFromMetadata,
      write: writePsychiatrygraphToMetadata,
    });
  }
  if (module === 'dentalgraph') {
    const store = readDentalgraphFromMetadata(meta);
    return wrapDental(companyId, meta, brand, store);
  }
  if (module === 'hiregraph') {
    const store = readHiregraphFromMetadata(meta);
    return wrap({
      companyId,
      meta,
      module,
      brand: store.settings?.brand_name || brand,
      settings: store.settings || {},
      people: [],
      write: (nextSettings) => {
        store.settings = { ...(store.settings || {}), ...nextSettings };
        return writeHiregraphToMetadata(meta, store);
      },
    });
  }
  const store = readRetailgraphFromMetadata(meta);
  return wrap({
    companyId,
    meta,
    module,
    brand: store.settings?.brand_name || brand,
    settings: store.settings || {},
    people: [],
    write: (nextSettings) => {
      store.settings = { ...(store.settings || {}), ...nextSettings };
      return writeRetailgraphToMetadata(meta, store);
    },
  });
}

function wrap(opts: {
  companyId: number;
  meta: Record<string, unknown>;
  module: AdvisorWorkforceModule;
  brand: string;
  settings: AdvisorDeskInviteFields & Record<string, unknown>;
  people: AdvisorPersonRow[];
  write: (
    settings: AdvisorDeskInviteFields & Record<string, unknown>,
    people: AdvisorPersonRow[]
  ) => Record<string, unknown>;
}): AdvisorWorkforceBundle {
  let settings = { ...opts.settings };
  let people = [...opts.people];
  let meta = opts.meta;
  return {
    companyId: opts.companyId,
    meta,
    module: opts.module,
    brand: opts.brand,
    get settings() {
      return settings;
    },
    get people() {
      return people;
    },
    applyDesk(patch) {
      settings = { ...settings, ...patch };
    },
    applyPerson(id, patch) {
      const i = people.findIndex((p) => p.id === id);
      if (i < 0) return null;
      people[i] = { ...people[i], ...patch };
      return people[i];
    },
    async persist() {
      meta = opts.write(settings, people);
      const supabase = getSupabaseServer();
      const { error } = await supabase
        .from('profiles')
        .update({ metadata: meta, updated_at: new Date().toISOString() })
        .eq('id', opts.companyId);
      if (error) throw new Error(error.message);
    },
  };
}

function wrapClinic(
  companyId: number,
  meta: Record<string, unknown>,
  module: AdvisorWorkforceModule,
  brand: string,
  store:
    | PhysiographStore
    | MedicalgraphStore
    | PsychiatrygraphStore,
  io: {
    write: (
      meta: Record<string, unknown>,
      store:
        | PhysiographStore
        | MedicalgraphStore
        | PsychiatrygraphStore
    ) => Record<string, unknown>;
    read: (meta: Record<string, unknown>) => typeof store;
  }
): AdvisorWorkforceBundle {
  return wrap({
    companyId,
    meta,
    module,
    brand: store.settings?.brand_name || brand,
    settings: store.settings || {},
    people: (store.practitioners || []).map(pracToPerson),
    write: (nextSettings, people) => {
      store.settings = { ...(store.settings || {}), ...nextSettings };
      for (const p of people) {
        const i = store.practitioners.findIndex((c) => c.id === p.id);
        if (i >= 0) {
          store.practitioners[i] = personToPrac(store.practitioners[i], p);
        }
      }
      return io.write(meta, store);
    },
  });
}

function wrapDental(
  companyId: number,
  meta: Record<string, unknown>,
  brand: string,
  store: DentalgraphStore
): AdvisorWorkforceBundle {
  return wrap({
    companyId,
    meta,
    module: 'dentalgraph',
    brand: store.settings?.brand_name || brand,
    settings: store.settings || {},
    people: (store.staff || []).map(staffToPerson),
    write: (nextSettings, people) => {
      store.settings = { ...(store.settings || {}), ...nextSettings };
      for (const p of people) {
        const i = store.staff.findIndex((c) => c.id === p.id);
        if (i >= 0) store.staff[i] = personToStaff(store.staff[i], p);
      }
      return writeDentalgraphToMetadata(meta, store);
    },
  });
}

function coachToPerson(c: FitCoach): AdvisorPersonRow {
  return {
    id: c.id,
    name: c.name,
    email: c.email,
    phone: c.phone,
    portal_token: c.portal_token,
    hr_employee_id: c.hr_employee_id,
    active: c.active,
    engagement: c.engagement,
    work_invite_token: c.work_invite_token,
    work_invite_status: c.work_invite_status,
    work_invite_email: c.work_invite_email,
    work_invite_sent_at: c.work_invite_sent_at,
    work_invite_accepted_at: c.work_invite_accepted_at,
    work_team_member_id: c.work_team_member_id,
  };
}

function personToCoach(prev: FitCoach, p: AdvisorPersonRow): FitCoach {
  return {
    ...prev,
    email: p.email ?? prev.email,
    engagement: p.engagement ?? prev.engagement,
    work_invite_token: p.work_invite_token,
    work_invite_status: p.work_invite_status,
    work_invite_email: p.work_invite_email,
    work_invite_sent_at: p.work_invite_sent_at,
    work_invite_accepted_at: p.work_invite_accepted_at,
    work_team_member_id: p.work_team_member_id,
    portal_token: p.portal_token ?? prev.portal_token,
  };
}

function pracToPerson(
  c: PhysioPractitioner | MedicalPractitioner | PsychiatryPractitioner
): AdvisorPersonRow {
  return {
    id: c.id,
    name: c.name,
    email: c.email,
    phone: c.phone,
    portal_token: c.portal_token,
    hr_employee_id: c.hr_employee_id,
    active: c.active,
    engagement: c.engagement,
    work_invite_token: c.work_invite_token,
    work_invite_status: c.work_invite_status,
    work_invite_email: c.work_invite_email,
    work_invite_sent_at: c.work_invite_sent_at,
    work_invite_accepted_at: c.work_invite_accepted_at,
    work_team_member_id: c.work_team_member_id,
  };
}

function personToPrac<
  T extends PhysioPractitioner | MedicalPractitioner | PsychiatryPractitioner,
>(prev: T, p: AdvisorPersonRow): T {
  return {
    ...prev,
    email: p.email ?? prev.email,
    engagement: p.engagement ?? prev.engagement,
    work_invite_token: p.work_invite_token,
    work_invite_status: p.work_invite_status,
    work_invite_email: p.work_invite_email,
    work_invite_sent_at: p.work_invite_sent_at,
    work_invite_accepted_at: p.work_invite_accepted_at,
    work_team_member_id: p.work_team_member_id,
    portal_token: p.portal_token ?? prev.portal_token,
  };
}

function staffToPerson(c: DentalStaff): AdvisorPersonRow {
  return {
    id: c.id,
    name: c.name,
    email: c.email,
    phone: c.phone,
    portal_token: c.portal_token,
    hr_employee_id: c.hr_employee_id,
    active: c.active,
    engagement: c.engagement,
    work_invite_token: c.work_invite_token,
    work_invite_status: c.work_invite_status,
    work_invite_email: c.work_invite_email,
    work_invite_sent_at: c.work_invite_sent_at,
    work_invite_accepted_at: c.work_invite_accepted_at,
    work_team_member_id: c.work_team_member_id,
  };
}

function personToStaff(prev: DentalStaff, p: AdvisorPersonRow): DentalStaff {
  return {
    ...prev,
    email: p.email ?? prev.email,
    engagement: p.engagement ?? prev.engagement,
    work_invite_token: p.work_invite_token,
    work_invite_status: p.work_invite_status,
    work_invite_email: p.work_invite_email,
    work_invite_sent_at: p.work_invite_sent_at,
    work_invite_accepted_at: p.work_invite_accepted_at,
    work_team_member_id: p.work_team_member_id,
    portal_token: p.portal_token ?? prev.portal_token,
  };
}
