/**
 * One-off: create Balance (PhysioAdvisor) and Mindfullness (PsychiatryAdvisor)
 * with craig@bigfivefoods.com as active owner.
 */
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import {
  seedDemoPhysiograph,
  writePhysiographToMetadata,
} from '../lib/clinic/physiograph';
import {
  seedDemoPsychiatrygraph,
  writePsychiatrygraphToMetadata,
} from '../lib/clinic/psychiatrygraph';

dotenv.config({ path: '.env.local' });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const sb = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const OWNER = {
  email: 'craig@bigfivefoods.com',
  name: 'Craig Ross Muller',
  userId: 'did:privy:cmmkfe47g012f0djolmvhx6x3',
};
const now = new Date().toISOString();

const CORE_MODULES = {
  home: true,
  'my-business': true,
  guide: true,
  network: true,
  suppliers: true,
  customers: true,
  operations: true,
  distribution: false,
  inventory: true,
  people: true,
  accounting: true,
  intelligence: true,
  'sales-portal': true,
  fitgraph: false,
  physiograph: false,
  dentalgraph: false,
  medicalgraph: false,
  psychiatrygraph: false,
  hiregraph: false,
  retailgraph: false,
  fieldgraph: false,
  quarrygraph: false,
  schools: false,
  health: false,
  platform: false,
};

type CompanySpec = {
  tradingName: string;
  legalName: string;
  industry: string;
  industries: string[];
  shortDescription: string;
  packId?: string;
  industryModules?: string[];
  osIndustry: string;
  osIndustries: string[];
  moduleId: 'physiograph' | 'psychiatrygraph';
  contactPhone: string;
  publicBio: string;
};

const SPECS: CompanySpec[] = [
  {
    tradingName: 'Balance',
    legalName: 'Balance (Pty) Ltd',
    industry: 'Physiotherapy & allied health',
    industries: ['Physiotherapy', 'Allied health', 'Rehab'],
    shortDescription:
      'Balance — PhysioAdvisor® clinic for testing: practitioners, patients, diary, scripts and member portal.',
    packId: 'allied_health_clinic',
    industryModules: ['physio_os', 'physio_suppliers', 'physio_ops'],
    osIndustry: 'physio-allied-health',
    osIndustries: ['physio-allied-health'],
    moduleId: 'physiograph',
    contactPhone: '+27 11 000 2222',
    publicBio:
      'Balance physio & rehab — assessments, recovery and return-to-play.',
  },
  {
    tradingName: 'Mindfullness',
    legalName: 'Mindfullness (Pty) Ltd',
    industry: 'Mental health',
    industries: ['Psychiatry', 'Psychology', 'Mental health'],
    shortDescription:
      'Mindfullness — PsychiatryAdvisor® practice for testing: clinicians, patients, diary, scripts and member portal.',
    osIndustry: 'mental-health',
    osIndustries: ['mental-health'],
    moduleId: 'psychiatrygraph',
    contactPhone: '+27 11 000 3333',
    publicBio:
      'Mindfullness psychiatry & psychology — assessment, therapy and medication review.',
  },
];

function baseMetadata(spec: CompanySpec): Record<string, unknown> {
  const enabled = { ...CORE_MODULES, [spec.moduleId]: true };
  return {
    enabled_modules: enabled,
    modules_configured_at: now,
    os_architecture: 'core_sector_pack_module',
    os_entity_type: 'private_company',
    os_sector: 'tertiary',
    os_industry: spec.osIndustry,
    os_industries: spec.osIndustries,
    industry_packs: spec.packId ? [spec.packId] : [],
    industry_modules: spec.industryModules || [],
    setup_path: 'self_serve',
    setup_status: 'active',
    packaging_configured_at: now,
    owner_emails: [OWNER.email],
  };
}

async function findCompany(name: string) {
  const { data } = await sb
    .from('profiles')
    .select('id, trading_name, legal_name, email, metadata, subscription_status')
    .ilike('trading_name', name)
    .order('id', { ascending: true })
    .limit(3);
  return data?.[0] || null;
}

