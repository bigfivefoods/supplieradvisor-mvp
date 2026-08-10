/**
 * Resolve and save identity for token-authenticated service people.
 */
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  FITGRAPH_CLIENT_TOKENS_KEY,
  FITGRAPH_COACH_TOKENS_KEY,
  parseCompanyIdFromToken,
  readFitgraphFromMetadata,
  writeFitgraphToMetadata,
  type FitClient,
  type FitCoach,
  type FitgraphStore,
} from '@/lib/fitness/fitgraph';
import {
  PHYSIOGRAPH_PATIENT_TOKENS_KEY,
  parsePhysioCompanyIdFromToken,
  readPhysiographFromMetadata,
  writePhysiographToMetadata,
  type PhysioPatient,
  type PhysiographStore,
} from '@/lib/clinic/physiograph';
import {
  DENTALGRAPH_PATIENT_TOKENS_KEY,
  parseDentalCompanyIdFromToken,
  readDentalgraphFromMetadata,
  writeDentalgraphToMetadata,
} from '@/lib/dental/dentalgraph';
import {
  MEDICALGRAPH_PATIENT_TOKENS_KEY,
  parseMedicalCompanyIdFromToken,
  readMedicalgraphFromMetadata,
  writeMedicalgraphToMetadata,
} from '@/lib/clinic/medicalgraph';
import {
  PSYCHIATRYGRAPH_PATIENT_TOKENS_KEY,
  parsePsychiatryCompanyIdFromToken,
  readPsychiatrygraphFromMetadata,
  writePsychiatrygraphToMetadata,
} from '@/lib/clinic/psychiatrygraph';
import {
  type PersonIdentityVerification,
  type ServiceIdentityModule,
  type ServiceIdentityRole,
  readIdentity,
} from '@/lib/identity/person-verification';

export type IdentityPerson = {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  id_number?: string;
  identity?: PersonIdentityVerification;
  medical?: { id_number?: string };
};

export type ResolvedIdentityPerson = {
  companyId: number;
  module: ServiceIdentityModule;
  role: ServiceIdentityRole;
  person: IdentityPerson;
  /** Mutate store then call save() */
  applyIdentity: (next: PersonIdentityVerification, extras?: {
    id_number?: string;
    name?: string;
  }) => void;
  save: () => Promise<void>;
  reloadPortalHint?: string;
};

function personFromClient(c: FitClient): IdentityPerson {
  return {
    id: c.id,
    name: c.name,
    email: c.email,
    phone: c.phone,
    id_number: c.id_number,
    identity: readIdentity(c.identity),
  };
}

function personFromCoach(c: FitCoach): IdentityPerson {
  return {
    id: c.id,
    name: c.name,
    email: c.email,
    phone: c.phone,
    id_number: c.id_number,
    identity: readIdentity(c.identity),
  };
}

function personFromPatient(p: {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  medical?: { id_number?: string };
  identity?: unknown;
}): IdentityPerson {
  return {
    id: p.id,
    name: p.name,
    email: p.email,
    phone: p.phone,
    id_number: p.medical?.id_number,
    identity: readIdentity(p.identity),
    medical: p.medical,
  };
}

async function loadProfile(companyId: number) {
  const supabase = getSupabaseServer();
  const { data: prof } = await supabase
    .from('profiles')
    .select('id, metadata')
    .eq('id', companyId)
    .maybeSingle();
  if (!prof) return null;
  const meta =
    prof.metadata && typeof prof.metadata === 'object'
      ? { ...(prof.metadata as Record<string, unknown>) }
      : {};
  return { supabase, companyId: Number(prof.id), meta };
}

async function writeMeta(
  companyId: number,
  meta: Record<string, unknown>
) {
  const supabase = getSupabaseServer();
  const { error } = await supabase
    .from('profiles')
    .update({
      metadata: meta,
      updated_at: new Date().toISOString(),
    })
    .eq('id', companyId);
  if (error) throw new Error(error.message);
}

