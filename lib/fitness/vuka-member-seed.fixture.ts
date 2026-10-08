/**
 * Synthetic gym seed for tests. Not a real member list.
 */
import type { FitContractSubmission } from '@/lib/fitness/member-contract';
import {
  HISTORICAL_VUKA_CONTRACTS_IMPORT,
  type VukaCoachSeed,
  type VukaMemberSeed,
  type VukaNameFold,
  type VukaRosterRow,
} from '@/lib/fitness/vuka-member-seed';

export const FIXTURE_ROSTER: VukaRosterRow[] = [
  { name: 'Riley Fixture', amount_zar: 908.5, class_hint: '5AM MWF' },
  { name: 'Sam Sample', amount_zar: 855, class_hint: 'PILATES' },
  { name: 'Quinn North', amount_zar: 775, class_hint: '5AM T TH' },
  { name: 'Blair Fixture', amount_zar: 770.5 },
  { name: 'Morgan Sample', amount_zar: 855, class_hint: 'PILATES' },
  { name: 'Skye Fixture', amount_zar: 471.5, class_hint: 'BC' },
  { name: 'Noah Kids', amount_zar: 530, class_hint: 'KIDS', note: 'Example kids class' },
  { name: 'Tess Early', amount_zar: 236, class_hint: '6:00 AM' },
];

export const FIXTURE_NAME_FOLDS: VukaNameFold[] = [
  {
    aliases: ['morgan samples', 'morgan sample'],
    canonical: 'Morgan Sample',
  },
];

export const FIXTURE_SUBMISSIONS: FitContractSubmission[] = [
  {
    kind: 'group',
    name: 'Riley Fixture',
    email: 'riley.fixture@example.test',
    id_number: '0001015009086',
    phone: '0000000001',
    address: '1 Example Street, Testville',
    date_of_birth: '2000-01-01',
    class_option: '5AM MWF',
    debit_amount_zar: 908.5,
    parq: { pain_injuries: true },
    parq_explanation: 'Example note only',
    source: 'jotform_import',
    source_id: 'fixture-riley',
  },
  {
    kind: 'group',
    name: 'Blair Fixture',
    email: 'blair.fixture@example.test',
    id_number: '0001025009087',
    phone: '0000000002',
    debit_amount_zar: 770.5,
    account_holder: 'Blair Fixture',
    account_type: 'CURRENT/CHEQUE',
    account_number: '0001112223',
    bank_name: 'Discovery',
    parq: { taking_medication: false },
    source: 'jotform_import',
    source_id: 'fixture-blair',
  },
  {
    kind: 'private',
    name: 'Eden Private',
    email: 'eden.private@example.test',
    id_number: '0001035009088',
    phone: '0000000003',
    medical_aid: 'Example Aid',
    medical_aid_plan: 'Example Plan',
    parq: { chronic_disease: false },
    source: 'jotform_import',
    source_id: 'fixture-eden',
  },
  {
    kind: 'group',
    name: 'Morgan Sample',
    email: 'morgan.sample@example.test',
    id_number: '0001045009089',
    phone: '0000000004',
    class_option: 'PILATES',
    debit_amount_zar: 855,
    parq: {},
    source: 'jotform_import',
    source_id: 'fixture-morgan',
  },
];

export const FIXTURE_COACHES: VukaCoachSeed[] = [
  { name: 'Blair Example', email: 'blair.coach@example.test', code: 'BLA' },
  { name: 'Casey Example', email: 'casey.coach@example.test', code: 'CAS' },
  {
    name: 'Jordan Example',
    email: 'jordan.coach@example.test',
    code: 'JOR',
    match_name: 'example',
    avoid_name: 'decoy',
  },
  { name: 'Drew Example', email: 'drew.coach@example.test', code: 'DRE' },
];

export const FIXTURE_VUKA_SEED: VukaMemberSeed = {
  importVersion: HISTORICAL_VUKA_CONTRACTS_IMPORT,
  submissions: FIXTURE_SUBMISSIONS,
  roster: FIXTURE_ROSTER,
  nameFolds: FIXTURE_NAME_FOLDS,
  coaches: FIXTURE_COACHES,
};