async function insertCompany(spec: CompanySpec) {
  const base: Record<string, unknown> = {
    trading_name: spec.tradingName,
    legal_name: spec.legalName,
    industry: spec.industry,
    industries: spec.industries,
    business_type: 'business',
    org_type: 'private_company',
    country: 'South Africa',
    email: OWNER.email,
    contact_name: OWNER.name,
    short_description: spec.shortDescription,
    supplier_status: 'active',
    is_discoverable: true,
    status: 'active',
    verification_status: 'verified',
    subscription_status: 'lifetime',
    created_at: now,
    updated_at: now,
    claimed_at: now,
    user_id: OWNER.userId,
    metadata: baseMetadata(spec),
  };
  const optional = [
    'short_description',
    'industries',
    'org_type',
    'is_discoverable',
    'verification_status',
    'claimed_at',
    'status',
    'industry',
    'user_id',
  ];
  let attempt = { ...base };
  let lastErr: { message?: string } | null = null;
  for (let i = 0; i < optional.length + 4; i++) {
    const { data, error } = await sb
      .from('profiles')
      .insert(attempt)
      .select('id, trading_name, legal_name, email, metadata, subscription_status')
      .single();
    if (!error && data) return data;
    lastErr = error;
    const msg = error?.message || '';
    const col =
      msg.match(/Could not find the '([^']+)' column/i)?.[1] ||
      msg.match(/column ["']?(\w+)["']?/i)?.[1];
    if (col && col in attempt) {
      delete attempt[col];
      continue;
    }
    if (/column|schema|PGRST204/i.test(msg) && optional.length) {
      const drop = optional.shift();
      if (drop && drop in attempt) {
        delete attempt[drop];
        continue;
      }
    }
    break;
  }
  throw new Error(lastErr?.message || `Failed to create ${spec.tradingName}`);
}

function seedStore(spec: CompanySpec, companyId: number) {
  if (spec.moduleId === 'physiograph') {
    const store = seedDemoPhysiograph(now, companyId);
    store.settings = {
      ...store.settings,
      enabled: true,
      brand_name: spec.tradingName,
      contact_email: OWNER.email,
      contact_phone: spec.contactPhone,
      public_bio: spec.publicBio,
    };
    return writePhysiographToMetadata(baseMetadata(spec), store);
  }
  const store = seedDemoPsychiatrygraph(now, companyId);
  store.settings = {
    ...store.settings,
    enabled: true,
    brand_name: spec.tradingName,
    contact_email: OWNER.email,
    contact_phone: spec.contactPhone,
    public_bio: spec.publicBio,
  };
  return writePsychiatrygraphToMetadata(baseMetadata(spec), store);
}

async function saveMetadata(
  companyId: number,
  spec: CompanySpec,
  meta: Record<string, unknown>
) {
  const { error } = await sb
    .from('profiles')
    .update({
      trading_name: spec.tradingName,
      legal_name: spec.legalName,
      metadata: meta,
      supplier_status: 'active',
      subscription_status: 'lifetime',
      email: OWNER.email,
      contact_name: OWNER.name,
      updated_at: now,
    })
    .eq('id', companyId);
  if (error) throw error;
}

async function upsertOwner(companyId: number) {
  const { data: existingRows } = await sb
    .from('business_users')
    .select('id, status, user_id, email, invited_email, role')
    .eq('profile_id', companyId);
  const email = OWNER.email.toLowerCase();
  const existing = (existingRows || []).find((r) => {
    const e1 = String(r.email || '').toLowerCase();
    const e2 = String(r.invited_email || '').toLowerCase();
    return e1 === email || e2 === email || r.user_id === OWNER.userId;
  });

  const payload: Record<string, unknown> = {
    name: OWNER.name,
    email,
    invited_email: email,
    role: 'owner',
    status: 'active',
    user_id: OWNER.userId,
    invited_at: now,
    joined_at: now,
    updated_at: now,
    invited_by: 'system:create-balance-mindfullness',
  };

  if (existing?.id) {
    const { data, error } = await sb
      .from('business_users')
      .update(payload)
      .eq('id', existing.id)
      .select('id, status, role, user_id')
      .single();
    if (error) {
      const retry = await sb
        .from('business_users')
        .update({
          role: 'owner',
          status: 'active',
          email,
          user_id: OWNER.userId,
          updated_at: now,
        })
        .eq('id', existing.id)
        .select('id, status, role, user_id')
        .single();
      if (retry.error) throw retry.error;
      return retry.data;
    }
    return data;
  }

  const insert = { profile_id: companyId, ...payload, created_at: now };
  const { data, error } = await sb
    .from('business_users')
    .insert(insert)
    .select('id, status, role, user_id')
    .single();
  if (error) {
    const retry = await sb
      .from('business_users')
      .insert({
        profile_id: companyId,
        role: 'owner',
        status: 'active',
        email,
        invited_email: email,
        user_id: OWNER.userId,
        created_at: now,
      })
      .select('id, status, role, user_id')
      .single();
    if (retry.error) throw retry.error;
    return retry.data;
  }
  return data;
}

async function main() {
  const out = [];
  for (const spec of SPECS) {
    let company = await findCompany(spec.tradingName);
    let created = false;
    if (!company) {
      company = await insertCompany(spec);
      created = true;
    }
    const companyId = Number(company.id);
    const meta = seedStore(spec, companyId);
    await saveMetadata(companyId, spec, meta);
    const owner = await upsertOwner(companyId);
    out.push({
      created,
      companyId,
      trading_name: spec.tradingName,
      module: spec.moduleId,
      subscription_status: 'lifetime',
      owner: {
        email: OWNER.email,
        memberId: owner.id,
        status: owner.status,
        role: owner.role,
        userId: owner.user_id,
      },
      dashboard:
        spec.moduleId === 'physiograph'
          ? '/dashboard/physiograph'
          : '/dashboard/psychiatrygraph',
    });
  }
  console.log(JSON.stringify(out, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
