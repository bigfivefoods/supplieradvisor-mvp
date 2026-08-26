/**
 * Load / save Advisor module stores for workforce invites.
 */
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  defaultPublicSettings as defaultFitPublicSettings,
  readFitgraphFromMetadata,
  writeFitgraphToMetadata,
  FITGRAPH_META_KEY,
  type FitCoach,
  type FitPublicSettings,
} from '@/lib/fitness/fitgraph';
import {
  PHYSIOGRAPH_META_KEY,
  readPhysiographFromMetadata,
  writePhysiographToMetadata,
  type PhysioPractitioner,
} from '@/lib/clinic/physiograph';
import {
  MEDICALGRAPH_META_KEY,
  readMedicalgraphFromMetadata,
  writeMedicalgraphToMetadata,
  type MedicalPractitioner,
} from '@/lib/clinic/medicalgraph';
import {
  VETGRAPH_META_KEY,
  readVetgraphFromMetadata,
  writeVetgraphToMetadata,
} from '@/lib/clinic/vetgraph';
import {
  PSYCHIATRYGRAPH_META_KEY,
  readPsychiatrygraphFromMetadata,
  writePsychiatrygraphToMetadata,
  type PsychiatryPractitioner,
} from '@/lib/clinic/psychiatrygraph';
import {
  DENTALGRAPH_META_KEY,
  defaultDentalPublicSettings,
  readDentalgraphFromMetadata,
  writeDentalgraphToMetadata,
  type DentalPublicSettings,
  type DentalStaff,
  type DentalgraphStore,
} from '@/lib/dental/dentalgraph';
import {
  HIREGRAPH_META_KEY,
  defaultHirePublicSettings,
  readHiregraphFromMetadata,
  writeHiregraphToMetadata,
  type HirePublicSettings,
  type HiregraphStore,
} from '@/lib/hire/hiregraph';
import {
  RETAILGRAPH_META_KEY,
  readRetailgraphFromMetadata,
  writeRetailgraphToMetadata,
  type RetailPublicSettings,
  type RetailgraphStore,
} from '@/lib/retail/retailgraph';
import type {
  AdvisorDeskInviteFields,
  AdvisorPersonInviteFields,
  AdvisorWorkforceModule,
} from '@/lib/services/advisor-workforce';
import {
  loadAdvisorModuleStore,
  saveAdvisorModuleStore,
} from '@/lib/business/company-data';

/** Desk invites carry a partial settings blob; pin required fields from defaults. */
function mergeAdvisorSettings<T extends object>(
  current: T | null | undefined,
  next: AdvisorDeskInviteFields & Record<string, unknown>,
  fallback: T
): T {
  return { ...fallback, ...(current || {}), ...next } as T;
}

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
    .select('id, trading_name, legal_name')
    .eq('id', companyId)
    .maybeSingle();
  if (!prof) return null;
  const brand = String(prof.trading_name || prof.legal_name || 'Advisor');

  if (module === 'fitgraph') {
    const { store } = await loadAdvisorModuleStore(
      companyId,
      FITGRAPH_META_KEY,
      readFitgraphFromMetadata
    );
    return wrap({
      companyId,
      module,
      brand: store.settings?.brand_name || brand,
      settings: store.settings || {},
      people: (store.coaches || []).map(coachToPerson),
      write: async (nextSettings, people) => {
        store.settings = mergeAdvisorSettings<FitPublicSettings>(
          store.settings,
          nextSettings,
          defaultFitPublicSettings()
        );
        for (const p of people) {
          const i = store.coaches.findIndex((c) => c.id === p.id);
          if (i >= 0) store.coaches[i] = personToCoach(store.coaches[i], p);
        }
        await saveAdvisorModuleStore(
          companyId,
          FITGRAPH_META_KEY,
          store,
          writeFitgraphToMetadata
        );
      },
    });
  }

  if (module === 'physiograph') {
    const { store } = await loadAdvisorModuleStore(
      companyId,
      PHYSIOGRAPH_META_KEY,
      readPhysiographFromMetadata
    );
    return wrapClinic(companyId, module, brand, store, {
      key: PHYSIOGRAPH_META_KEY,
      write: writePhysiographToMetadata,
    });
  }
  if (module === 'medicalgraph') {
    const { store } = await loadAdvisorModuleStore(
      companyId,
      MEDICALGRAPH_META_KEY,
      readMedicalgraphFromMetadata
    );
    return wrapClinic(companyId, module, brand, store, {
      key: MEDICALGRAPH_META_KEY,
      write: writeMedicalgraphToMetadata,
    });
  }
  if (module === 'vetgraph') {
    const { store } = await loadAdvisorModuleStore(
      companyId,
      VETGRAPH_META_KEY,
      readVetgraphFromMetadata
    );
    return wrapClinic(companyId, module, brand, store, {
      key: VETGRAPH_META_KEY,
      write: writeVetgraphToMetadata,
    });
  }
  if (module === 'psychiatrygraph') {
    const { store } = await loadAdvisorModuleStore(
      companyId,
      PSYCHIATRYGRAPH_META_KEY,
      readPsychiatrygraphFromMetadata
    );
    return wrapClinic(companyId, module, brand, store, {
      key: PSYCHIATRYGRAPH_META_KEY,
      write: writePsychiatrygraphToMetadata,
    });
  }
  if (module === 'dentalgraph') {
    const { store } = await loadAdvisorModuleStore(
      companyId,
      DENTALGRAPH_META_KEY,
      readDentalgraphFromMetadata
    );
    return wrapDental(companyId, brand, store);
  }
  if (module === 'hiregraph') {
    const { store } = await loadAdvisorModuleStore(
      companyId,
      HIREGRAPH_META_KEY,
      readHiregraphFromMetadata
    );
    return wrap({
      companyId,
      module,
      brand: store.settings?.brand_name || brand,
      settings: store.settings || {},
      people: [],
      write: async (nextSettings) => {
        store.settings = mergeAdvisorSettings<HirePublicSettings>(
          store.settings,
          nextSettings,
          defaultHirePublicSettings()
        );
        await saveAdvisorModuleStore(
          companyId,
          HIREGRAPH_META_KEY,
          store,
          writeHiregraphToMetadata
        );
      },
    });
  }
  const { store } = await loadAdvisorModuleStore(
    companyId,
    RETAILGRAPH_META_KEY,
    readRetailgraphFromMetadata
  );
  return wrap({
    companyId,
    module,
    brand: store.settings?.brand_name || brand,
    settings: store.settings || {},
    people: [],
    write: async (nextSettings) => {
      store.settings = mergeAdvisorSettings<RetailPublicSettings>(
        store.settings,
        nextSettings,
        {}
      );
      await saveAdvisorModuleStore(
        companyId,
        RETAILGRAPH_META_KEY,
        store,
        writeRetailgraphToMetadata
      );
    },
  });
}

