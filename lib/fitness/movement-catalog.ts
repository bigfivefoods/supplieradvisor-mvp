/**
 * Built-in GymAdvisor movement catalog.
 * Seeded onto each gym store; coaches may add their own on top.
 */
import type { FitMovement } from '@/lib/fitness/movements';
import { SYSTEM_MOVEMENT_CATALOG_EXTRA } from '@/lib/fitness/movement-catalog-extra';

export type {
  CatalogDraft,
  MovementLevel,
} from '@/lib/fitness/movement-catalog-types';

export const MOVEMENT_CATEGORY_META: Array<{
  id: string;
  hint: string;
}> = [
  { id: 'Squat', hint: 'Knee-dominant · quads, glutes' },
  { id: 'Hinge', hint: 'Hip-dominant · posterior chain' },
  { id: 'Lunge', hint: 'Single-leg · split stance' },
  { id: 'Push', hint: 'Pressing · chest, shoulders, triceps' },
  { id: 'Pull', hint: 'Rows and pulls · back, biceps' },
  { id: 'Carry', hint: 'Loaded locomotion · grip, trunk' },
  { id: 'Core', hint: 'Brace, anti-rotate, anti-extend' },
  { id: 'Olympic', hint: 'Clean, snatch, jerk · power' },
  { id: 'Plyometric', hint: 'Jumps and throws · elastic power' },
  { id: 'Conditioning', hint: 'Engines · bike, row, run, ropes' },
  { id: 'Mobility', hint: 'Range, control, warm-up' },
  { id: 'Isolation', hint: 'Accessory · arms, delts, calves' },
  { id: 'Other', hint: 'Coach custom / uncategorised' },
];

