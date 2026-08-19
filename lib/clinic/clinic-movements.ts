/**
 * PhysioAdvisor rehab movement library + client-facing shares.
 * Catalogue is seeded onto physiograph.movements; shares live on the patient.
 */
import {
  defaultExerciseImageSrc,
  defaultExerciseVideoSrc,
  isExerciseCatalogCode,
  mergeCatalogWithOverrides,
} from '@/lib/movements/exercise-catalog';

export const CLINIC_MOVEMENT_CATEGORIES = [
  'Neck / cervical',
  'Shoulder',
  'Elbow / wrist / hand',
  'Thoracic spine',
  'Lumbar / core',
  'Hip',
  'Knee',
  'Ankle / foot',
  'Balance / proprioception',
  'Nerve glides',
  'Breathing',
  'Gait / functional',
  'Early / post-op',
  'Stretching',
  'Cardio (rehab)',
] as const;

export type ClinicMovementCategory =
  (typeof CLINIC_MOVEMENT_CATEGORIES)[number];

export type ClinicMovement = {
  id: string;
  code?: string;
  name: string;
  category: string;
  modality?: string;
  muscle_group?: string;
  movement_pattern?: string;
  scoring?: string;
  tags?: string[];
  equipment?: string;
  muscles?: string;
  level?: 'beginner' | 'intermediate' | 'advanced' | string;
  overview?: string;
  details?: string;
  image_url?: string | null;
  video_url?: string | null;
  system?: boolean;
  active?: boolean;
  created_at: string;
  updated_at?: string;
};

export type PatientMovementShare = {
  id: string;
  movement_id: string;
  movement_name: string;
  category?: string;
  overview?: string;
  details?: string;
  image_url?: string | null;
  video_url?: string | null;
  sets?: string | null;
  reps?: string | null;
  hold?: string | null;
  frequency?: string | null;
  notes?: string;
  appointment_id?: string | null;
  booking_id?: string | null;
  shared_by?: string | null;
  shared_at: string;
  status?: 'active' | 'completed' | 'stopped' | string;
};

export type PatientClientNote = {
  id: string;
  body: string;
  appointment_id?: string | null;
  booking_id?: string | null;
  author_name?: string | null;
  created_at: string;
};

export type ClinicMovementDraft = {
  code: string;
  name: string;
  category: ClinicMovementCategory | string;
  equipment: string;
  muscles: string;
  level: 'beginner' | 'intermediate' | 'advanced';
  overview: string;
  details: string;
};

const D = (
  code: string,
  name: string,
  category: ClinicMovementCategory,
  equipment: string,
  muscles: string,
  level: ClinicMovementDraft['level'],
  overview: string,
  details: string
): ClinicMovementDraft => ({
  code,
  name,
  category,
  equipment,
  muscles,
  level,
  overview,
  details,
});

