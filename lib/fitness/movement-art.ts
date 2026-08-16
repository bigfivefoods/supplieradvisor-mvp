/**
 * Unique instructional plate for each catalog movement.
 * Used when no custom photo is set. Deterministic from name + category.
 */

export type MovementArtPose =
  | 'squat'
  | 'pistol'
  | 'wallsit'
  | 'machine'
  | 'hinge'
  | 'swing'
  | 'thrust'
  | 'lunge'
  | 'step'
  | 'bench'
  | 'pushup'
  | 'ohp'
  | 'dip'
  | 'fly'
  | 'row'
  | 'pullup'
  | 'pulldown'
  | 'shrug'
  | 'carry'
  | 'plank'
  | 'hang'
  | 'situp'
  | 'twist'
  | 'clean'
  | 'snatch'
  | 'jump'
  | 'throw'
  | 'burpee'
  | 'bike'
  | 'run'
  | 'skip'
  | 'sled'
  | 'stretch'
  | 'curl'
  | 'raise'
  | 'calf'
  | 'crawl'
  | 'generic';

const POSE_RULES: Array<{ pose: MovementArtPose; re: RegExp }> = [
  { pose: 'pistol', re: /pistol|shrimp/i },
  { pose: 'wallsit', re: /wall sit/i },
  { pose: 'machine', re: /machine|hack squat|pendulum|smith|leg press|pec deck/i },
  { pose: 'swing', re: /swing/i },
  { pose: 'thrust', re: /thrust|bridge|frog pump|pull-through|pull through/i },
  { pose: 'hinge', re: /deadlift|rdl|good morning|hyper|extension|nordic/i },
  { pose: 'lunge', re: /lunge|split squat|cossack|curtsy/i },
  { pose: 'step', re: /step-up|step up/i },
  { pose: 'squat', re: /squat|goblet|zercher|belt squat/i },
  { pose: 'bench', re: /bench|floor press|jm press/i },
  { pose: 'pushup', re: /push-up|push up|pike|handstand/i },
  { pose: 'dip', re: /\bdip\b/i },
  { pose: 'fly', re: /\bfly\b|pec deck/i },
  { pose: 'ohp', re: /press|jerk|z-press|arnold|thruster|landmine press/i },
  { pose: 'pullup', re: /pull-up|pull up|chin-up|chin up|muscle-up|chest-to-bar/i },
  { pose: 'pulldown', re: /pulldown|pull-down|pullover|straight-arm/i },
  { pose: 'shrug', re: /shrug|face pull|rear-delt|pull-apart/i },
  { pose: 'row', re: /row|meadows|seal|gorilla|helms|renegade/i },
  { pose: 'carry', re: /carry|farmer|yoke|suitcase|waiter|bear-hug|bear hug/i },
  { pose: 'plank', re: /plank|dead bug|bird dog|pallof|hollow|ab wheel|stir|copenhagen|roll-out/i },
  { pose: 'hang', re: /hanging|toes-to-bar|toes to bar|dead hang|l-sit/i },
  { pose: 'twist', re: /twist|woodchop|rotation|wiper|bicycle/i },
  { pose: 'situp', re: /sit-up|sit up|crunch|v-up|ghd sit|get-up|get up/i },
  { pose: 'clean', re: /clean|cluster|thruster/i },
  { pose: 'snatch', re: /snatch|jerk/i },
  { pose: 'burpee', re: /burpee|man maker|devil press/i },
  { pose: 'throw', re: /throw|slam|wall ball|pass/i },
  { pose: 'jump', re: /jump|hop|bound|pogo|skater|box jump/i },
  { pose: 'bike', re: /bike|row|ski|elliptical|climber|erg/i },
  { pose: 'run', re: /run|shuttle|treadmill|swim/i },
  { pose: 'skip', re: /skip|rope|double-under|double under/i },
  { pose: 'sled', re: /sled|prowler/i },
  { pose: 'stretch', re: /stretch|mobility|couch|pigeon|dog|cat-cow|ankle|dislocate|slide|pose|bretzel|frog|jefferson|wrist/i },
  { pose: 'curl', re: /curl|pushdown|skull|kickback|extension/i },
  { pose: 'raise', re: /raise|upright row|abduction|adduction/i },
  { pose: 'calf', re: /calf/i },
  { pose: 'crawl', re: /crawl|crab|inchworm/i },
];

