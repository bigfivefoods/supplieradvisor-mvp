/**
 * Instructional plates for catalog movements.
 * 3D human pose photos live in /public/images/movements/{pose}.jpg.
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

export function movementPoseImageSrc(pose: MovementArtPose): string {
  return `/images/movements/${pose}.jpg`;
}

export function resolveMovementPose(
  name: string,
  category?: string | null
): MovementArtPose {
  for (const rule of POSE_RULES) {
    if (rule.re.test(name)) return rule.pose;
  }
  return CATEGORY_POSE[String(category || 'Other')] || 'generic';
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