/** Exhaustive starter rehab catalogue — seeded for every physio clinic. */
export const SYSTEM_CLINIC_MOVEMENT_CATALOG: ClinicMovementDraft[] = [
  // Neck
  D('PHY_MOV_CHIN_TUCK', 'Chin tuck', 'Neck / cervical', 'None', 'Deep neck flexors', 'beginner', 'Gentle chin-in to restore neck alignment.', 'Sit or stand tall. Draw the chin straight back (not down) as if making a double chin. Hold 5 seconds. Stop if dizziness or arm pain increases.'),
  D('PHY_MOV_CERVICAL_ROTATION', 'Cervical rotation (pain-free)', 'Neck / cervical', 'None', 'Cervical rotators', 'beginner', 'Turn the head within a comfortable range.', 'Look over one shoulder, pause, return. Do not force the end range. Use a towel wrap for extra comfort if advised.'),
  D('PHY_MOV_CERVICAL_LAT_FLEX', 'Cervical side bend', 'Neck / cervical', 'None', 'Upper trapezius, scalenes', 'beginner', 'Ear toward shoulder without shrugging.', 'Keep the nose facing forward. Hold 20–30 seconds. Do not lift the opposite shoulder.'),
  D('PHY_MOV_UPPER_TRAP_STRETCH', 'Upper trapezius stretch', 'Neck / cervical', 'None', 'Upper trapezius', 'beginner', 'Side-bend the neck away from a tight shoulder.', 'Sit on the hand of the tight side. Tilt the opposite ear toward the shoulder. Gentle only.'),
  D('PHY_MOV_LEVATOR_STRETCH', 'Levator scapulae stretch', 'Neck / cervical', 'None', 'Levator scapulae', 'beginner', 'Nose toward armpit stretch for the back-corner of the neck.', 'Turn 45° then nod. Hold 20–30 seconds. Breathe.'),
  D('PHY_MOV_CERVICAL_EXT_ISO', 'Cervical extension isometrics', 'Neck / cervical', 'Hand or towel', 'Cervical extensors', 'beginner', 'Push the head back into a hand without moving.', 'Hand on the back of the head. Push 20–30% effort for 5–8 seconds. No pain into the arm.'),
  D('PHY_MOV_CERVICAL_FLEX_ISO', 'Cervical flexion isometrics', 'Neck / cervical', 'Hand', 'Deep neck flexors', 'beginner', 'Push the forehead into a hand without nodding hard.', 'Light pressure only. Keep the jaw relaxed.'),
  D('PHY_MOV_SCAP_SQUEEZE', 'Scapular squeeze', 'Neck / cervical', 'None', 'Middle trapezius, rhomboids', 'beginner', 'Gently draw the shoulder blades together and down.', 'Do not shrug. Hold 5 seconds. Pair with chin tuck if posture is the goal.'),

  // Shoulder
  D('PHY_MOV_PENDULUM', 'Pendulum (Codman)', 'Shoulder', 'None or light weight', 'Shoulder girdle', 'beginner', 'Early-range hanging circles after injury or surgery.', 'Lean on a table, let the arm hang, sway the body so the arm draws small circles. The arm stays relaxed.'),
  D('PHY_MOV_WAND_FLEX', 'Wand / stick flexion', 'Shoulder', 'Stick or broom', 'Shoulder flexors', 'beginner', 'Use the good arm to lift the sore arm forward.', 'Both hands on a stick. Good arm drives. Stop before a sharp pinch.'),
  D('PHY_MOV_WAND_ABD', 'Wand / stick abduction', 'Shoulder', 'Stick', 'Deltoid, rotator cuff', 'beginner', 'Good arm lifts the sore arm out to the side.', 'Keep the thumb up. Do not hike the shoulder.'),
  D('PHY_MOV_TABLE_SLIDE', 'Table slides', 'Shoulder', 'Towel on table', 'Shoulder flexors', 'beginner', 'Slide the hand forward on a table to restore flexion.', 'Sit tall, towel under the hand, slide until a stretch, return.'),
  D('PHY_MOV_WALL_WALK', 'Wall walks', 'Shoulder', 'Wall', 'Shoulder flexors / abductors', 'beginner', 'Walk the fingers up the wall.', 'Stand close enough that the shoulder stays down. Mark the highest comfortable height.'),
  D('PHY_MOV_ER_SIDE', 'Side-lying external rotation', 'Shoulder', 'Light dumbbell or band', 'Infraspinatus, teres minor', 'beginner', 'Classic rotator-cuff strength.', 'Elbow tucked to the ribs, rotate the forearm up. Slow down.'),
  D('PHY_MOV_IR_BAND', 'Internal rotation (band)', 'Shoulder', 'Resistance band', 'Subscapularis', 'beginner', 'Rotate the forearm toward the belly against a band.', 'Elbow glued to the side. No shrugging.'),
  D('PHY_MOV_ER_BAND_0', 'External rotation at 0° (band)', 'Shoulder', 'Resistance band', 'Infraspinatus', 'beginner', 'Rotate the forearm out with the elbow at the side.', 'Towel roll in the armpit if that keeps the elbow tucked.'),
  D('PHY_MOV_ER_BAND_90', 'External rotation at 90°', 'Shoulder', 'Band', 'Rotator cuff, deltoid', 'intermediate', 'Arm out to the side, rotate the forearm back.', 'Only when pain-free at 90° abduction.'),
  D('PHY_MOV_PRONE_YTW', 'Prone Y / T / W', 'Shoulder', 'Mat, optional light weights', 'Lower trapezius, rhomboids', 'intermediate', 'Scapular endurance on the stomach.', 'Thumbs up for Y and T. Squeeze the blades down and back. Neck stays long.'),
  D('PHY_MOV_SERRATUS_PUNCH', 'Serratus punch / plus', 'Shoulder', 'None or light weight', 'Serratus anterior', 'beginner', 'Reach the arm to the ceiling to wrap the scapula.', 'Do not shrug. The movement is the last 5 cm of reach.'),
  D('PHY_MOV_WALL_ANGEL', 'Wall angels', 'Shoulder', 'Wall', 'Scapular stabilisers', 'intermediate', 'Arms slide on the wall while ribs stay down.', 'Back of the head and sacrum stay on the wall. Smaller range is fine.'),
  D('PHY_MOV_ISOMETRIC_ER', 'Isometric external rotation', 'Shoulder', 'Wall or doorframe', 'Rotator cuff', 'beginner', 'Push the back of the hand into a wall without moving.', 'Elbow bent 90°. 5–8 second holds.'),
  D('PHY_MOV_CROSS_BODY', 'Cross-body posterior stretch', 'Shoulder', 'None', 'Posterior capsule', 'beginner', 'Bring the arm across the chest.', 'Do not shrug. Hold 20–30 seconds.'),

  // Elbow / wrist / hand
  D('PHY_MOV_WRIST_EXT_ECC', 'Eccentric wrist extension', 'Elbow / wrist / hand', 'Light dumbbell', 'Wrist extensors', 'beginner', 'Tennis-elbow loading: lift with two hands, lower with one.', 'Forearm supported, palm down. Slow 3–4 second lower.'),
  D('PHY_MOV_WRIST_FLEX_ECC', 'Eccentric wrist flexion', 'Elbow / wrist / hand', 'Light dumbbell', 'Wrist flexors', 'beginner', 'Golfer-elbow loading.', 'Palm up. Lift with two hands, lower with one.'),
  D('PHY_MOV_GRIP_SQUEEZE', 'Grip squeeze', 'Elbow / wrist / hand', 'Ball or putty', 'Forearm flexors', 'beginner', 'Gentle grip endurance.', 'Squeeze 5 seconds, relax fully. Avoid pain above 3/10.'),
  D('PHY_MOV_MEDIAN_GLIDE', 'Median nerve slider', 'Nerve glides', 'None', 'Median nerve', 'intermediate', 'Gentle sliding of the median nerve.', 'Wrist and neck move in opposite directions. No lingering pins-and-needles.'),
  D('PHY_MOV_ULNAR_GLIDE', 'Ulnar nerve slider', 'Nerve glides', 'None', 'Ulnar nerve', 'intermediate', 'OK-sign mask position, then uncurl.', 'Stay short of a strong electric feeling.'),
  D('PHY_MOV_TENDON_GLIDE', 'Tendon glides (hand)', 'Elbow / wrist / hand', 'None', 'Finger flexors', 'beginner', 'Hook, fist, table-top, straight-fist sequence.', 'Move slowly through each position. 5–10 cycles.'),
  D('PHY_MOV_PRAYER_STRETCH', 'Prayer stretch', 'Elbow / wrist / hand', 'None', 'Wrist flexors', 'beginner', 'Palms together, lower the hands to stretch the wrists.', 'Elbows stay up. Hold 20–30 seconds.'),

  // Thoracic
  D('PHY_MOV_OPEN_BOOK', 'Open book', 'Thoracic spine', 'Mat', 'Thoracic rotators', 'beginner', 'Side-lying rotation to open the chest.', 'Knees stacked. Top arm opens like a book. Breathe into the stretch.'),
  D('PHY_MOV_THREAD_NEEDLE', 'Thread the needle', 'Thoracic spine', 'Mat', 'Thoracic rotators', 'beginner', 'On all fours, thread one arm under the other.', 'Hips stay over the knees. Move with the breath.'),
  D('PHY_MOV_FOAM_THORACIC', 'Foam-roller thoracic extension', 'Thoracic spine', 'Foam roller', 'Thoracic extensors', 'beginner', 'Lie over a roller to extend the mid-back.', 'Support the head. Do not crank the low back. Small rolls.'),
  D('PHY_MOV_CAT_CAMEL', 'Cat–camel', 'Thoracic spine', 'Mat', 'Spinal movers', 'beginner', 'Slow flexion and extension on all fours.', 'Move segment by segment. Pain-free range only.'),
  D('PHY_MOV_WALL_SNOW_ANGEL', 'Wall snow angels', 'Thoracic spine', 'Wall', 'Postural muscles', 'beginner', 'Slide the arms on the wall with a tall chest.', 'Ribs stay down. Smaller range if the low back arches.'),

  // Lumbar / core
  D('PHY_MOV_PELVIC_TILT', 'Pelvic tilt', 'Lumbar / core', 'Mat', 'Transversus, multifidus', 'beginner', 'Flatten the low back gently into the floor.', 'Breathe. Do not jam the ribs. 5–8 second holds.'),
  D('PHY_MOV_DEAD_BUG', 'Dead bug', 'Lumbar / core', 'Mat', 'Deep core', 'beginner', 'Opposite arm and leg reach while the back stays quiet.', 'Exhale as the limbs move. Stop if the back arches.'),
  D('PHY_MOV_BIRD_DOG', 'Bird dog', 'Lumbar / core', 'Mat', 'Multifidus, glute max', 'beginner', 'Opposite arm and leg reach on all fours.', 'Imagine a glass of water on the low back. Slow.'),
  D('PHY_MOV_SIDE_PLANK_KNEE', 'Side plank (knees)', 'Lumbar / core', 'Mat', 'Obliques, QL', 'beginner', 'Short-lever side plank.', 'Hips stacked. 10–20 second holds.'),
  D('PHY_MOV_SIDE_PLANK', 'Side plank', 'Lumbar / core', 'Mat', 'Obliques, QL', 'intermediate', 'Full side plank on the feet.', 'Only when the knee version is easy and pain-free.'),
  D('PHY_MOV_FRONT_PLANK', 'Front plank', 'Lumbar / core', 'Mat', 'Anterior core', 'intermediate', 'Brace on elbows and toes (or knees).', 'Ribs down, glutes on. Do not sag.'),
  D('PHY_MOV_KNEE_ROCK', 'Knee rocks / lumbar rotation', 'Lumbar / core', 'Mat', 'Lumbar rotators', 'beginner', 'Knees fall side to side while the shoulders stay down.', 'Small, comfortable arcs.'),
  D('PHY_MOV_KNEE_TO_CHEST', 'Single knee to chest', 'Lumbar / core', 'Mat', 'Lumbar extensors, glute', 'beginner', 'Hug one knee toward the chest.', 'Other leg bent or straight as advised. Hold 20–30 seconds.'),
  D('PHY_MOV_DKTC', 'Double knee to chest', 'Lumbar / core', 'Mat', 'Lumbar extensors', 'beginner', 'Hug both knees.', 'Stop if this increases leg pain.'),
  D('PHY_MOV_PRESS_UP', 'Prone press-up (McKenzie)', 'Lumbar / core', 'Mat', 'Lumbar extensors', 'intermediate', 'Press the chest up, hips stay down.', 'Only if it centralises symptoms. Stop if pain goes further down the leg.'),
  D('PHY_MOV_BRIDGE', 'Glute bridge', 'Lumbar / core', 'Mat', 'Glute max, hamstrings', 'beginner', 'Lift the hips by squeezing the glutes.', 'Do not over-arch. Pause at the top.'),
  D('PHY_MOV_CURL_UP', 'McGill curl-up', 'Lumbar / core', 'Mat', 'Rectus abdominis', 'beginner', 'Tiny curl with one knee bent, hands under the low back.', 'Head and shoulders lift 2–3 cm. No sit-up.'),

  // Hip
  D('PHY_MOV_CLAM', 'Clamshell', 'Hip', 'Band optional', 'Glute med', 'beginner', 'Side-lying, open the top knee without rolling back.', 'Feet stay together. Slow.'),
  D('PHY_MOV_SIDELYING_ABD', 'Side-lying hip abduction', 'Hip', 'None', 'Glute med', 'beginner', 'Lift the top leg toward the ceiling.', 'Toes slightly down. Do not roll the pelvis back.'),
  D('PHY_MOV_MONSTER_WALK', 'Monster / band walks', 'Hip', 'Mini-band', 'Glute med', 'intermediate', 'Side or diagonal steps with a band at the knees or ankles.', 'Soft knees, stay low, no waddle.'),
  D('PHY_MOV_HIP_FLEX_STRETCH', 'Half-kneeling hip-flexor stretch', 'Hip', 'None', 'Iliopsoas, rec fem', 'beginner', 'Tuck the pelvis then shift forward.', 'Back toes tucked. Do not arch the low back.'),
  D('PHY_MOV_PIRIFORMIS', 'Piriformis / figure-4 stretch', 'Hip', 'Mat', 'Piriformis, deep rotators', 'beginner', 'Ankle on opposite knee, draw the thigh in.', 'Keep the head down. Hold 20–30 seconds.'),
  D('PHY_MOV_90_90', '90/90 hip switches', 'Hip', 'Mat', 'Hip rotators', 'intermediate', 'Sit with both knees bent 90°, switch sides.', 'Use the hands at first. Move slowly.'),
  D('PHY_MOV_HIP_AIRPLANE', 'Hip airplane', 'Hip', 'None', 'Glute med, rotators', 'advanced', 'Single-leg hinge with open/close of the pelvis.', 'Only when balance and hinge are solid.'),
  D('PHY_MOV_ADDUCTOR_ROCK', 'Adductor rock-back', 'Hip', 'Mat', 'Adductors', 'beginner', 'Kneeling with one leg out, sit the hips back.', 'Keep the out-leg toes up. Gentle stretch.'),
  D('PHY_MOV_SQUAT_TO_CHAIR', 'Sit-to-stand', 'Hip', 'Chair', 'Quads, glutes', 'beginner', 'Stand from a chair without using the hands if able.', 'Nose over toes, push the floor away.'),

  // Knee
  D('PHY_MOV_QUAD_SET', 'Quad set', 'Knee', 'Towel roll optional', 'Quadriceps', 'beginner', 'Tighten the thigh and press the knee down.', 'Hold 5–8 seconds. A towel under the knee can help the cue.'),
  D('PHY_MOV_SLR', 'Straight-leg raise', 'Knee', 'None', 'Quadriceps', 'beginner', 'Lift a straight leg while the thigh stays tight.', 'Other knee bent. If the knee bends, go back to quad sets.'),
  D('PHY_MOV_SAQ', 'Short-arc quads', 'Knee', 'Towel roll or bolster', 'VMO, quads', 'beginner', 'Straighten the knee over a roll.', 'Slow lower. Add a 2-second squeeze at the top.'),
  D('PHY_MOV_HEEL_SLIDE', 'Heel slides', 'Knee', 'Towel on floor or bed', 'Hamstrings, quads', 'beginner', 'Slide the heel toward the buttock to bend the knee.', 'Use a towel around the foot if the knee is stiff.'),
  D('PHY_MOV_TKR_BEND', 'Seated knee flexion (assist)', 'Knee', 'Chair, good leg', 'Knee flexors', 'beginner', 'Use the good foot to help the sore knee bend.', 'Hold the new range 5 seconds, then ease back.'),
  D('PHY_MOV_TERMINAL_KNEE', 'Terminal knee extension (band)', 'Knee', 'Band', 'VMO, quads', 'beginner', 'Stand, band behind the knee, straighten against it.', 'Do not snap into lock. Control the last 20°.'),
  D('PHY_MOV_STEP_UP', 'Step-up', 'Knee', 'Low step', 'Quads, glutes', 'intermediate', 'Step onto a low box, control the lower.', 'Start 10–15 cm. Knee tracks over the 2nd toe.'),
  D('PHY_MOV_LATERAL_STEP', 'Lateral step-down', 'Knee', 'Low step', 'Quads, glute med', 'intermediate', 'Stand on a step, tap the opposite heel down.', 'Do not let the knee cave in.'),
  D('PHY_MOV_WALL_SIT', 'Wall sit', 'Knee', 'Wall', 'Quads', 'intermediate', 'Slide down the wall to a comfortable knee angle.', 'Start high (30–40°). Build time before depth.'),
  D('PHY_MOV_HAM_CURL', 'Prone or standing hamstring curl', 'Knee', 'None or band', 'Hamstrings', 'beginner', 'Bend the knee, lower slowly.', 'Do not cramp — smaller range if the muscle grabs.'),
  D('PHY_MOV_HAM_STRETCH', 'Supine hamstring stretch', 'Knee', 'Strap or towel', 'Hamstrings', 'beginner', 'Leg up, strap on the foot, keep the knee soft.', 'Hold 20–30 seconds. Do not bounce.'),

  // Ankle / foot
  D('PHY_MOV_ANKLE_PUMP', 'Ankle pumps', 'Ankle / foot', 'None', 'Tibialis anterior, calf', 'beginner', 'Point and flex the foot to move swelling and restore ROM.', 'Hourly after injury or surgery if advised.'),
  D('PHY_MOV_ANKLE_ABC', 'Ankle alphabet', 'Ankle / foot', 'None', 'Ankle movers', 'beginner', 'Write the alphabet with the big toe.', 'Small letters. Pain-free.'),
  D('PHY_MOV_THERABAND_INV', 'Band inversion / eversion', 'Ankle / foot', 'Band', 'Tib post, peroneals', 'beginner', 'Turn the sole in then out against a band.', 'Knee stays still. Slow.'),
  D('PHY_MOV_CALF_RAISE', 'Calf raise (two-leg then one)', 'Ankle / foot', 'Step optional', 'Gastroc, soleus', 'beginner', 'Rise onto the toes, lower slowly.', 'Use a wall for balance. Progress to single-leg.'),
  D('PHY_MOV_SOLEUS_RAISE', 'Bent-knee calf raise', 'Ankle / foot', 'None', 'Soleus', 'beginner', 'Soft knees, rise onto the toes.', 'Keeps the load on soleus.'),
  D('PHY_MOV_GASTROC_STRETCH', 'Gastroc stretch (straight knee)', 'Ankle / foot', 'Wall', 'Gastrocnemius', 'beginner', 'Back heel down, back knee straight.', 'Hold 20–30 seconds.'),
  D('PHY_MOV_SOLEUS_STRETCH', 'Soleus stretch (bent knee)', 'Ankle / foot', 'Wall', 'Soleus', 'beginner', 'Same stance, bend the back knee.', 'Heel stays down.'),
  D('PHY_MOV_TOWEL_SCRUNCH', 'Towel scrunches', 'Ankle / foot', 'Towel', 'Intrinsic foot', 'beginner', 'Sit, scrunch a towel toward you with the toes.', 'Do not let the whole foot hop.'),
  D('PHY_MOV_SHORT_FOOT', 'Short foot / arch lift', 'Ankle / foot', 'None', 'Intrinsic foot', 'beginner', 'Shorten the foot to lift the arch without curling toes hard.', 'Hold 5 seconds. Subtle.'),

  // Balance
  D('PHY_MOV_SLS', 'Single-leg stance', 'Balance / proprioception', 'None, near a bench', 'Ankle, hip, core', 'beginner', 'Stand on one leg, eyes open then progress.', '30–45 seconds. Progress: turn the head, then eyes closed.'),
  D('PHY_MOV_TANDEM', 'Tandem stance', 'Balance / proprioception', 'None', 'Ankle, hip', 'beginner', 'Heel-to-toe stand.', 'Near a counter. Switch which foot is in front.'),
  D('PHY_MOV_TANDEM_WALK', 'Tandem walk', 'Balance / proprioception', 'Hallway', 'Ankle, hip', 'intermediate', 'Walk heel-to-toe as if on a beam.', 'Slow. Eyes on a spot ahead.'),
  D('PHY_MOV_WOBBLE', 'Wobble cushion / foam stance', 'Balance / proprioception', 'Cushion or foam', 'Ankle, hip', 'intermediate', 'Stand on an unstable surface.', 'Two feet first. Stop if the ankle is still very irritable.'),

  // Nerve
  D('PHY_MOV_SLIDER_SCIATIC', 'Sciatic nerve slider', 'Nerve glides', 'Mat or chair', 'Sciatic nerve', 'intermediate', 'Straighten the knee as the head looks up; reverse together.', 'A gentle stretch is fine. No lingering pins-and-needles.'),
  D('PHY_MOV_TENSIONER_SCIATIC', 'Sciatic nerve tensioner (advanced)', 'Nerve glides', 'Mat', 'Sciatic nerve', 'advanced', 'Knee straight and chin tucked together.', 'Only if the slider is easy and the clinician asked for it.'),
  D('PHY_MOV_FEMORAL_SLIDE', 'Femoral nerve slider', 'Nerve glides', 'Side-lying', 'Femoral nerve', 'intermediate', 'Bend the knee while looking down, reverse.', 'Small range. Stop if thigh pain spikes.'),

  // Breathing
  D('PHY_MOV_DIAPHRAGM', 'Diaphragmatic breathing', 'Breathing', 'None', 'Diaphragm', 'beginner', 'Belly rises on the inhale, ribs widen.', 'One hand on chest, one on belly. 6–8 slow breaths.'),
  D('PHY_MOV_CROCODILE', 'Crocodile breathing', 'Breathing', 'Mat', 'Diaphragm', 'beginner', 'Lie on the stomach so the belly presses the floor on inhale.', 'Relax the shoulders. 8–10 breaths.'),
  D('PHY_MOV_LATERAL_COSTAL', 'Lateral costal breathing', 'Breathing', 'Hands on ribs', 'Intercostals, diaphragm', 'beginner', 'Breathe into the sides of the ribcage.', 'Useful after thoracic or shoulder work.'),

  // Gait / functional
  D('PHY_MOV_HEEL_TOE_WALK', 'Heel-walk / toe-walk', 'Gait / functional', 'Hallway', 'Tib ant, calf', 'beginner', 'Walk on heels, then on toes.', '10–20 metres each. Near a rail if balance is poor.'),
  D('PHY_MOV_STEP_TAP', 'Step taps', 'Gait / functional', 'Low step', 'Quads, hip flexors', 'beginner', 'Tap the step, then progress to full step-ups.', 'Even rhythm.'),
  D('PHY_MOV_SIT_TO_WALK', 'Sit-to-stand then walk', 'Gait / functional', 'Chair', 'Quads, glutes', 'beginner', 'Stand, take three steps, turn, sit.', 'Practise the transfer the client uses at home.'),
  D('PHY_MOV_LUNGE', 'Split squat / static lunge', 'Gait / functional', 'None', 'Quads, glutes', 'intermediate', 'Drop the back knee, front shin stays vertical.', 'Hold a bench. Small depth first.'),
  D('PHY_MOV_HIP_HINGE', 'Hip hinge (dowel)', 'Gait / functional', 'Stick', 'Hamstrings, glutes', 'beginner', 'Push the hips back, stick along the spine.', 'Soft knees. The stick stays on head, mid-back and sacrum.'),

  // Early / post-op
  D('PHY_MOV_GLUTE_SET', 'Glute set', 'Early / post-op', 'None', 'Glute max', 'beginner', 'Squeeze the buttocks without moving the hip.', '5–8 second holds. Hourly after hip or lumbar surgery if advised.'),
  D('PHY_MOV_QUAD_SET_EARLY', 'Early quad set (pain-free)', 'Early / post-op', 'Towel', 'Quadriceps', 'beginner', 'Wake the thigh without forcing full lock.', 'Stop at a 3/10 ache.'),
  D('PHY_MOV_HEEL_PROP', 'Heel prop (knee extension)', 'Early / post-op', 'Towel roll under heel', 'Quads, posterior capsule', 'beginner', 'Let the knee hang toward straight.', '5–10 minutes if comfortable. Ice after if swollen.'),
  D('PHY_MOV_CIRCUMDUCTION_HIP', 'Supine hip circumduction (assisted)', 'Early / post-op', 'None or strap', 'Hip movers', 'beginner', 'Small circles with a nearly straight leg.', 'Only the range the surgeon allowed.'),
  D('PHY_MOV_WEIGHT_SHIFT', 'Weight shift in standing', 'Early / post-op', 'Rails or bench', 'Hip, knee, ankle', 'beginner', 'Shift onto the operated side without a limp.', 'Even seconds on each foot.'),

  // Stretching extras
  D('PHY_MOV_PEC_DOOR', 'Pec doorway stretch', 'Stretching', 'Doorframe', 'Pectoralis major/minor', 'beginner', 'Forearm on the frame, step through.', 'Ribs down. 20–30 seconds.'),
  D('PHY_MOV_LAT_STRETCH', 'Child’s pose / lat stretch', 'Stretching', 'Mat', 'Lats, lumbar', 'beginner', 'Sit the hips back, walk the hands away.', 'Walk the hands to one side to bias a lat.'),
  D('PHY_MOV_ITB_ROLL', 'Lateral thigh foam roll', 'Stretching', 'Foam roller', 'TFL / ITB complex', 'intermediate', 'Roll the outside of the thigh slowly.', '20–30 seconds. Do not crush the knee joint.'),
  D('PHY_MOV_QUAD_STRETCH', 'Standing quad stretch', 'Stretching', 'Wall for balance', 'Rectus femoris', 'beginner', 'Heel to buttock, tuck the pelvis.', 'Knees stay close. Hold 20–30 seconds.'),

  // Cardio rehab
  D('PHY_MOV_MARCH_SEATED', 'Seated marching', 'Cardio (rehab)', 'Chair', 'Hip flexors', 'beginner', 'March the knees in the chair.', '1–3 minutes. Tall sit.'),
  D('PHY_MOV_MARCH_STANDING', 'Standing marching', 'Cardio (rehab)', 'None', 'Hip flexors, calves', 'beginner', 'March on the spot, opposite arm swing.', 'Near a bench. Easy breathing.'),
  D('PHY_MOV_STATIONARY_BIKE', 'Stationary bike (easy)', 'Cardio (rehab)', 'Bike', 'Quads, cardio', 'beginner', 'Low resistance, smooth circles.', 'Seat height: slight knee bend at the bottom. Stop if swelling spikes.'),
  D('PHY_MOV_WALK_PROG', 'Walk / rest programme', 'Cardio (rehab)', 'None', 'Whole body', 'beginner', 'Short walks with planned rests.', 'Start with a time the client can finish well, then add 1–2 minutes.'),
];

