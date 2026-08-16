/**
 * GymAdvisor movement library + training programmes.
 * Stored on profiles.metadata.fitgraph (movements[], programmes[]).
 * Client-safe — upload lives in movement-upload.ts.
 */

export const MOVEMENT_CATEGORIES = [
  'Squat',
  'Hinge',
  'Lunge',
  'Push',
  'Pull',
  'Carry',
  'Core',
  'Olympic',
  'Plyometric',
  'Conditioning',
  'Mobility',
  'Isolation',
  'Other',
] as const;

export type FitProgrammeKind = 'class' | 'personal_pt' | 'both';

export type FitMovement = {
  id: string;
  name: string;
  /** Short 1–2 sentence summary */
  overview?: string;
  /** Full coaching notes — setup, cues, faults, scales */
  details?: string;
  description?: string;
  /** Coaching notes for the clip — what the video shows / cues */
  video_description?: string;
  image_url?: string | null;
  video_url?: string | null;
  category?: string;
  equipment?: string;
  muscles?: string;
  level?: 'beginner' | 'intermediate' | 'advanced' | string;
  /** Catalog code, e.g. SYS_MOV_BACK_SQUAT */
  code?: string;
  /** Built-in GymAdvisor catalog item */
  system?: boolean;
  coach_id?: string | null;
  active?: boolean;
  created_at: string;
  updated_at?: string;
};

export type FitProgrammeItem = {
  id: string;
  movement_id: string;
  sets?: number | null;
  reps?: string | null;
  rest_sec?: number | null;
  tempo?: string | null;
  notes?: string;
  sort?: number;
};

export type FitProgramme = {
  id: string;
  name: string;
  description?: string;
  coach_id?: string | null;
  kind: FitProgrammeKind;
  class_type_ids?: string[];
  session_ids?: string[];
  /** Coach’s own training plan (personal time / self PT) */
  personal_for_coach?: boolean;
  items: FitProgrammeItem[];
  active?: boolean;
  created_at: string;
  updated_at?: string;
};

export type FitHydratedProgrammeItem = FitProgrammeItem & {
  movement: FitMovement | null;
};

export type FitHydratedProgramme = Omit<FitProgramme, 'items'> & {
  items: FitHydratedProgrammeItem[];
};

export type FitSessionProgrammeRef = {
  id: string;
  class_type_id?: string | null;
  coach_id?: string | null;
  session_kind?: string | null;
  programme_id?: string | null;
};

export function normalizeProgrammeKind(raw: unknown): FitProgrammeKind {
  const v = String(raw || '').toLowerCase();
  if (v === 'personal_pt' || v === 'personal' || v === 'pt' || v === 'self') {
    return 'personal_pt';
  }
  if (v === 'both') return 'both';
  return 'class';
}

export function programmeKindLabel(kind: FitProgrammeKind): string {
  if (kind === 'personal_pt') return 'Personal training';
  if (kind === 'both') return 'Class + personal';
  return 'Class';
}

export function videoEmbedSrc(url?: string | null): {
  src: string;
  iframe: boolean;
} | null {
  const u = String(url || '').trim();
  if (!u) return null;
  const yt =
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([A-Za-z0-9_-]{6,})/i.exec(
      u
    );
  if (yt) {
    return {
      src: `https://www.youtube.com/embed/${yt[1]}`,
      iframe: true,
    };
  }
  const vimeo = /vimeo\.com\/(?:video\/)?(\d+)/i.exec(u);
  if (vimeo) {
    return {
      src: `https://player.vimeo.com/video/${vimeo[1]}`,
      iframe: true,
    };
  }
  return { src: u, iframe: false };
}

export function hydrateProgramme(
  programme: FitProgramme,
  movements: FitMovement[]
): FitHydratedProgramme {
  const byId = new Map(movements.map((m) => [m.id, m]));
  const items = [...(programme.items || [])]
    .sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0))
    .map((item) => ({
      ...item,
      movement: byId.get(item.movement_id) || null,
    }));
  return { ...programme, items };
}

export function movementsForCoach(
  movements: FitMovement[],
  coachId: string
): FitMovement[] {
  return movements.filter(
    (m) =>
      m.active !== false &&
      (!m.coach_id || m.coach_id === coachId)
  );
}

export function programmesForCoach(
  programmes: FitProgramme[],
  coachId: string
): FitProgramme[] {
  return programmes.filter(
    (p) =>
      p.active !== false &&
      (!p.coach_id || p.coach_id === coachId)
  );
}

export function resolveProgrammeForSession(
  programmes: FitProgramme[],
  session: FitSessionProgrammeRef
): FitProgramme | null {
  const active = programmes.filter((p) => p.active !== false);
  const byId = session.programme_id
    ? active.find((p) => p.id === session.programme_id)
    : undefined;
  if (byId) return byId;

  const onSession = active.find((p) =>
    (p.session_ids || []).includes(session.id)
  );
  if (onSession) return onSession;

  const kind = String(session.session_kind || 'class');
  if (
    (kind === 'coach_personal' || kind === 'private_pt') &&
    session.coach_id
  ) {
    const personal = active.find(
      (p) =>
        p.personal_for_coach === true &&
        p.coach_id === session.coach_id &&
        (p.kind === 'personal_pt' || p.kind === 'both')
    );
    if (personal) return personal;
  }

  if (session.class_type_id) {
    const onType = active.find(
      (p) =>
        (p.class_type_ids || []).includes(session.class_type_id!) &&
        (p.kind === 'class' || p.kind === 'both')
    );
    if (onType) return onType;
  }
  return null;
}

