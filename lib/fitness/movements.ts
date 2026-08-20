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
  /** Strength · Power · Mobility · Conditioning … */
  modality?: string;
  muscle_group?: string;
  movement_pattern?: string;
  /** Strength / Bodyweight / Timed / Distance */
  scoring?: string;
  tags?: string[];
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

/** 1 = Monday … 7 = Sunday */
export type FitProgrammeWeekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export const PROGRAMME_WEEKDAYS: Array<{
  n: FitProgrammeWeekday;
  label: string;
  short: string;
}> = [
  { n: 1, label: 'Mon', short: 'M' },
  { n: 2, label: 'Tue', short: 'T' },
  { n: 3, label: 'Wed', short: 'W' },
  { n: 4, label: 'Thu', short: 'T' },
  { n: 5, label: 'Fri', short: 'F' },
  { n: 6, label: 'Sat', short: 'S' },
  { n: 7, label: 'Sun', short: 'S' },
];

/** One training day on the programme calendar (week × weekday). */
export type FitProgrammeBlock = {
  id: string;
  week: number;
  weekday: FitProgrammeWeekday;
  title?: string;
  /** Coach intent / how to run this day */
  notes?: string;
  items: FitProgrammeItem[];
};

export type FitProgramme = {
  id: string;
  name: string;
  description?: string;
  /** How to follow this plan (pacing, equipment, who it is for) */
  follow_notes?: string;
  coach_id?: string | null;
  kind: FitProgrammeKind;
  class_type_ids?: string[];
  session_ids?: string[];
  /** Coach’s own training plan (personal time / self PT) */
  personal_for_coach?: boolean;
  /** Duration in weeks (calendar length). */
  weeks?: number | null;
  /** Week × weekday sessions. Empty = use `items` as week 1 Monday. */
  blocks?: FitProgrammeBlock[];
  items: FitProgrammeItem[];
  /** When set and public, members can buy this programme */
  price_zar?: number | null;
  public?: boolean;
  billing?: 'once' | 'monthly' | 'pack';
  active?: boolean;
  created_at: string;
  updated_at?: string;
};

export type FitHydratedProgrammeItem = FitProgrammeItem & {
  movement: FitMovement | null;
};

export type FitHydratedProgrammeBlock = Omit<FitProgrammeBlock, 'items'> & {
  items: FitHydratedProgrammeItem[];
};

export type FitHydratedProgramme = Omit<FitProgramme, 'items' | 'blocks'> & {
  items: FitHydratedProgrammeItem[];
  blocks: FitHydratedProgrammeBlock[];
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

export function hydrateProgrammeItems(
  items: FitProgrammeItem[] | undefined,
  movements: FitMovement[]
): FitHydratedProgrammeItem[] {
  const byId = new Map(movements.map((m) => [m.id, m]));
  return [...(items || [])]
    .sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0))
    .map((item) => ({
      ...item,
      movement: byId.get(item.movement_id) || null,
    }));
}

export function hydrateProgrammeBlock(
  block: FitProgrammeBlock,
  movements: FitMovement[]
): FitHydratedProgrammeBlock {
  return { ...block, items: hydrateProgrammeItems(block.items, movements) };
}

export function parseProgrammeBlocks(raw: unknown): FitProgrammeBlock[] {
  if (!Array.isArray(raw)) return [];
  const out: FitProgrammeBlock[] = [];
  raw.forEach((row, i) => {
    const r = (row || {}) as Record<string, unknown>;
    const week = Math.max(1, Math.min(52, Number(r.week) || 1));
    const weekday = Math.max(
      1,
      Math.min(7, Number(r.weekday) || 1)
    ) as FitProgrammeWeekday;
    out.push({
      id: String(r.id || `blk_${week}_${weekday}_${i}`),
      week,
      weekday,
      title:
        r.title != null && String(r.title).trim()
          ? String(r.title).trim()
          : undefined,
      notes:
        r.notes != null && String(r.notes).trim()
          ? String(r.notes).trim()
          : undefined,
      items: parseProgrammeItems(r.items),
    });
  });
  return out;
}

export function flattenBlocksToItems(
  blocks: FitProgrammeBlock[]
): FitProgrammeItem[] {
  const items: FitProgrammeItem[] = [];
  let sort = 0;
  for (const b of [...blocks].sort(
    (a, c) => a.week - c.week || a.weekday - c.weekday
  )) {
    for (const it of b.items || []) {
      items.push({
        ...it,
        id: it.id || `itm_${b.id}_${sort}`,
        sort: sort++,
      });
    }
  }
  return items;
}