const CATEGORY_POSE: Record<string, MovementArtPose> = {
  Squat: 'squat',
  Hinge: 'hinge',
  Lunge: 'lunge',
  Push: 'ohp',
  Pull: 'row',
  Carry: 'carry',
  Core: 'plank',
  Olympic: 'clean',
  Plyometric: 'jump',
  Conditioning: 'run',
  Mobility: 'stretch',
  Isolation: 'curl',
  Other: 'generic',
};

export const CATEGORY_COLORS: Record<string, { bg: string; ink: string; accent: string }> =
  {
    Squat: { bg: '#FEFCE8', ink: '#422006', accent: '#E8E830' },
    Hinge: { bg: '#FFF7ED', ink: '#431407', accent: '#F97316' },
    Lunge: { bg: '#F0FDF4', ink: '#14532D', accent: '#22C55E' },
    Push: { bg: '#EFF6FF', ink: '#1E3A8A', accent: '#3B82F6' },
    Pull: { bg: '#F5F3FF', ink: '#2E1065', accent: '#8B5CF6' },
    Carry: { bg: '#FFFBEB', ink: '#451A03', accent: '#D97706' },
    Core: { bg: '#ECFEFF', ink: '#164E63', accent: '#06B6D4' },
    Olympic: { bg: '#FFF1F2', ink: '#4C0519', accent: '#F43F5E' },
    Plyometric: { bg: '#FDF4FF', ink: '#4A044E', accent: '#D946EF' },
    Conditioning: { bg: '#F0FDFA', ink: '#134E4A', accent: '#14B8A6' },
    Mobility: { bg: '#F8FAFC', ink: '#0F172A', accent: '#64748B' },
    Isolation: { bg: '#FDF2F8', ink: '#500724', accent: '#EC4899' },
    Other: { bg: '#F8FAFC', ink: '#1E293B', accent: '#E8E830' },
  };

export function resolveMovementPose(
  name: string,
  category?: string | null
): MovementArtPose {
  for (const rule of POSE_RULES) {
    if (rule.re.test(name)) return rule.pose;
  }
  return CATEGORY_POSE[String(category || 'Other')] || 'generic';
}

export function movementArtSeed(codeOrName: string): number {
  let h = 0;
  for (let i = 0; i < codeOrName.length; i += 1) {
    h = (h * 31 + codeOrName.charCodeAt(i)) >>> 0;
  }
  return h;
}