const SYSTEM_MOVEMENT_CATALOG_CORE: import('@/lib/fitness/movement-catalog-types').CatalogDraft[] = [
  // ── Squat ──────────────────────────────────────────────
  {
    code: 'SYS_MOV_BACK_SQUAT',
    name: 'Back squat',
    category: 'Squat',
    equipment: 'Barbell, rack',
    muscles: 'Quads, glutes, adductors, spinal erectors',
    level: 'intermediate',
    overview:
      'The main knee-dominant barbell lift. Builds lower-body strength and trunk stiffness under load.',
    details:
      'Bar on the upper back (high-bar) or rear delts (low-bar). Brace, sit between the hips, knees track over mid-foot, keep the chest tall. Stand by driving the floor away. Common faults: knees caving, losing the brace, bouncing out of the hole. Cue “spread the floor” and “ribs down”. Scale with goblet squat or box squat.',
  },
  {
    code: 'SYS_MOV_FRONT_SQUAT',
    name: 'Front squat',
    category: 'Squat',
    equipment: 'Barbell, rack',
    muscles: 'Quads, glutes, upper back, core',
    level: 'intermediate',
    overview:
      'Bar in the front rack. More upright torso and heavier quad demand than a back squat.',
    details:
      'Rest the bar on the front delts; elbows high. Sit down between the heels while keeping the torso vertical. If the elbows drop, the bar rolls. Wrist mobility or a cross-arm rack is fine. Faults: collapsing chest, heels lifting. Great for Olympic work and for lifters who struggle with back-squat position.',
  },
  {
    code: 'SYS_MOV_GOBLET_SQUAT',
    name: 'Goblet squat',
    category: 'Squat',
    equipment: 'Kettlebell or dumbbell',
    muscles: 'Quads, glutes, core',
    level: 'beginner',
    overview:
      'Best teaching squat. The front load helps people sit down with a tall chest.',
    details:
      'Hold a kettlebell or dumbbell at the sternum. Elbows inside the knees at the bottom. Heels stay down. Use as a warm-up, a beginner main lift, or high-rep finisher. If the torso tips, lighten the load and pause in the hole for two seconds.',
  },
  {
    code: 'SYS_MOV_BOX_SQUAT',
    name: 'Box squat',
    category: 'Squat',
    equipment: 'Barbell, box',
    muscles: 'Quads, glutes, hamstrings',
    level: 'beginner',
    overview:
      'Squat to a box to teach depth, control, and sitting back into the hips.',
    details:
      'Set a box at or just above parallel. Sit back, tap without collapsing, then stand. Do not bounce or rock forward. Useful for new lifters, return-to-play, and teaching the hinge-to-squat difference. Raise the box if depth is ugly.',
  },
  {
    code: 'SYS_MOV_OVERHEAD_SQUAT',
    name: 'Overhead squat',
    category: 'Squat',
    equipment: 'Barbell or PVC',
    muscles: 'Quads, glutes, shoulders, upper back',
    level: 'advanced',
    overview:
      'Full-body squat with the bar locked out overhead. Exposes mobility and midline control.',
    details:
      'Wide snatch grip, bar over mid-foot, armpits forward. Sit down without the bar drifting forward. Usually loaded light. Start with a PVC pipe. Faults: elbows bending, heels rising, lumbar rounding. Pair with ankle and thoracic work.',
  },
  {
    code: 'SYS_MOV_LEG_PRESS',
    name: 'Leg press',
    category: 'Squat',
    equipment: 'Leg-press machine',
    muscles: 'Quads, glutes',
    level: 'beginner',
    overview:
      'Machine squat pattern. Useful for volume when the back is tired or for new members.',
    details:
      'Feet mid-platform, do not lock the knees hard, keep the low back against the pad. Lower until the thighs are at least parallel without the hips tucking. High and wide feet bias glutes; lower and closer bias quads. Never bounce the sled.',
  },

  // ── Hinge ──────────────────────────────────────────────
  {
    code: 'SYS_MOV_CONV_DL',
    name: 'Conventional deadlift',
    category: 'Hinge',
    equipment: 'Barbell',
    muscles: 'Hamstrings, glutes, erectors, lats, grip',
    level: 'intermediate',
    overview:
      'Pick a bar off the floor with a hip hinge. Foundational posterior-chain strength.',
    details:
      'Bar over mid-foot, shins to the bar, hinge until hands reach the bar, lats on, brace. Push the floor and stand tall — do not yank. Lower with control. Faults: rounded back, bar drifting forward, hyperextending at the top. Teach RDL and kettlebell deadlift first if the pattern is sloppy.',
  },
  {
    code: 'SYS_MOV_RDL',
    name: 'Romanian deadlift',
    category: 'Hinge',
    equipment: 'Barbell or dumbbells',
    muscles: 'Hamstrings, glutes, erectors',
    level: 'beginner',
    overview:
      'Hinge from a standing start. Best drill for hamstring loading and hip position.',
    details:
      'Soft knees, push the hips back, bar close to the legs, spine long. Stop when the hamstrings are taut — usually mid-shin. Stand by squeezing the glutes, not yanking the chest. Slow eccentrics work well. If the back rounds, shorten the range.',
  },
  {
    code: 'SYS_MOV_SUMO_DL',
    name: 'Sumo deadlift',
    category: 'Hinge',
    equipment: 'Barbell',
    muscles: 'Glutes, adductors, quads, erectors',
    level: 'intermediate',
    overview:
      'Wide-stance deadlift. Shorter range and more hip/adductor than a conventional pull.',
    details:
      'Toes out, shins vertical, chest up, arms inside the knees. Push the floor apart and stand. Hips should not shoot up first. Useful for lifters with long femurs or limited ankle range. Keep the bar glued to the body.',
  },
  {
    code: 'SYS_MOV_HIP_THRUST',
    name: 'Hip thrust',
    category: 'Hinge',
    equipment: 'Barbell, bench',
    muscles: 'Glutes, hamstrings',
    level: 'beginner',
    overview:
      'Horizontal hip extension. High glute tension with less spinal load than a deadlift.',
    details:
      'Upper back on a bench, bar over the hips (pad it). Chin tucked, ribs down. Drive through the heels to a full lockout — shin vertical at the top. Pause one second. Faults: overextending the lumbar spine, walking the feet too far out.',
  },
  {
    code: 'SYS_MOV_KB_SWING',
    name: 'Kettlebell swing',
    category: 'Hinge',
    equipment: 'Kettlebell',
    muscles: 'Glutes, hamstrings, lats, core',
    level: 'beginner',
    overview:
      'Ballistic hinge. Builds power, conditioning, and hip snap without a barbell.',
    details:
      'Hike the bell back between the legs, then snap the hips to float it to about chest height (Russian) or overhead (American — only if the shoulder allows). Arms are ropes, not a front raise. Faults: squatting the swing, rounding the back. Start light and film from the side.',
  },
  {
    code: 'SYS_MOV_GOOD_MORNING',
    name: 'Good morning',
    category: 'Hinge',
    equipment: 'Barbell',
    muscles: 'Hamstrings, glutes, erectors',
    level: 'intermediate',
    overview:
      'Barbell on the back, hinge to load the posterior chain. Great accessory for squat and deadlift.',
    details:
      'Light to moderate load. Soft knees, hips back, spine locked. Stop before the back rounds. Stand by driving the hips forward. Not a max-effort lift — treat it as a pattern and hypertrophy tool.',
  },
  {
    code: 'SYS_MOV_GLUTE_BRIDGE',
    name: 'Glute bridge',
    category: 'Hinge',
    equipment: 'Bodyweight or dumbbell',
    muscles: 'Glutes, hamstrings',
    level: 'beginner',
    overview:
      'Floor hip extension. First step before hip thrusts or for activation.',
    details:
      'Lie on the back, feet under the knees. Posteriorly tilt the pelvis slightly, then squeeze the glutes to lift the hips. Pause. Progress to single-leg or a weight on the hips. Stop if the low back takes over.',
  },

  // ── Lunge ──────────────────────────────────────────────
  {
    code: 'SYS_MOV_REV_LUNGE',
    name: 'Reverse lunge',
    category: 'Lunge',
    equipment: 'Bodyweight, dumbbells, or kettlebells',
    muscles: 'Quads, glutes, adductors',
    level: 'beginner',
    overview:
      'Step back into a split stance. Usually kinder on the knees than a forward lunge.',
    details:
      'Tall torso, step back, back knee toward the floor, front shin fairly vertical. Drive through the front heel to stand. Alternate or stay on one side. Hold weights at the sides or in a goblet. Faults: collapsing inward at the front knee, tiny steps.',
  },
  {
    code: 'SYS_MOV_WALK_LUNGE',
    name: 'Walking lunge',
    category: 'Lunge',
    equipment: 'Bodyweight or dumbbells',
    muscles: 'Quads, glutes, calves',
    level: 'beginner',
    overview:
      'Travelling lunges for volume, conditioning, and single-leg strength.',
    details:
      'Long enough step that the back knee can drop. Do not crash into the front heel. Keep the pelvis square. Use in finishers or as the main single-leg work. Shorten the step if the knee screams.',
  },
  {
    code: 'SYS_MOV_BULG_SPLIT',
    name: 'Bulgarian split squat',
    category: 'Lunge',
    equipment: 'Bench, dumbbells optional',
    muscles: 'Quads, glutes',
    level: 'intermediate',
    overview:
      'Rear foot elevated split squat. High tension per leg with little axial load.',
    details:
      'Rear foot on a bench, front foot far enough that the knee can travel without the heel lifting. Drop straight down. Hold dumbbells when bodyweight is easy. Faults: standing too close to the bench (painful hip), bouncing. A shorter rear elevation is a valid scale.',
  },
  {
    code: 'SYS_MOV_LAT_LUNGE',
    name: 'Lateral lunge',
    category: 'Lunge',
    equipment: 'Bodyweight or kettlebell',
    muscles: 'Glutes, adductors, quads',
    level: 'beginner',
    overview:
      'Side-to-side lunge. Trains the frontal plane most gym work ignores.',
    details:
      'Step wide, sit into one hip, other leg stays long. Toes generally forward. Push back to centre. Useful for field sports and adductor health. Goblet hold helps the torso stay tall.',
  },
  {
    code: 'SYS_MOV_STEP_UP',
    name: 'Step-up',
    category: 'Lunge',
    equipment: 'Box, dumbbells optional',
    muscles: 'Quads, glutes',
    level: 'beginner',
    overview:
      'Step onto a box and stand tall. Simple single-leg strength and control.',
    details:
      'Whole foot on the box. Drive through the working leg — do not bounce off the trailing foot. Stand fully, then lower with control. Box height around mid-shin to just below knee for most people. Too high becomes a hip hike.',
  },

  // ── Push ───────────────────────────────────────────────
  {
    code: 'SYS_MOV_BENCH',
    name: 'Barbell bench press',
    category: 'Push',
    equipment: 'Barbell, bench, rack',
    muscles: 'Pectorals, anterior delts, triceps',
    level: 'intermediate',
    overview:
      'Main horizontal press. Builds pressing strength and upper-body mass.',
    details:
      'Eyes under the bar, shoulder blades set, slight arch, feet planted. Unrack, lower to the lower chest / sternum, elbows about 45–70° from the torso. Press back toward the rack. Spotter for heavy sets. Faults: flared elbows, bouncing, losing the upper-back set.',
  },
  {
    code: 'SYS_MOV_INCLINE_BENCH',
    name: 'Incline bench press',
    category: 'Push',
    equipment: 'Barbell or dumbbells, incline bench',
    muscles: 'Upper pecs, anterior delts, triceps',
    level: 'intermediate',
    overview:
      'Press on a 15–45° incline. More clavicular pec and shoulder than a flat bench.',
    details:
      'Do not set the bench too steep or it becomes a shoulder press. Same setup rules as flat bench. Dumbbells allow a deeper stretch. Lower under control; do not crash the bells into the chest.',
  },
  {
    code: 'SYS_MOV_PUSH_UP',
    name: 'Push-up',
    category: 'Push',
    equipment: 'Bodyweight',
    muscles: 'Pectorals, triceps, anterior delts, core',
    level: 'beginner',
    overview:
      'The fundamental horizontal press. Also a moving plank.',
    details:
      'Hands under the shoulders or slightly wider, body in one line. Lower until the chest is close to the floor, then press. Scale with hands on a bench or knees only if the plank holds. Elevate the feet to make it harder. Faults: sagging hips, flaring elbows, short range.',
  },
  {
    code: 'SYS_MOV_OHP',
    name: 'Overhead press',
    category: 'Push',
    equipment: 'Barbell',
    muscles: 'Delts, triceps, upper pecs, core',
    level: 'intermediate',
    overview:
      'Strict press from the front rack to lockout. Builds shoulders and trunk.',
    details:
      'Bar on the front delts, glutes tight, ribs down. Press up and slightly back so the bar finishes over mid-foot. Head moves through, then the bar. No knee dip (that is a push press). Faults: overextending the lumbar spine, pressing forward. Reduce load if the back takes over.',
  },
  {
    code: 'SYS_MOV_PUSH_PRESS',
    name: 'Push press',
    category: 'Push',
    equipment: 'Barbell or dumbbells',
    muscles: 'Delts, triceps, quads, glutes',
    level: 'intermediate',
    overview:
      'Dip and drive the bar overhead. More load than a strict press; teaches power.',
    details:
      'Soft dip in the knees, then hard drive and press. The legs start the bar; the arms finish. Catch with locked elbows. Not a jerk — no second dip under the bar. Use for conditioning or as an overhead strength builder.',
  },
  {
    code: 'SYS_MOV_DB_SHOULDER',
    name: 'Dumbbell shoulder press',
    category: 'Push',
    equipment: 'Dumbbells, bench optional',
    muscles: 'Delts, triceps',
    level: 'beginner',
    overview:
      'Seated or standing dumbbell press. Easier on the shoulders than a fixed barbell path for many people.',
    details:
      'Start at about ear height, palms forward or slightly in. Press until the biceps are by the ears. Control the lower. Seated with back support if the lumbar spine dumps. Neutral-grip (palms in) is a friendly regression.',
  },
  {
    code: 'SYS_MOV_DIP',
    name: 'Dip',
    category: 'Push',
    equipment: 'Dip bars or rings',
    muscles: 'Pectorals, triceps, anterior delts',
    level: 'intermediate',
    overview:
      'Vertical press between bars. Heavy triceps and chest when leaned forward.',
    details:
      'Support at lockout, lower until the shoulders are at least at elbow height (or as far as the shoulder allows). More upright = triceps; slight lean = chest. Scale with a band or foot-assisted. Stop if there is sharp anterior shoulder pain. Rings are harder.',
  },

  // ── Pull ───────────────────────────────────────────────
  {
    code: 'SYS_MOV_BENT_ROW',
    name: 'Bent-over row',
    category: 'Pull',
    equipment: 'Barbell or dumbbells',
    muscles: 'Lats, rhomboids, rear delts, biceps, erectors',
    level: 'intermediate',
    overview:
      'Hinged horizontal pull. Builds a thick back and teaches a stiff hinge.',
    details:
      'Hinge to about 30–45° torso, brace, pull the bar to the lower ribs / hip crease. Elbows about 45°. Lower under control. Do not bounce the torso. Pendlay (dead-stop each rep from the floor) is a stricter cousin. If the back rounds, raise the torso or lighten.',
  },
  {
    code: 'SYS_MOV_DB_ROW',
    name: 'Single-arm dumbbell row',
    category: 'Pull',
    equipment: 'Dumbbell, bench',
    muscles: 'Lats, rhomboids, biceps',
    level: 'beginner',
    overview:
      'Supported one-arm row. Easy to coach and hard to cheat if the bench is used well.',
    details:
      'Hand and knee on a bench, flat back. Pull the bell toward the hip, not the shoulder. Pause, then lower. Keep the hips square — no opening the torso. High reps work well. A meadow-style (no bench, hand on rack) is a fine variant.',
  },
  {
    code: 'SYS_MOV_CABLE_ROW',
    name: 'Seated cable row',
    category: 'Pull',
    equipment: 'Cable row',
    muscles: 'Lats, mid-back, biceps',
    level: 'beginner',
    overview:
      'Seated horizontal pull with constant tension. Friendly for new members.',
    details:
      'Sit tall, slight knee bend. Pull to the lower ribs, squeeze the shoulder blades, then reach forward without rounding hard. Do not rock the torso for momentum. Neutral or close grip is a good default.',
  },
  {
    code: 'SYS_MOV_PULL_UP',
    name: 'Pull-up',
    category: 'Pull',
    equipment: 'Pull-up bar',
    muscles: 'Lats, biceps, mid-back, core',
    level: 'intermediate',
    overview:
      'Pronated vertical pull. Gold-standard upper-body pulling strength.',
    details:
      'Dead hang, pull until the chin is over the bar (or chest to bar for advanced). Lower to a full hang. Scale with a band, jumping pull-up, or eccentric-only. Faults: kipping when the session asked for strict, half-reps, shrugging the ears. Chin-up (supinated) is usually easier.',
  },
  {
    code: 'SYS_MOV_CHIN_UP',
    name: 'Chin-up',
    category: 'Pull',
    equipment: 'Pull-up bar',
    muscles: 'Lats, biceps, mid-back',
    level: 'intermediate',
    overview:
      'Supinated vertical pull. More biceps than a pull-up; often the first unassisted bar pull.',
    details:
      'Palms facing you, shoulder-width. Same full range as a pull-up. Excellent accessory for press and pull-up volume. Band or foot-assist if needed.',
  },
  {
    code: 'SYS_MOV_LAT_PULL',
    name: 'Lat pulldown',
    category: 'Pull',
    equipment: 'Lat-pulldown machine',
    muscles: 'Lats, biceps, mid-back',
    level: 'beginner',
    overview:
      'Machine vertical pull. Teaches the pull-up pattern with adjustable load.',
    details:
      'Sit with thighs under the pad. Pull the bar to the upper chest, elbows down, slight lean. Return to a long-arm stretch. Behind-the-neck pulldowns are unnecessary for most people. Control both directions.',
  },
  {
    code: 'SYS_MOV_FACE_PULL',
    name: 'Face pull',
    category: 'Pull',
    equipment: 'Cable, rope',
    muscles: 'Rear delts, external rotators, mid-traps',
    level: 'beginner',
    overview:
      'High-cable pull to the face. Shoulder health and posture accessory.',
    details:
      'Rope at upper-chest to face height. Pull toward the nose / forehead, externally rotate so the fists finish by the ears. Light to moderate — this is not an ego lift. Great between pressing sets.',
  },
  {
    code: 'SYS_MOV_INV_ROW',
    name: 'Inverted row',
    category: 'Pull',
    equipment: 'Bar or rings',
    muscles: 'Mid-back, lats, biceps, core',
    level: 'beginner',
    overview:
      'Horizontal bodyweight row. The pull-up’s cousin and a fine scale for it.',
    details:
      'Bar at hip height, body straight, pull the chest to the bar. Walk the feet forward to make it harder, or raise them. Rings add instability. Keep the hips from sagging.',
  },

  // ── Carry ──────────────────────────────────────────────
  {
    code: 'SYS_MOV_FARMER',
    name: 'Farmer carry',
    category: 'Carry',
    equipment: 'Dumbbells, kettlebells, or farmer handles',
    muscles: 'Grip, traps, core, gait muscles',
    level: 'beginner',
    overview:
      'Heavy implements in both hands, walk. Builds grip, posture, and work capacity.',
    details:
      'Stand tall, pack the shoulders, walk in short crisp steps. Do not lean or shrug into the ears. Distance or time both work (e.g. 20–40 m or 30–45 s). Put the bells down under control. A true staple for every gym.',
  },
  {
    code: 'SYS_MOV_SUITCASE',
    name: 'Suitcase carry',
    category: 'Carry',
    equipment: 'Dumbbell or kettlebell',
    muscles: 'Obliques, grip, quadratus lumborum',
    level: 'beginner',
    overview:
      'One-sided farmer walk. Teaches the trunk to resist side-bending.',
    details:
      'One bell, stand tall as if you still had two. Do not lean away from or into the load. Switch hands each set. Excellent anti-lateral-flexion core work that looks like a walk.',
  },
  {
    code: 'SYS_MOV_FR_CARRY',
    name: 'Front-rack carry',
    category: 'Carry',
    equipment: 'Kettlebells or sandbag',
    muscles: 'Core, upper back, quads, glutes',
    level: 'intermediate',
    overview:
      'Walk with the load in the front rack. Brutal on the trunk and breathing.',
    details:
      'Two kettlebells (or a sandbag) in the rack, elbows up, ribs down. Walk without dumping the pelvis forward. Shorter distances than farmer carries. Pair with breathing resets.',
  },
  {
    code: 'SYS_MOV_OH_CARRY',
    name: 'Overhead carry',
    category: 'Carry',
    equipment: 'Kettlebell, dumbbell, or plate',
    muscles: 'Shoulders, core, upper back',
    level: 'intermediate',
    overview:
      'Walk with a load locked out overhead. Shoulder stability and midline under fatigue.',
    details:
      'Arm next to the ear, ribs down, walk smoothly. Single-arm is easier to coach than two. Stop if the elbow unlocks or the low back dumps. Light is enough.',
  },

  // ── Core ───────────────────────────────────────────────
  {
    code: 'SYS_MOV_PLANK',
    name: 'Plank',
    category: 'Core',
    equipment: 'Bodyweight',
    muscles: 'Anterior core, glutes, shoulders',
    level: 'beginner',
    overview:
      'Static prone brace. The default anti-extension hold.',
    details:
      'Elbows under shoulders, body in one line, squeeze glutes and quads. Do not sag or pike. Quality over long times — 20–40 honest seconds beats a two-minute sag. Progress to shoulder taps or a weighted plate on the back.',
  },
  {
    code: 'SYS_MOV_SIDE_PLANK',
    name: 'Side plank',
    category: 'Core',
    equipment: 'Bodyweight',
    muscles: 'Obliques, glute medius',
    level: 'beginner',
    overview:
      'Lateral brace. Builds the wall that keeps the pelvis level in single-leg work.',
    details:
      'Elbow under the shoulder, stacked or staggered feet, hips high. Top hand on the hip or reaching up. Drop to the knees to scale. Do not rotate the chest toward the floor.',
  },
  {
    code: 'SYS_MOV_DEAD_BUG',
    name: 'Dead bug',
    category: 'Core',
    equipment: 'Bodyweight',
    muscles: 'Deep anterior core',
    level: 'beginner',
    overview:
      'Supine opposite-arm/leg reach while the low back stays quiet. Superb teaching drill.',
    details:
      'Low back gently pressed to the floor, arms up, knees at 90°. Reach one arm and the opposite leg toward the floor without the ribs flaring. Exhale on the reach. Slow. If the back arches, shorten the range.',
  },
  {
    code: 'SYS_MOV_BIRD_DOG',
    name: 'Bird dog',
    category: 'Core',
    equipment: 'Bodyweight',
    muscles: 'Erectors, glutes, mid-back',
    level: 'beginner',
    overview:
      'Quadruped opposite-arm/leg reach. Anti-rotation and hip extension without a load.',
    details:
      'Hands under shoulders, knees under hips. Reach one arm and the opposite leg long — hip bones stay level. Pause. No lumbar sag. A reach-and-hold of 3–5 seconds is better than waving the limbs.',
  },
  {
    code: 'SYS_MOV_HOLLOW',
    name: 'Hollow hold',
    category: 'Core',
    equipment: 'Bodyweight',
    muscles: 'Anterior core, hip flexors',
    level: 'intermediate',
    overview:
      'Gymnastics hollow position. Hard anti-extension and a base for toes-to-bar.',
    details:
      'Lower back pressed down, shoulders off the floor, legs long and slightly off the floor. Arms by the ears if possible. Tuck the arms or bend the knees to scale. Stop if the low back peels up.',
  },
  {
    code: 'SYS_MOV_PALLOF',
    name: 'Pallof press',
    category: 'Core',
    equipment: 'Cable or band',
    muscles: 'Obliques, deep core',
    level: 'beginner',
    overview:
      'Press a band or cable out in front while refusing to rotate. Pure anti-rotation.',
    details:
      'Stand side-on to the cable at chest height. Press the handle straight out, pause, bring it back. Hips and shoulders stay square. Half-kneeling is a great coaching stance. Light load, long pauses.',
  },
  {
    code: 'SYS_MOV_HANG_KNEE',
    name: 'Hanging knee raise',
    category: 'Core',
    equipment: 'Pull-up bar',
    muscles: 'Hip flexors, abs, grip',
    level: 'beginner',
    overview:
      'Hang and lift the knees. First hanging core drill before toes-to-bar.',
    details:
      'Dead hang, ribs down, raise the knees toward the chest without swinging. Lower slowly. Progress to hanging leg raises (straight legs) then toes-to-bar. A captain’s-chair is a valid scale.',
  },
  {
    code: 'SYS_MOV_AB_WHEEL',
    name: 'Ab wheel roll-out',
    category: 'Core',
    equipment: 'Ab wheel',
    muscles: 'Anterior core, lats, shoulders',
    level: 'intermediate',
    overview:
      'Kneeling roll-out. One of the highest-tension anti-extension drills.',
    details:
      'From the knees, roll forward as far as the brace holds, then pull back. Do not let the hips sag or the low back dump. Short range first. Standing roll-outs are advanced. Stop the set when form goes.',
  },

  // ── Olympic ────────────────────────────────────────────
  {
    code: 'SYS_MOV_POWER_CLEAN',
    name: 'Power clean',
    category: 'Olympic',
    equipment: 'Barbell',
    muscles: 'Full body — hips, traps, arms, trunk',
    level: 'advanced',
    overview:
      'Explosive pull from the floor into a front rack, received above a parallel squat.',
    details:
      'Set like a deadlift, then jump the bar up and pull under into a solid front rack. Catch with the elbows high, hips above parallel (power). Drop or lower with control. Teach with hang cleans and PVC first. Not a high-rep grind — crisp singles and doubles.',
  },
  {
    code: 'SYS_MOV_HANG_CLEAN',
    name: 'Hang clean',
    category: 'Olympic',
    equipment: 'Barbell',
    muscles: 'Hips, traps, upper back, legs',
    level: 'intermediate',
    overview:
      'Clean from above the knee. Easier to teach than a full clean and great for power.',
    details:
      'Deadlift to stand, hinge to the hang, then jump and rack. Same catch as a power clean. Use for athletes who are not ready for the floor or for higher-quality power work.',
  },
  {
    code: 'SYS_MOV_PUSH_JERK',
    name: 'Push jerk',
    category: 'Olympic',
    equipment: 'Barbell',
    muscles: 'Legs, shoulders, triceps, trunk',
    level: 'advanced',
    overview:
      'Dip, drive, and drop under the bar to lockout. Heavier overhead than a push press.',
    details:
      'Dip and drive like a push press, then punch under into a partial squat with arms locked. Stand to finish. Timing matters more than load. Teach the dip-drive separately before adding the catch.',
  },
  {
    code: 'SYS_MOV_SNATCH',
    name: 'Snatch (power or full)',
    category: 'Olympic',
    equipment: 'Barbell or PVC',
    muscles: 'Full body',
    level: 'advanced',
    overview:
      'Wide-grip pull from the floor to an overhead squat or power catch. Highest-skill barbell lift.',
    details:
      'Only programme this if the coach can teach it. Start with PVC, hang muscle snatch, then power snatch. Full squat snatch needs overhead-squat mobility. Quality over kilos. Skip it if the session is a general fitness class and use a kettlebell swing or med-ball throw instead.',
  },

  // ── Plyometric ─────────────────────────────────────────
  {
    code: 'SYS_MOV_BOX_JUMP',
    name: 'Box jump',
    category: 'Plyometric',
    equipment: 'Plyo box',
    muscles: 'Quads, glutes, calves',
    level: 'beginner',
    overview:
      'Jump onto a box and stand tall. Teaches triple extension with a soft landing.',
    details:
      'Athletic stance, swing the arms, jump, land quiet with the whole foot, stand up. Step down — do not bounce off for high reps unless the session is a specific rebound drill. Choose a box they can land on safely, not the tallest in the gym. Scale to a target jump or a lower box.',
  },
  {
    code: 'SYS_MOV_BROAD_JUMP',
    name: 'Broad jump',
    category: 'Plyometric',
    equipment: 'Open floor',
    muscles: 'Glutes, hamstrings, quads',
    level: 'beginner',
    overview:
      'Horizontal jump for distance. Simple power test and training tool.',
    details:
      'Load the hips, swing the arms, jump as far as possible, stick the landing. Reset each rep unless doing bounds. Soft knees on landing. Use as a primer before lifts or as a field-sport quality.',
  },
  {
    code: 'SYS_MOV_JUMP_SQUAT',
    name: 'Jump squat',
    category: 'Plyometric',
    equipment: 'Bodyweight or light load',
    muscles: 'Quads, glutes, calves',
    level: 'beginner',
    overview:
      'Squat and jump. Fast lower-body power with little skill.',
    details:
      'Quarter to parallel squat, explode up, land soft and go again or reset. Keep the load light (or none). Not a heavy squat with a hop. Stop when landings get noisy.',
  },
  {
    code: 'SYS_MOV_SLAM',
    name: 'Medicine-ball slam',
    category: 'Plyometric',
    equipment: 'Medicine ball (non-bounce for slams)',
    muscles: 'Lats, core, shoulders, hips',
    level: 'beginner',
    overview:
      'Reach tall and slam the ball into the floor. Power and a loud finisher.',
    details:
      'Full extension overhead, then hinge and slam. Pick the ball up and repeat. Use a slam ball, not a bouncy wall ball, unless you want it back in the face. Keep the low back from rounding on the pick-up.',
  },
  {
    code: 'SYS_MOV_BURPEE',
    name: 'Burpee',
    category: 'Plyometric',
    equipment: 'Bodyweight',
    muscles: 'Full body',
    level: 'beginner',
    overview:
      'Squat, plank, push-up (optional), jump. Conditioning staple — easy to butcher.',
    details:
      'Decide the standard: chest-to-deck or step-back, jump or step-up. Write it on the whiteboard. Quality: plank in the middle, hips do not pike on the way up. Step-back burpees are a valid scale for wrists, shoulders, and new members.',
  },

  // ── Conditioning ───────────────────────────────────────
  {
    code: 'SYS_MOV_ROW',
    name: 'Rowing machine',
    category: 'Conditioning',
    equipment: 'Rower',
    muscles: 'Legs, back, arms, lungs',
    level: 'beginner',
    overview:
      'Seated rowing erg. Legs-then-body-then-arms; reverse on the return.',
    details:
      'Drive with the legs, then lean back slightly, then pull. Recover arms, body, then knees. Damper around 3–6 for most people — not 10. Tall posture. Use for metres, calories, or intervals. Teach before a class metcon.',
  },
  {
    code: 'SYS_MOV_ASSAULT',
    name: 'Assault / echo bike',
    category: 'Conditioning',
    equipment: 'Air bike',
    muscles: 'Legs, arms, lungs',
    level: 'beginner',
    overview:
      'Fan bike. Brutal, simple, joint-friendly intervals.',
    details:
      'Seated or standing. Smooth circles, not stamping. Short hard intervals (10–30 s) or longer grinds. Watch new members on the first all-out — they will go too hard. Use calories or watts as the target.',
  },
  {
    code: 'SYS_MOV_SKI',
    name: 'Ski erg',
    category: 'Conditioning',
    equipment: 'Ski erg',
    muscles: 'Lats, core, triceps, legs',
    level: 'beginner',
    overview:
      'Standing double-pole ski. Upper-body engine with a hip hinge.',
    details:
      'Reach tall, then hinge and pull the handles down past the hips. Recover with the arms. Keep the back long. Good when the legs are smoked from squats. Same scoring options as the rower.',
  },
  {
    code: 'SYS_MOV_RUN',
    name: 'Run',
    category: 'Conditioning',
    equipment: 'Track, road, or treadmill',
    muscles: 'Legs, hips, calves, lungs',
    level: 'beginner',
    overview:
      'The original conditioner. Easy to programme, easy to overdo on hard surfaces.',
    details:
      'Set the intent: easy jog, intervals, or shuttles. For deconditioned members, walk-run or a bike substitution is fine. Treadmill incline can replace speed. Warm the calves and ankles on cold mornings.',
  },
  {
    code: 'SYS_MOV_ROPES',
    name: 'Battle ropes',
    category: 'Conditioning',
    equipment: 'Battle ropes',
    muscles: 'Shoulders, arms, core, lungs',
    level: 'beginner',
    overview:
      'Wave or slam a heavy rope. High-output, low-skill finisher.',
    details:
      'Athletic stance, soft knees. Alternating waves, double waves, or slams. 15–30 second bursts. Keep the shoulders packed. Not a max-strength tool — it is an engine and a shoulder pump.',
  },
  {
    code: 'SYS_MOV_SKIP',
    name: 'Jump rope',
    category: 'Conditioning',
    equipment: 'Skipping rope',
    muscles: 'Calves, shoulders, lungs',
    level: 'beginner',
    overview:
      'Skipping for rhythm, calves, and conditioning. Excellent warm-up.',
    details:
      'Small jumps, wrists turn the rope, elbows in. Single-unders first. Double-unders only when singles are relaxed. Scale to ski or bike if the impact is too much. Rope length: handles to the armpits when you stand on the middle.',
  },

  // ── Mobility ───────────────────────────────────────────
  {
    code: 'SYS_MOV_WGS',
    name: 'World’s greatest stretch',
    category: 'Mobility',
    equipment: 'Floor',
    muscles: 'Hips, T-spine, hamstrings, ankles',
    level: 'beginner',
    overview:
      'Lunge, rotate, and hamstring stretch in one flow. Default warm-up sequence.',
    details:
      'Long lunge, back knee down or hovering, hand inside the front foot, rotate the chest open, then straighten the front leg for a hamstring stretch. Slow. Two or three per side before lifting or running.',
  },
  {
    code: 'SYS_MOV_9090',
    name: '90/90 hip sit',
    category: 'Mobility',
    equipment: 'Floor',
    muscles: 'Hips, glutes',
    level: 'beginner',
    overview:
      'Both hips at 90°. Teaches internal and external rotation you can actually use.',
    details:
      'Front shin and back shin each at 90°. Sit tall. Switch sides by sweeping the legs or lifting and resetting. Lean over the front shin for a stretch. Do not force the back hip if it pinches — raise the hips on a pad.',
  },
  {
    code: 'SYS_MOV_COUCH',
    name: 'Couch stretch',
    category: 'Mobility',
    equipment: 'Wall or bench',
    muscles: 'Hip flexors, quads',
    level: 'beginner',
    overview:
      'Rear-foot-elevated hip-flexor stretch. Counters sitting and heavy squatting.',
    details:
      'Back foot up a wall or bench, front foot planted, squeeze the rear glute and stand tall. Do not arch the low back. 45–90 seconds per side. A shorter range (foot lower) is still useful.',
  },
  {
    code: 'SYS_MOV_T_ROT',
    name: 'Open-book / T-spine rotation',
    category: 'Mobility',
    equipment: 'Floor',
    muscles: 'Thoracic spine, chest',
    level: 'beginner',
    overview:
      'Side-lying rotation to free the mid-back so the shoulders and neck stop doing all the work.',
    details:
      'Lie on the side, knees stacked at 90°. Open the top arm toward the floor behind you, follow with the eyes. Breathe. Do not yank. Great before pressing or Olympic work.',
  },
  {
    code: 'SYS_MOV_CAT_COW',
    name: 'Cat-cow',
    category: 'Mobility',
    equipment: 'Floor',
    muscles: 'Spine, core',
    level: 'beginner',
    overview:
      'Quadruped spinal flexion and extension. Gentle start for almost any session.',
    details:
      'Hands under shoulders. Round the back and tuck the pelvis (cat), then lift the chest and sit the sit-bones back slightly (cow). Slow breath. Not a max-range circus move — just wake the spine up.',
  },
  {
    code: 'SYS_MOV_ANKLE',
    name: 'Ankle rocks',
    category: 'Mobility',
    equipment: 'Floor or wall',
    muscles: 'Ankles, calves',
    level: 'beginner',
    overview:
      'Knee-over-toe rocks to restore squat depth at the ankle.',
    details:
      'Half-kneeling or standing facing a wall. Drive the knee forward over the mid-foot without the heel lifting. 8–12 slow reps per side. A plate under the toes is a cheat we use in the squat, not a replacement for this.',
  },
  {
    code: 'SYS_MOV_BAND_DISLOC',
    name: 'Band pull-apart / dislocate',
    category: 'Mobility',
    equipment: 'Light band or PVC',
    muscles: 'Rear delts, rotator cuff, pecs (stretch)',
    level: 'beginner',
    overview:
      'Shoulder-girdle warm-up. Pull-aparts for the upper back; dislocates for the whole chain.',
    details:
      'Pull-apart: band at chest height, pull wide without shrugging. Dislocate: wide grip on a band or PVC, sweep overhead and behind as far as comfortable. Pain-free range only. Use before any press.',
  },

  // ── Isolation ──────────────────────────────────────────
  {
    code: 'SYS_MOV_BICEP_CURL',
    name: 'Biceps curl',
    category: 'Isolation',
    equipment: 'Dumbbells or barbell',
    muscles: 'Biceps, brachialis',
    level: 'beginner',
    overview:
      'Elbow flexion. Accessory for arms and for pulling work.',
    details:
      'Upper arms still, curl without swinging the torso. Full stretch at the bottom, squeeze at the top. Hammer curls (neutral grip) hit the brachialis and are friendlier on the wrist. Leave ego at the door.',
  },
  {
    code: 'SYS_MOV_TRI_PUSHDOWN',
    name: 'Triceps pushdown',
    category: 'Isolation',
    equipment: 'Cable',
    muscles: 'Triceps',
    level: 'beginner',
    overview:
      'Cable elbow extension. Clean triceps volume after pressing.',
    details:
      'Elbows pinned to the sides, push the handle down to lockout, control back. Rope, bar, or band all work. Do not lean the whole body into it. Soft knees, ribs down.',
  },
  {
    code: 'SYS_MOV_SKULL',
    name: 'Skull crusher / lying triceps extension',
    category: 'Isolation',
    equipment: 'EZ-bar or dumbbells, bench',
    muscles: 'Triceps',
    level: 'intermediate',
    overview:
      'Lying elbow extension. Long-head triceps when you let the arms drift slightly back.',
    details:
      'Lower the bar toward the forehead or just behind the head, then extend. Elbows stay fairly still. Light to moderate. A French press (seated overhead extension) is the same family.',
  },
  {
    code: 'SYS_MOV_LAT_RAISE',
    name: 'Lateral raise',
    category: 'Isolation',
    equipment: 'Dumbbells or cable',
    muscles: 'Lateral delts',
    level: 'beginner',
    overview:
      'Raise the arms to the side. Builds the “cap” of the shoulder.',
    details:
      'Slight elbow bend, raise to about shoulder height, thumb slightly down or neutral — not a heavy swing. Control the lower. Cables keep tension at the bottom. If you have to heave, the bells are too heavy.',
  },
  {
    code: 'SYS_MOV_CALF_RAISE',
    name: 'Calf raise',
    category: 'Isolation',
    equipment: 'Step, machine, or smith',
    muscles: 'Gastrocnemius, soleus',
    level: 'beginner',
    overview:
      'Ankle plantarflexion. Often ignored until someone sprints or skips.',
    details:
      'Full stretch at the bottom, full squeeze at the top, pause. Straight-knee biases gastroc; bent-knee (seated) biases soleus. Slow. Single-leg on a step is plenty for most people.',
  },
  {
    code: 'SYS_MOV_LEG_CURL',
    name: 'Leg curl',
    category: 'Isolation',
    equipment: 'Lying, seated, or standing curl machine',
    muscles: 'Hamstrings',
    level: 'beginner',
    overview:
      'Knee flexion. Complements hinges so the hamstrings get both hip and knee work.',
    details:
      'Hips stay put, curl through a full range, control the eccentric. Seated curls are often more comfortable. Nordic curls are the hard cousin — only if the member is ready.',
  },
  {
    code: 'SYS_MOV_LEG_EXT',
    name: 'Leg extension',
    category: 'Isolation',
    equipment: 'Leg-extension machine',
    muscles: 'Quadriceps',
    level: 'beginner',
    overview:
      'Knee extension. Quad isolation and a useful warm-up or finisher.',
    details:
      'Pad on the lower shin, extend to lockout without slamming, lower slowly. Do not use it as the only knee-dominant work. Some knees prefer a partial top-range; listen to the member.',
  },
];