export function clinicMovementCatalogId(code: string): string {
  return `cmov_sys_${String(code || '')
    .replace(/^PHY_MOV_/, '')
    .toLowerCase()}`;
}

export function isSystemClinicMovement(m: {
  id?: string;
  code?: string;
  system?: boolean;
}): boolean {
  if (m.system === true) return true;
  const code = String(m.code || '');
  const id = String(m.id || '');
  return (
    code.startsWith('PHY_MOV_') ||
    code.startsWith('EX_') ||
    id.startsWith('cmov_sys_') ||
    id.startsWith('mov_ex_') ||
    isExerciseCatalogCode(code)
  );
}

export function ensureSystemClinicMovements(store: {
  movements?: ClinicMovement[] | null;
}): number {
  if (!store.movements) store.movements = [];
  const now = new Date().toISOString();
  let added = 0;
  for (const d of SYSTEM_CLINIC_MOVEMENT_CATALOG) {
    const id = clinicMovementCatalogId(d.code);
    const existing = store.movements.find((m) => m.code === d.code || m.id === id);
    if (existing) {
      if (!existing.overview) existing.overview = d.overview;
      if (!existing.details) existing.details = d.details;
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
      image_url: defaultExerciseImageSrc(d.name, ''),
      video_url: defaultExerciseVideoSrc(''),
      active: true,
      created_at: now,
    });
    added += 1;
  }
  return added;
}