export async function resolveIdentityPerson(opts: {
  module: ServiceIdentityModule;
  role: ServiceIdentityRole;
  token: string;
}): Promise<ResolvedIdentityPerson | null> {
  const token = opts.token.trim();
  if (!token || token.length < 8) return null;

  // ── Fit member ──────────────────────────────────────────
  if (opts.module === 'fitgraph' && opts.role === 'member') {
    let companyId = parseCompanyIdFromToken(token);
    if (companyId == null) {
      // best-effort: try token map via limited scan is heavy; require embedded company when possible
      const supabase = getSupabaseServer();
      const { data: rows } = await supabase
        .from('profiles')
        .select('id, metadata')
        .not('metadata', 'is', null)
        .limit(80);
      for (const row of rows || []) {
        const meta =
          row.metadata && typeof row.metadata === 'object'
            ? (row.metadata as Record<string, unknown>)
            : {};
        const map = meta[FITGRAPH_CLIENT_TOKENS_KEY];
        if (map && typeof map === 'object' && token in (map as object)) {
          companyId = Number(row.id);
          break;
        }
        const store = readFitgraphFromMetadata(meta);
        if (store.clients.some((c) => c.portal_token === token)) {
          companyId = Number(row.id);
          break;
        }
      }
    }
    if (companyId == null) return null;
    const loaded = await loadProfile(companyId);
    if (!loaded) return null;
    let store = readFitgraphFromMetadata(loaded.meta);
    const client = store.clients.find((c) => c.portal_token === token);
    if (!client || client.active === false) return null;
    return {
      companyId: loaded.companyId,
      module: 'fitgraph',
      role: 'member',
      person: personFromClient(client),
      applyIdentity(next, extras) {
        const i = store.clients.findIndex((c) => c.id === client.id);
        if (i < 0) return;
        store.clients[i] = {
          ...store.clients[i],
          identity: next,
          id_number:
            extras?.id_number !== undefined
              ? extras.id_number
              : store.clients[i].id_number,
          name: extras?.name || store.clients[i].name,
          updated_at: new Date().toISOString(),
        };
      },
      async save() {
        const nextMeta = writeFitgraphToMetadata(loaded.meta, store);
        await writeMeta(loaded.companyId, nextMeta);
      },
    };
  }

  // ── Fit coach ───────────────────────────────────────────
  if (opts.module === 'fitgraph' && opts.role === 'coach') {
    let companyId = parseCompanyIdFromToken(token);
    if (companyId == null) {
      const supabase = getSupabaseServer();
      const { data: rows } = await supabase
        .from('profiles')
        .select('id, metadata')
        .not('metadata', 'is', null)
        .limit(80);
      for (const row of rows || []) {
        const meta =
          row.metadata && typeof row.metadata === 'object'
            ? (row.metadata as Record<string, unknown>)
            : {};
        const map = meta[FITGRAPH_COACH_TOKENS_KEY];
        if (map && typeof map === 'object' && token in (map as object)) {
          companyId = Number(row.id);
          break;
        }
        const store = readFitgraphFromMetadata(meta);
        if (store.coaches.some((c) => c.portal_token === token)) {
          companyId = Number(row.id);
          break;
        }
      }
    }
    if (companyId == null) return null;
    const loaded = await loadProfile(companyId);
    if (!loaded) return null;
    let store = readFitgraphFromMetadata(loaded.meta);
    const coach = store.coaches.find((c) => c.portal_token === token);
    if (!coach || coach.active === false) return null;
    return {
      companyId: loaded.companyId,
      module: 'fitgraph',
      role: 'coach',
      person: personFromCoach(coach),
      applyIdentity(next, extras) {
        const i = store.coaches.findIndex((c) => c.id === coach.id);
        if (i < 0) return;
        store.coaches[i] = {
          ...store.coaches[i],
          identity: next,
          id_number:
            extras?.id_number !== undefined
              ? extras.id_number
              : store.coaches[i].id_number,
          name: extras?.name || store.coaches[i].name,
        };
      },
      async save() {
        const nextMeta = writeFitgraphToMetadata(loaded.meta, store);
        await writeMeta(loaded.companyId, nextMeta);
      },
    };
  }

  // ── Clinic / dental patients ────────────────────────────
  type PatientStoreBundle =
    | {
        module: 'physiograph';
        read: typeof readPhysiographFromMetadata;
        write: typeof writePhysiographToMetadata;
      }
    | {
        module: 'dentalgraph';
        read: typeof readDentalgraphFromMetadata;
        write: typeof writeDentalgraphToMetadata;
      }
    | {
        module: 'medicalgraph';
        read: typeof readMedicalgraphFromMetadata;
        write: typeof writeMedicalgraphToMetadata;
      }
    | {
        module: 'psychiatrygraph';
        read: typeof readPsychiatrygraphFromMetadata;
        write: typeof writePsychiatrygraphToMetadata;
      };

  const patientBundles: PatientStoreBundle[] = [
    {
      module: 'physiograph',
      read: readPhysiographFromMetadata,
      write: writePhysiographToMetadata,
    },
    {
      module: 'dentalgraph',
      read: readDentalgraphFromMetadata,
      write: writeDentalgraphToMetadata,
    },
    {
      module: 'medicalgraph',
      read: readMedicalgraphFromMetadata,
      write: writeMedicalgraphToMetadata,
    },
    {
      module: 'psychiatrygraph',
      read: readPsychiatrygraphFromMetadata,
      write: writePsychiatrygraphToMetadata,
    },
  ];

  if (opts.role === 'patient') {
    const bundle = patientBundles.find((b) => b.module === opts.module);
    if (!bundle) return null;

    let companyId: number | null = null;
    if (opts.module === 'physiograph') companyId = parsePhysioCompanyIdFromToken(token);
    else if (opts.module === 'dentalgraph') companyId = parseDentalCompanyIdFromToken(token);
    else if (opts.module === 'medicalgraph') companyId = parseMedicalCompanyIdFromToken(token);
    else if (opts.module === 'psychiatrygraph')
      companyId = parsePsychiatryCompanyIdFromToken(token);

    if (companyId == null) {
      const supabase = getSupabaseServer();
      const { data: rows } = await supabase
        .from('profiles')
        .select('id, metadata')
        .not('metadata', 'is', null)
        .limit(80);
      const tokenKey =
        opts.module === 'physiograph'
          ? PHYSIOGRAPH_PATIENT_TOKENS_KEY
          : opts.module === 'dentalgraph'
            ? DENTALGRAPH_PATIENT_TOKENS_KEY
            : opts.module === 'medicalgraph'
              ? MEDICALGRAPH_PATIENT_TOKENS_KEY
              : PSYCHIATRYGRAPH_PATIENT_TOKENS_KEY;
      for (const row of rows || []) {
        const meta =
          row.metadata && typeof row.metadata === 'object'
            ? (row.metadata as Record<string, unknown>)
            : {};
        const map = meta[tokenKey];
        if (map && typeof map === 'object' && token in (map as object)) {
          companyId = Number(row.id);
          break;
        }
        const store = bundle.read(meta) as {
          patients: Array<{ portal_token?: string | null }>;
        };
        if (store.patients?.some((p) => p.portal_token === token)) {
          companyId = Number(row.id);
          break;
        }
      }
    }
    if (companyId == null) return null;
    const loaded = await loadProfile(companyId);
    if (!loaded) return null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let store: any = bundle.read(loaded.meta);
    const patient = (store.patients as Array<{
      id: string;
      name: string;
      email?: string;
      phone?: string;
      portal_token?: string | null;
      active?: boolean;
      medical?: { id_number?: string };
      identity?: unknown;
    }>).find((p) => p.portal_token === token);
    if (!patient || patient.active === false) return null;

    return {
      companyId: loaded.companyId,
      module: bundle.module,
      role: 'patient',
      person: personFromPatient(patient),
      applyIdentity(next, extras) {
        const i = store.patients.findIndex(
          (p: { id: string }) => p.id === patient.id
        );
        if (i < 0) return;
        const prev = store.patients[i];
        const medical = {
          ...(prev.medical || {}),
          ...(extras?.id_number !== undefined
            ? { id_number: extras.id_number || undefined }
            : {}),
        };
        store.patients[i] = {
          ...prev,
          identity: next,
          medical,
          name: extras?.name || prev.name,
          updated_at: new Date().toISOString(),
        };
      },
      async save() {
        const nextMeta = bundle.write(loaded.meta, store);
        await writeMeta(loaded.companyId, nextMeta);
      },
    };
  }

  return null;
}

