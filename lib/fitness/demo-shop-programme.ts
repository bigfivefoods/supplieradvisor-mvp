/**
 * Shop-ready training programme used by VUKA Fitness catalog + demo gym seed.
 */
import { catalogIdForCode } from '@/lib/fitness/movement-catalog';
import { flattenBlocksToItems, type FitProgramme } from '@/lib/fitness/movements';
import { fillWeeksFromWeek1 } from '@/lib/fitness/programme-follow';
import type { FitgraphStore } from '@/lib/fitness/fitgraph';

export const DEMO_SHOP_PROGRAMME_ID = 'vuka_prg_hyrox6';

function mov(code: string) {
  return catalogIdForCode(code);
}

function item(
  code: string,
  sets: number,
  reps: string,
  restSec = 90,
  suffix = ''
) {
  return {
    id: `itm_${code.toLowerCase()}_${sets}${suffix}`,
    movement_id: mov(code),
    sets,
    reps,
    rest_sec: restSec,
  };
}

export function buildDemoShopProgramme(
  now: string,
  coachId?: string | null
): FitProgramme {
  let n = 0;
  const week1 = [
    {
      id: 'blk_hyrox_w1_mon',
      week: 1,
      weekday: 1 as const,
      title: 'Squat + engine',
      notes: 'Stay crisp on depth. Last row is easy pace.',
      items: [
        item('SYS_MOV_BACK_SQUAT', 4, '6', 120, '_w1m'),
        item('SYS_MOV_GOBLET_SQUAT', 3, '10', 60, '_w1m'),
        item('SYS_MOV_ROW', 1, '500 m', 0, '_w1m'),
      ],
    },
    {
      id: 'blk_hyrox_w1_wed',
      week: 1,
      weekday: 3 as const,
      title: 'Hinge + carry',
      notes: 'Long spine on the RDL. Swings are hip snap, not a squat.',
      items: [
        item('SYS_MOV_RDL', 4, '8', 90, '_w1w'),
        item('SYS_MOV_KB_SWING', 4, '12', 60, '_w1w'),
      ],
    },
    {
      id: 'blk_hyrox_w1_fri',
      week: 1,
      weekday: 5 as const,
      title: 'Push + engine',
      notes: 'Quality push-ups. Bike calories at a hard but repeatable pace.',
      items: [
        item('SYS_MOV_PUSH_UP', 4, '10', 60, '_w1f'),
        item('SYS_MOV_ASSAULT', 1, '12 cal', 0, '_w1f'),
      ],
    },
    {
      id: 'blk_hyrox_w1_sat',
      week: 1,
      weekday: 6 as const,
      title: 'Conditioning',
      notes: 'Easy run. Skip as a finisher, not a max effort.',
      items: [
        item('SYS_MOV_RUN', 1, '2 km easy', 0, '_w1s'),
        item('SYS_MOV_SKIP', 3, '60 s', 30, '_w1s'),
      ],
    },
  ];
  const blocks = fillWeeksFromWeek1(
    week1,
    4,
    (p) => `${p}_${(n += 1)}`
  );
  return {
    id: DEMO_SHOP_PROGRAMME_ID,
    name: 'Hyrox 6',
    description:
      '4-week engine and strength block you can follow on your phone. Four training days; walk the rest.',
    follow_notes:
      'Complete the calendar days. After each session log how you felt (1–5) and effort (RPE 1–10).',
    kind: 'both',
    weeks: 4,
    blocks,
    items: flattenBlocksToItems(blocks),
    coach_id: coachId || null,
    price_zar: 450,
    public: true,
    billing: 'once',
    active: true,
    created_at: now,
    updated_at: now,
  };
}

/** Insert or restore shop flags so the programme is buyable online. */
export function ensureDemoShopProgramme(
  store: FitgraphStore,
  now?: string
): boolean {
  const ts = now || new Date().toISOString();
  if (!store.programmes) store.programmes = [];
  const coachId =
    store.coaches?.find((c) => c.active !== false)?.id || null;
  const next = buildDemoShopProgramme(ts, coachId);
  const i = store.programmes.findIndex((p) => p.id === DEMO_SHOP_PROGRAMME_ID);
  if (i < 0) {
    store.programmes.push(next);
    return true;
  }
  const cur = store.programmes[i];
  let changed = false;
  if (cur.public !== true) {
    cur.public = true;
    changed = true;
  }
  if (!(Number(cur.price_zar) > 0)) {
    cur.price_zar = 450;
    changed = true;
  }
  if (cur.billing !== 'once') {
    cur.billing = 'once';
    changed = true;
  }
  if (cur.active === false) {
    cur.active = true;
    changed = true;
  }
  if (!(cur.blocks || []).length) {
    cur.blocks = next.blocks;
    cur.weeks = 4;
    cur.items = next.items;
    changed = true;
  }
  if (!cur.description) {
    cur.description = next.description;
    changed = true;
  }
  return changed;
}