/** Full library: 2,520-exercise catalogue + physio rehab extras / overrides. */
export function listedClinicMovements(store: {
  movements?: ClinicMovement[] | null;
}): ClinicMovement[] {
  const now = new Date().toISOString();
  return mergeCatalogWithOverrides(store.movements || [], (row, override) => {
    const customImage = String(override?.image_url || '').trim();
    const customVideo = String(override?.video_url || '').trim();
    return {
      id: override?.id || row.id,
      code: row.code,
      name: override?.name || row.name,
      category: override?.category || row.muscle_group || row.category,
      modality: override?.modality || row.modality,
      muscle_group: override?.muscle_group || row.muscle_group,
      movement_pattern: override?.movement_pattern || row.movement_pattern,
      scoring: override?.scoring || row.scoring,
      equipment: override?.equipment || row.equipment,
      muscles: override?.muscles || row.muscles,
      level: override?.level || row.level,
      overview: override?.overview || row.overview,
      details: override?.details || row.details,
      image_url: customImage || row.image_url,
      video_url: customVideo || row.video_url,
      system: true,
      active: override?.active !== false,
      created_at: override?.created_at || now,
      updated_at: override?.updated_at,
    };
  }).map((m) => {
    const media = clinicMovementMedia(m);
    return { ...m, image_url: media.image_url, video_url: media.video_url };
  });
}