/** Simple instructional figure paths, viewBox 0 0 160 120 */
export function figurePaths(pose: MovementArtPose, seed: number): string {
  const tilt = (seed % 7) - 3;
  switch (pose) {
    case 'squat':
      return fig(
        80 + tilt,
        38,
        `M ${70 + tilt} 52 L ${58 + tilt} 88 L ${50 + tilt} 112 M ${90 + tilt} 52 L ${102 + tilt} 88 L ${110 + tilt} 112`,
        `M ${55 + tilt} 50 H ${105 + tilt}`
      );
    case 'pistol':
      return fig(
        72,
        36,
        `M 68 50 L 62 88 L 58 114 M 76 50 L 118 62 L 132 58`,
        'M 50 48 H 88'
      );
    case 'wallsit':
      return `M 40 20 V 110 M 78 34 a 8 8 0 1 1 0.1 0 M 78 44 V 62 H 108 V 110 M 78 62 L 58 110`;
    case 'machine':
      return `M 36 24 H 128 V 108 H 36 Z M 48 36 H 116 V 70 H 48 Z M 80 34 a 7 7 0 1 1 0.1 0 M 80 44 V 70 M 64 70 L 56 104 M 96 70 L 104 104`;
    case 'hinge':
      return fig(
        92,
        36,
        `M 86 50 L 58 78 L 46 108 M 96 52 L 118 78 L 128 108`,
        'M 70 58 L 40 62'
      );
    case 'swing':
      return fig(
        86,
        34,
        `M 80 48 L 70 86 L 62 112 M 92 48 L 108 78 L 120 100`,
        'M 100 46 Q 130 70 138 96'
      );
    case 'thrust':
      return `M 36 78 H 130 M 70 70 a 7 7 0 1 1 0.1 0 M 70 78 L 58 96 M 78 78 L 118 70 L 132 66 M 118 70 L 126 96`;
    case 'lunge':
      return fig(
        74,
        34,
        `M 70 50 L 52 86 L 44 112 M 80 50 L 110 78 L 124 112`,
        'M 58 48 H 92'
      );
    case 'step':
      return `M 40 92 H 90 V 112 H 40 Z M 78 30 a 7 7 0 1 1 0.1 0 M 78 38 V 62 L 58 92 M 78 62 L 100 78 L 108 70`;
    case 'bench':
      return `M 28 86 H 132 V 96 H 28 Z M 70 44 a 7 7 0 1 1 0.1 0 M 70 52 V 70 H 118 M 58 70 L 48 92 M 82 70 L 90 92`;
    case 'pushup':
      return `M 30 86 L 130 70 M 48 78 a 6 6 0 1 1 0.1 0 M 54 80 L 40 96 M 70 76 L 86 96 M 100 72 L 118 88`;
    case 'ohp':
      return fig(
        80,
        36,
        `M 72 50 L 64 90 L 58 114 M 88 50 L 96 90 L 104 114`,
        `M 62 34 H 98 M 80 18 V 34`
      );
    case 'dip':
      return `M 40 28 H 52 V 100 H 40 Z M 108 28 H 120 V 100 H 108 Z M 80 34 a 7 7 0 1 1 0.1 0 M 68 50 H 92 V 62 H 68 Z M 68 62 L 56 96 M 92 62 L 104 96`;
    case 'fly':
      return fig(
        80,
        50,
        `M 74 64 L 68 96 L 62 114 M 86 64 L 92 96 L 98 114`,
        'M 40 56 Q 80 40 120 56'
      );
    case 'row':
      return fig(
        96,
        38,
        `M 90 52 L 70 84 L 58 110 M 100 54 L 122 82 L 132 108`,
        'M 48 58 H 88'
      );
    case 'pullup':
      return `M 28 22 H 132 M 80 34 a 7 7 0 1 1 0.1 0 M 62 22 V 48 H 98 V 22 M 68 48 L 58 90 L 52 112 M 92 48 L 102 90 L 110 112`;
    case 'pulldown':
      return `M 40 18 H 120 V 28 H 40 Z M 80 36 a 7 7 0 1 1 0.1 0 M 56 28 V 58 H 104 V 28 M 68 58 L 58 100 L 52 114 M 92 58 L 102 100 L 108 114`;
    case 'shrug':
      return fig(
        80,
        34,
        `M 72 48 L 66 92 L 60 114 M 88 48 L 94 92 L 100 114`,
        'M 48 50 H 112'
      );
    case 'carry':
      return fig(
        80,
        32,
        `M 74 46 L 68 86 L 62 114 M 86 46 L 96 78 L 110 114`,
        'M 52 56 V 78 H 44 V 56 Z M 108 56 V 78 H 116 V 56 Z'
      );
    case 'plank':
      return `M 28 78 H 132 M 46 70 a 6 6 0 1 1 0.1 0 M 52 74 L 40 90 M 70 74 L 84 90 M 110 74 L 124 88`;
    case 'hang':
      return `M 28 20 H 132 M 80 36 a 7 7 0 1 1 0.1 0 M 62 20 V 54 H 98 V 20 M 70 54 L 64 100 L 72 118 M 90 54 L 96 100 L 88 118`;
    case 'situp':
      return `M 28 96 H 132 M 58 88 a 7 7 0 1 1 0.1 0 M 64 90 Q 90 50 118 88`;
    case 'twist':
      return fig(
        80,
        40,
        `M 76 54 L 68 92 L 60 114 M 86 54 L 98 88 L 112 110`,
        'M 50 48 Q 80 28 118 52'
      );
    case 'clean':
      return fig(
        78,
        32,
        `M 74 46 L 60 84 L 50 112 M 86 46 L 104 74 L 118 108`,
        'M 58 28 H 100'
      );
    case 'snatch':
      return fig(
        80,
        28,
        `M 74 42 L 64 86 L 56 114 M 88 42 L 100 84 L 110 114`,
        'M 48 16 H 112 M 80 8 V 16'
      );
    case 'jump':
      return fig(
        80,
        24,
        `M 74 38 L 62 58 L 54 72 M 88 38 L 104 56 L 116 70`,
        'M 60 30 H 100'
      ) + ' M 40 96 H 120';
    case 'throw':
      return fig(
        70,
        36,
        `M 66 50 L 58 88 L 50 112 M 78 50 L 96 78 L 108 104`,
        'M 88 28 A 10 10 0 1 1 88.1 28'
      );
    case 'burpee':
      return `M 36 88 L 124 78 M 54 80 a 6 6 0 1 1 0.1 0 M 80 20 L 92 44 L 80 56 L 104 56`;
    case 'bike':
      return `M 52 88 a 16 16 0 1 1 0.1 0 M 108 88 a 16 16 0 1 1 0.1 0 M 52 88 L 80 56 L 108 88 M 80 34 a 7 7 0 1 1 0.1 0 M 80 42 L 80 56 L 64 70`;
    case 'run':
      return fig(
        78,
        30,
        `M 74 44 L 56 72 L 70 96 M 86 44 L 108 68 L 96 104`,
        'M 92 28 L 112 40'
      );
    case 'skip':
      return fig(
        80,
        30,
        `M 74 44 L 66 80 L 70 108 M 88 44 L 102 72 L 94 100`,
        'M 50 20 Q 80 70 110 20'
      );
    case 'sled':
      return `M 30 96 H 130 V 108 H 30 Z M 70 32 a 7 7 0 1 1 0.1 0 M 70 40 L 48 96 M 78 48 L 110 70 L 118 96`;
    case 'stretch':
      return fig(
        58,
        70,
        `M 58 82 L 40 108 M 64 82 L 120 70`,
        'M 70 62 L 110 40'
      );
    case 'curl':
      return fig(
        80,
        34,
        `M 74 48 L 68 92 L 62 114 M 88 48 L 94 92 L 100 114`,
        'M 58 56 Q 50 40 58 28 M 102 56 Q 110 40 102 28'
      );
    case 'raise':
      return fig(
        80,
        36,
        `M 74 50 L 68 92 L 62 114 M 88 50 L 94 92 L 100 114`,
        'M 48 36 H 28 M 112 36 H 132'
      );
    case 'calf':
      return fig(
        80,
        32,
        `M 76 46 L 74 78 L 70 96 L 78 114 M 86 46 L 90 78 L 96 96 L 90 114`,
        'M 64 46 H 96'
      );
    case 'crawl':
      return `M 40 92 H 128 M 56 70 a 6 6 0 1 1 0.1 0 M 50 76 L 36 96 M 72 78 L 88 96 M 110 76 L 124 94`;
    default:
      return fig(
        80 + tilt,
        36,
        `M ${72 + tilt} 50 L ${64 + tilt} 90 L ${58 + tilt} 114 M ${88 + tilt} 50 L ${96 + tilt} 90 L ${104 + tilt} 114`,
        `M ${60 + tilt} 48 H ${100 + tilt}`
      );
  }
}

function fig(cx: number, cy: number, legs: string, arms: string): string {
  return `M ${cx} ${cy} a 8 8 0 1 1 0.1 0 M ${cx} ${cy + 8} V ${cy + 28} ${legs} ${arms}`;
}

export function movementDisplayDescription(m: {
  overview?: string;
  details?: string;
  description?: string;
}): { overview: string; details: string } {
  const overview = String(m.overview || '').trim();
  const details = String(m.details || m.description || '').trim();
  return {
    overview: overview || details.slice(0, 140),
    details: details || overview,
  };
}