export const SYSTEM_MOVEMENT_CATALOG: import('@/lib/fitness/movement-catalog-types').CatalogDraft[] =
  [...SYSTEM_MOVEMENT_CATALOG_CORE, ...SYSTEM_MOVEMENT_CATALOG_EXTRA];

export function isSystemMovement(m: Pick<FitMovement, 'id' | 'code' | 'system'>): boolean {
  if (m.system === true) return true;
  const code = String(m.code || '');
  const id = String(m.id || '');
  return code.startsWith('SYS_MOV_') || id.startsWith('mov_sys_');
}

export function catalogIdForCode(code: string): string {
  return `mov_sys_${code.replace(/^SYS_MOV_/, '').toLowerCase()}`;
}

export function ensureSystemMovements(store: {
  movements?: FitMovement[] | null;
}): number {
  if (!store.movements) store.movements = [];
  const now = new Date().toISOString();
  let added = 0;
  for (const d of SYSTEM_MOVEMENT_CATALOG) {
    const id = catalogIdForCode(d.code);
    const existing = store.movements.find(
      (m) => m.code === d.code || m.id === id
    );
    if (existing) {
      // Backfill catalog copy without overwriting a gym's custom photo.
      if (!existing.overview) existing.overview = d.overview;
      if (!existing.details) existing.details = d.details;
      if (!existing.description) existing.description = d.details;
      if (!existing.muscles) existing.muscles = d.muscles;
      if (!existing.equipment) existing.equipment = d.equipment;
      if (!existing.level) existing.level = d.level;
      if (!existing.category) existing.category = d.category;
      existing.system = true;
      existing.code = d.code;
      continue;
    }
    store.movements.push({
      id,
      code: d.code,
      system: true,
      name: d.name,
      category: d.category,
      equipment: d.equipment,
      muscles: d.muscles,
      level: d.level,
      overview: d.overview,
      details: d.details,
      description: d.details,
      coach_id: null,
      active: true,
      created_at: now,
    });
    added += 1;
  }
  return added;
}