export function clinicMovementMedia(m: {
  name?: string;
  movement_pattern?: string | null;
  image_url?: string | null;
  video_url?: string | null;
}): { image_url: string; video_url: string } {
  return {
    image_url:
      String(m.image_url || '').trim() ||
      defaultExerciseImageSrc(String(m.name || ''), m.movement_pattern),
    video_url:
      String(m.video_url || '').trim() ||
      defaultExerciseVideoSrc(m.movement_pattern),
  };
}

export function upsertClinicMovement(
  list: ClinicMovement[],
  rec: Record<string, unknown>,
  now: string,
  newId: (prefix: string) => string
): ClinicMovement {
  const id = String(rec.id || newId('cmov'));
  const i = list.findIndex((m) => m.id === id);
  const prev = i >= 0 ? list[i] : null;
  const row: ClinicMovement = {
    id,
    code: rec.code != null ? String(rec.code) : prev?.code,
    name: String(rec.name || prev?.name || 'Movement'),
    category: String(rec.category || prev?.category || 'Other'),
    equipment:
      rec.equipment !== undefined
        ? rec.equipment
          ? String(rec.equipment)
          : undefined
        : prev?.equipment,
    muscles:
      rec.muscles !== undefined
        ? rec.muscles
          ? String(rec.muscles)
          : undefined
        : prev?.muscles,
    level:
      rec.level !== undefined
        ? rec.level
          ? String(rec.level)
          : undefined
        : prev?.level,
    overview:
      rec.overview !== undefined
        ? rec.overview
          ? String(rec.overview)
          : undefined
        : prev?.overview,
    details:
      rec.details !== undefined
        ? rec.details
          ? String(rec.details)
          : undefined
        : prev?.details,
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
    system: prev?.system === true || rec.system === true,
    active: rec.active !== undefined ? rec.active !== false : prev?.active !== false,
    created_at: prev?.created_at || now,
    updated_at: now,
  };
  if (i >= 0) list[i] = row;
  else list.push(row);
  return row;
}