export function memberFacingProgramme(
  programme: FitHydratedProgramme | null
): FitHydratedProgramme | null {
  if (!programme) return null;
  if (programme.kind === 'personal_pt' && programme.personal_for_coach) {
    return null;
  }
  return programme;
}

export function parseProgrammeItems(raw: unknown): FitProgrammeItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((row, i) => {
      const r = (row || {}) as Record<string, unknown>;
      const movementId = String(r.movement_id || '').trim();
      if (!movementId) return null;
      return {
        id: String(r.id || `itm_${i}_${movementId}`),
        movement_id: movementId,
        sets:
          r.sets != null && r.sets !== ''
            ? Math.max(1, Number(r.sets) || 1)
            : null,
        reps: r.reps != null && String(r.reps).trim() ? String(r.reps) : null,
        rest_sec:
          r.rest_sec != null && r.rest_sec !== ''
            ? Math.max(0, Number(r.rest_sec) || 0)
            : null,
        tempo:
          r.tempo != null && String(r.tempo).trim()
            ? String(r.tempo)
            : null,
        notes:
          r.notes != null && String(r.notes).trim()
            ? String(r.notes)
            : undefined,
        sort: r.sort != null ? Number(r.sort) || i : i,
      } satisfies FitProgrammeItem;
    })
    .filter((x): x is FitProgrammeItem => Boolean(x));
}

export function parseStringIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return [...new Set(raw.map((x) => String(x || '').trim()).filter(Boolean))];
}

export function upsertMovement(
  list: FitMovement[],
  rec: Record<string, unknown>,
  now: string,
  newId: (prefix: string) => string
): FitMovement {
  const id = String(rec.id || newId('mov'));
  const i = list.findIndex((m) => m.id === id);
  const prev = i >= 0 ? list[i] : null;
  const row: FitMovement = {
    id,
    name: String(rec.name || prev?.name || 'Movement').trim() || 'Movement',
    overview:
      rec.overview != null ? String(rec.overview) : prev?.overview,
    details:
      rec.details != null ? String(rec.details) : prev?.details,
    description:
      rec.description != null
        ? String(rec.description)
        : rec.details != null
          ? String(rec.details)
          : prev?.description,
    video_description:
      rec.video_description != null
        ? String(rec.video_description)
        : prev?.video_description,
    image_url:
      rec.image_url !== undefined
        ? rec.image_url
          ? String(rec.image_url)
          : null
        : prev?.image_url ?? null,
    video_url:
      rec.video_url !== undefined
        ? rec.video_url
          ? String(rec.video_url)
          : null
        : prev?.video_url ?? null,
    category:
      rec.category != null ? String(rec.category) : prev?.category,
    equipment:
      rec.equipment != null ? String(rec.equipment) : prev?.equipment,
    muscles: rec.muscles != null ? String(rec.muscles) : prev?.muscles,
    level: rec.level != null ? String(rec.level) : prev?.level,
    code: rec.code != null ? String(rec.code) : prev?.code,
    system:
      rec.system !== undefined ? rec.system === true : prev?.system === true,
    coach_id:
      rec.coach_id !== undefined
        ? rec.coach_id
          ? String(rec.coach_id)
          : null
        : prev?.coach_id ?? null,
    active:
      rec.active !== undefined ? rec.active !== false : prev?.active !== false,
    created_at: prev?.created_at || now,
    updated_at: now,
  };
  if (i >= 0) list[i] = row;
  else list.push(row);
  return row;
}

export function upsertProgramme(
  list: FitProgramme[],
  rec: Record<string, unknown>,
  now: string,
  newId: (prefix: string) => string
): FitProgramme {
  const id = String(rec.id || newId('prg'));
  const i = list.findIndex((p) => p.id === id);
  const prev = i >= 0 ? list[i] : null;
  const row: FitProgramme = {
    id,
    name: String(rec.name || prev?.name || 'Programme').trim() || 'Programme',
    description:
      rec.description != null
        ? String(rec.description)
        : prev?.description,
    coach_id:
      rec.coach_id !== undefined
        ? rec.coach_id
          ? String(rec.coach_id)
          : null
        : prev?.coach_id ?? null,
    kind:
      rec.kind != null
        ? normalizeProgrammeKind(rec.kind)
        : prev?.kind || 'class',
    class_type_ids:
      rec.class_type_ids !== undefined
        ? parseStringIds(rec.class_type_ids)
        : prev?.class_type_ids || [],
    session_ids:
      rec.session_ids !== undefined
        ? parseStringIds(rec.session_ids)
        : prev?.session_ids || [],
    personal_for_coach:
      rec.personal_for_coach !== undefined
        ? rec.personal_for_coach === true
        : prev?.personal_for_coach === true,
    items:
      rec.items !== undefined
        ? parseProgrammeItems(rec.items)
        : prev?.items || [],
    active:
      rec.active !== undefined ? rec.active !== false : prev?.active !== false,
    created_at: prev?.created_at || now,
    updated_at: now,
  };
  if (i >= 0) list[i] = row;
  else list.push(row);
  return row;
}

export function removeMovementFromProgrammes(
  programmes: FitProgramme[],
  movementId: string
): void {
  for (const p of programmes) {
    p.items = (p.items || []).filter((it) => it.movement_id !== movementId);
  }
}

export function clearProgrammeFromSessions(
  sessions: Array<{ programme_id?: string | null }>,
  programmeId: string
): void {
  for (const s of sessions) {
    if (s.programme_id === programmeId) s.programme_id = null;
  }
  // also drop from other programmes' session_ids is handled by caller
}