/** Resolve by company + person id (webhook path). */
export async function resolveIdentityPersonByIds(opts: {
  module: ServiceIdentityModule;
  role: ServiceIdentityRole;
  companyId: number;
  personId: string;
}): Promise<ResolvedIdentityPerson | null> {
  // Re-use token resolution by loading store directly
  const loaded = await loadProfile(opts.companyId);
  if (!loaded) return null;

  if (opts.module === 'fitgraph' && opts.role === 'member') {
    let store = readFitgraphFromMetadata(loaded.meta);
    const client = store.clients.find((c) => c.id === opts.personId);
    if (!client) return null;
    return {
      companyId: loaded.companyId,
      module: 'fitgraph',
      role: 'member',
      person: personFromClient(client),
      applyIdentity(next, extras) {
        const i = store.clients.findIndex((c) => c.id === client.id);
        if (i < 0) return;
        store.clients[i] = {
          ...store.clients[i],
          identity: next,
          id_number:
            extras?.id_number !== undefined
              ? extras.id_number
              : store.clients[i].id_number,
        };
      },
      async save() {
        await writeMeta(
          loaded.companyId,
          writeFitgraphToMetadata(loaded.meta, store)
        );
      },
    };
  }

  if (opts.module === 'fitgraph' && opts.role === 'coach') {
    let store = readFitgraphFromMetadata(loaded.meta);
    const coach = store.coaches.find((c) => c.id === opts.personId);
    if (!coach) return null;
    return {
      companyId: loaded.companyId,
      module: 'fitgraph',
      role: 'coach',
      person: personFromCoach(coach),
      applyIdentity(next, extras) {
        const i = store.coaches.findIndex((c) => c.id === coach.id);
        if (i < 0) return;
        store.coaches[i] = {
          ...store.coaches[i],
          identity: next,
          id_number:
            extras?.id_number !== undefined
              ? extras.id_number
              : store.coaches[i].id_number,
        };
      },
      async save() {
        await writeMeta(
          loaded.companyId,
          writeFitgraphToMetadata(loaded.meta, store)
        );
      },
    };
  }

  const patientReaders: Record<
    string,
    {
      read: (m: Record<string, unknown>) => { patients: Array<Record<string, unknown>> };
      write: (m: Record<string, unknown>, s: unknown) => Record<string, unknown>;
    }
  > = {
    physiograph: {
      read: readPhysiographFromMetadata as never,
      write: writePhysiographToMetadata as never,
    },
    dentalgraph: {
      read: readDentalgraphFromMetadata as never,
      write: writeDentalgraphToMetadata as never,
    },
    medicalgraph: {
      read: readMedicalgraphFromMetadata as never,
      write: writeMedicalgraphToMetadata as never,
    },
    psychiatrygraph: {
      read: readPsychiatrygraphFromMetadata as never,
      write: writePsychiatrygraphToMetadata as never,
    },
  };
  const pr = patientReaders[opts.module];
  if (opts.role === 'patient' && pr) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let store: any = pr.read(loaded.meta);
    const patient = store.patients.find(
      (p: { id: string }) => p.id === opts.personId
    );
    if (!patient) return null;
    return {
      companyId: loaded.companyId,
      module: opts.module,
      role: 'patient',
      person: personFromPatient(patient as never),
      applyIdentity(next, extras) {
        const i = store.patients.findIndex(
          (p: { id: string }) => p.id === patient.id
        );
        if (i < 0) return;
        const prev = store.patients[i];
        store.patients[i] = {
          ...prev,
          identity: next,
          medical: {
            ...(prev.medical || {}),
            ...(extras?.id_number !== undefined
              ? { id_number: extras.id_number || undefined }
              : {}),
          },
          updated_at: new Date().toISOString(),
        };
      },
      async save() {
        await writeMeta(loaded.companyId, pr.write(loaded.meta, store));
      },
    };
  }

  return null;
}