export function shareMovementWithPatient(
  patient: { shared_movements?: PatientMovementShare[] },
  opts: {
    movement: ClinicMovement;
    sets?: string | null;
    reps?: string | null;
    hold?: string | null;
    frequency?: string | null;
    notes?: string;
    appointment_id?: string | null;
    booking_id?: string | null;
    shared_by?: string | null;
    now?: string;
    id?: string;
  }
): PatientMovementShare {
  const now = opts.now || new Date().toISOString();
  const row: PatientMovementShare = {
    id:
      opts.id ||
      `pshare_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    movement_id: opts.movement.id,
    movement_name: opts.movement.name,
    category: opts.movement.category,
    overview: opts.movement.overview,
    details: opts.movement.details,
    image_url: opts.movement.image_url,
    video_url: opts.movement.video_url,
    sets: opts.sets || null,
    reps: opts.reps || null,
    hold: opts.hold || null,
    frequency: opts.frequency || null,
    notes: opts.notes || undefined,
    appointment_id: opts.appointment_id ?? null,
    booking_id: opts.booking_id ?? null,
    shared_by: opts.shared_by || null,
    shared_at: now,
    status: 'active',
  };
  patient.shared_movements = [row, ...(patient.shared_movements || [])];
  return row;
}

export function upsertClientNote(
  patient: { client_notes?: PatientClientNote[] },
  opts: {
    body: string;
    appointment_id?: string | null;
    booking_id?: string | null;
    author_name?: string | null;
    now?: string;
    id?: string;
  }
): PatientClientNote {
  const body = String(opts.body || '').trim();
  if (!body) throw new Error('Write a note for the client first');
  const now = opts.now || new Date().toISOString();
  const list = [...(patient.client_notes || [])];
  const id =
    opts.id ||
    `cnote_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const i = list.findIndex((n) => n.id === id);
  const row: PatientClientNote = {
    id,
    body,
    appointment_id: opts.appointment_id ?? list[i]?.appointment_id ?? null,
    booking_id: opts.booking_id ?? list[i]?.booking_id ?? null,
    author_name: opts.author_name ?? list[i]?.author_name ?? null,
    created_at: list[i]?.created_at || now,
  };
  if (i >= 0) list[i] = row;
  else list.unshift(row);
  patient.client_notes = list;
  return row;
}

export function activeSharedMovements(
  list?: PatientMovementShare[] | null
): PatientMovementShare[] {
  return (list || []).filter(
    (m) => String(m.status || 'active').toLowerCase() === 'active'
  );
}