export function programmeWeekCount(programme: FitProgramme): number {
  const fromBlocks = (programme.blocks || []).reduce(
    (n, b) => Math.max(n, Number(b.week) || 0),
    0
  );
  return Math.max(1, Number(programme.weeks) || fromBlocks || 1);
}

/** Calendar sessions, or a single week-1 Monday block from legacy `items`. */
export function programmeBlocksOrLegacy(
  programme: FitProgramme
): FitProgrammeBlock[] {
  if ((programme.blocks || []).length) return programme.blocks || [];
  if ((programme.items || []).length) {
    return [
      {
        id: `blk_legacy_${programme.id}`,
        week: 1,
        weekday: 1,
        title: programme.name,
        notes: programme.description,
        items: programme.items,
      },
    ];
  }
  return [];
}

/** JS getDay 0=Sun → 1=Mon … 7=Sun */
export function dateToProgrammeWeekday(dateIso: string): FitProgrammeWeekday {
  const d = new Date(String(dateIso).slice(0, 10) + 'T12:00:00').getDay();
  return (d === 0 ? 7 : d) as FitProgrammeWeekday;
}

/** Day of the plan that belongs on a given calendar date (weekday match). */
export function programmeBlockForWeekday(
  programme: FitProgramme,
  weekday: number,
  week = 1
): FitProgrammeBlock | null {
  const blocks = programmeBlocksOrLegacy(programme);
  const wd = Math.max(1, Math.min(7, Number(weekday) || 1));
  return (
    blocks.find((b) => b.week === week && b.weekday === wd) ||
    blocks.find((b) => b.weekday === wd) ||
    blocks[0] ||
    null
  );
}

export function hydrateProgramme(
  programme: FitProgramme,
  movements: FitMovement[]
): FitHydratedProgramme {
  const blocks = programmeBlocksOrLegacy(programme).map((b) =>
    hydrateProgrammeBlock(b, movements)
  );
  const items = hydrateProgrammeItems(
    (programme.items || []).length
      ? programme.items
      : flattenBlocksToItems(programme.blocks || []),
    movements
  );
  return {
    ...programme,
    weeks: programmeWeekCount(programme),
    items,
    blocks,
  };
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
  const out: FitProgrammeItem[] = [];
  raw.forEach((row, i) => {
    const r = (row || {}) as Record<string, unknown>;
    const movementId = String(r.movement_id || '').trim();
    if (!movementId) return;
    out.push({
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
        r.tempo != null && String(r.tempo).trim() ? String(r.tempo) : null,
      notes:
        r.notes != null && String(r.notes).trim()
          ? String(r.notes)
          : undefined,
      sort: r.sort != null ? Number(r.sort) || i : i,
    });
  });
  return out;
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
    modality:
      rec.modality != null ? String(rec.modality) : prev?.modality,
    muscle_group:
      rec.muscle_group != null ? String(rec.muscle_group) : prev?.muscle_group,
    movement_pattern:
      rec.movement_pattern != null
        ? String(rec.movement_pattern)
        : prev?.movement_pattern,
    scoring: rec.scoring != null ? String(rec.scoring) : prev?.scoring,
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
    price_zar:
      rec.price_zar !== undefined
        ? rec.price_zar == null || rec.price_zar === ''
          ? null
          : Number(rec.price_zar)
        : prev?.price_zar ?? null,
    public:
      rec.public !== undefined ? rec.public === true : prev?.public === true,
    billing:
      rec.billing != null
        ? (String(rec.billing) as FitProgramme['billing'])
        : prev?.billing || 'once',
    follow_notes:
      rec.follow_notes != null
        ? String(rec.follow_notes)
        : prev?.follow_notes,
    blocks:
      rec.blocks !== undefined
        ? parseProgrammeBlocks(rec.blocks)
        : prev?.blocks || [],
    items:
      rec.items !== undefined
        ? parseProgrammeItems(rec.items)
        : rec.blocks !== undefined
          ? flattenBlocksToItems(parseProgrammeBlocks(rec.blocks))
          : prev?.items || [],
    weeks:
      rec.weeks !== undefined
        ? rec.weeks == null || rec.weeks === ''
          ? null
          : Math.max(1, Math.min(52, Number(rec.weeks) || 1))
        : prev?.weeks ??
          ((rec.blocks !== undefined
            ? parseProgrammeBlocks(rec.blocks)
            : prev?.blocks || []
          ).reduce((n, b) => Math.max(n, b.week), 0) || null),
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
    if (p.blocks) {
      for (const b of p.blocks) {
        b.items = (b.items || []).filter((it) => it.movement_id !== movementId);
      }
    }
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