function wrap(opts: {
  companyId: number;
  module: AdvisorWorkforceModule;
  brand: string;
  settings: AdvisorDeskInviteFields & Record<string, unknown>;
  people: AdvisorPersonRow[];
  write: (
    settings: AdvisorDeskInviteFields & Record<string, unknown>,
    people: AdvisorPersonRow[]
  ) => Promise<void>;
}): AdvisorWorkforceBundle {
  let settings = { ...opts.settings };
  let people = [...opts.people];
  return {
    companyId: opts.companyId,
    meta: {},
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
      await opts.write(settings, people);
    },
  };
}

type ClinicWorkforceStore = {
  settings?: { brand_name?: string } | null;
  practitioners: Array<
    PhysioPractitioner | MedicalPractitioner | PsychiatryPractitioner
  >;
};

function wrapClinic<TStore extends ClinicWorkforceStore>(
  companyId: number,
  module: AdvisorWorkforceModule,
  brand: string,
  store: TStore,
  io: {
    key: string;
    write: (
      meta: Record<string, unknown>,
      store: TStore
    ) => Record<string, unknown>;
  }
): AdvisorWorkforceBundle {
  return wrap({
    companyId,
    module,
    brand: store.settings?.brand_name || brand,
    settings: store.settings || {},
    people: (store.practitioners || []).map(pracToPerson),
    write: async (nextSettings, people) => {
      store.settings = mergeAdvisorSettings(
        store.settings,
        nextSettings,
        (store.settings || {
          enabled: false,
          public_token: '',
          allow_public_booking: true,
          show_practitioners: true,
          show_pricing: true,
        }) as NonNullable<typeof store.settings>
      );
      for (const p of people) {
        const i = store.practitioners.findIndex((c) => c.id === p.id);
        if (i >= 0) {
          store.practitioners[i] = personToPrac(store.practitioners[i], p);
        }
      }
      await saveAdvisorModuleStore(companyId, io.key, store, io.write);
    },
  });
}

function wrapDental(
  companyId: number,
  brand: string,
  store: DentalgraphStore
): AdvisorWorkforceBundle {
  return wrap({
    companyId,
    module: 'dentalgraph',
    brand: store.settings?.brand_name || brand,
    settings: store.settings || {},
    people: (store.staff || []).map(staffToPerson),
    write: async (nextSettings, people) => {
      store.settings = mergeAdvisorSettings<DentalPublicSettings>(
        store.settings,
        nextSettings,
        defaultDentalPublicSettings()
      );
      for (const p of people) {
        const i = store.staff.findIndex((c) => c.id === p.id);
        if (i >= 0) store.staff[i] = personToStaff(store.staff[i], p);
      }
      await saveAdvisorModuleStore(
        companyId,
        DENTALGRAPH_META_KEY,
        store,
        writeDentalgraphToMetadata
      );
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
