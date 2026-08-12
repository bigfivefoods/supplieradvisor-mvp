/**
 * Onboard all existing schools + DBE onto SchoolAdvisor® module.
 *
 * - Ensure DBE (default company 144) has active nsnp_agency_profiles row
 * - Apply public_sector + schools packaging to DBE + every school company
 * - Activate school_agency_links under DBE
 * - Stamp school_profiles primary_agency + active
 *
 * Usage:
 *   node scripts/onboard-schooladvisor-all.mjs
 *   DBE_COMPANY_ID=144 node scripts/onboard-schooladvisor-all.mjs
 */
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { createRequire } from 'module';

dotenv.config({ path: '.env.local' });
dotenv.config();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const sb = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const DBE_COMPANY_ID = Number(process.env.DBE_COMPANY_ID || 144);
const now = new Date().toISOString();

async function fetchAll(table, select, apply) {
  const page = 1000;
  let from = 0;
  const all = [];
  for (;;) {
    let q = sb.from(table).select(select).range(from, from + page - 1);
    if (apply) q = apply(q);
    const { data, error } = await q;
    if (error) throw error;
    if (!data?.length) break;
    all.push(...data);
    if (data.length < page) break;
    from += page;
  }
  return all;
}

/** Minimal packaging blob without full Next packaging graph (script-safe) */
function schoolAdvisorMeta(prev = {}, role = 'school') {
  const meta = { ...(prev || {}) };
  const enabled = {
    ...(typeof meta.enabled_modules === 'object' ? meta.enabled_modules : {}),
    schools: true,
    home: true,
    guide: true,
    network: true,
    'my-business': true,
  };
  meta.enabled_modules = enabled;
  meta.schooladvisor = {
    ...(typeof meta.schooladvisor === 'object' ? meta.schooladvisor : {}),
    brand: 'SchoolAdvisor®',
    role,
    sector: 'public_sector',
    pack: 'public_procurement',
    onboarded_at: now,
  };
  // packaging selection used by module nav
  const packaging =
    meta.packaging && typeof meta.packaging === 'object'
      ? { ...meta.packaging }
      : {};
  packaging.sectorId = 'public_sector';
  packaging.entityTypeId =
    role === 'department'
      ? packaging.entityTypeId === 'national'
        ? 'national'
        : 'provincial'
      : role === 'sp'
        ? packaging.entityTypeId || 'private_company'
        : 'school';
  packaging.packIds = [
    ...new Set([...(packaging.packIds || []), 'public_procurement']),
  ];
  packaging.moduleIds = [...new Set([...(packaging.moduleIds || []), 'schools'])];
  packaging.industryId =
    role === 'department'
      ? 'public_provincial'
      : role === 'sp'
        ? packaging.industryId || 'public_local'
        : 'public_local';
  packaging.businessTypeId =
    role === 'department'
      ? 'provincial_education'
      : role === 'sp'
        ? 'nsnp_sp'
        : 'public_school';
  meta.packaging = packaging;
  if (role === 'department') {
    meta.dbe_agency = true;
    meta.programme = 'nsnp';
  }
  if (role === 'school') {
    meta.entity_kind = meta.entity_kind || 'school';
    meta.dbe_agency_profile_id = DBE_COMPANY_ID;
    meta.dbe_approved = true;
  }
  return meta;
}

async function ensureDbe() {
  console.log('Ensuring DBE company', DBE_COMPANY_ID);

  const { data: prof, error: pErr } = await sb
    .from('profiles')
    .select('id, trading_name, legal_name, business_type, org_type, metadata, province')
    .eq('id', DBE_COMPANY_ID)
    .maybeSingle();
  if (pErr) throw pErr;
  if (!prof) {
    throw new Error(
      `DBE company ${DBE_COMPANY_ID} not found in profiles — set DBE_COMPANY_ID`
    );
  }

  const name =
    String(prof.trading_name || prof.legal_name || 'Department of Basic Education').slice(
      0,
      200
    );
  const meta = schoolAdvisorMeta(
    prof.metadata && typeof prof.metadata === 'object' ? prof.metadata : {},
    'department'
  );

  const { error: uErr } = await sb
    .from('profiles')
    .update({
      trading_name: prof.trading_name || name,
      legal_name: prof.legal_name || name,
      business_type: 'government_education',
      org_type: 'government_education',
      industry: 'Government education / NSNP',
      industries: ['Government education', 'NSNP', 'Public sector'],
      metadata: meta,
      status: 'active',
      updated_at: now,
    })
    .eq('id', DBE_COMPANY_ID);
  if (uErr) throw uErr;

  const { error: aErr } = await sb.from('nsnp_agency_profiles').upsert(
    {
      profile_id: DBE_COMPANY_ID,
      agency_name: name,
      agency_type: 'dbe',
      province: prof.province || null,
      status: 'active',
      meal_tariff_zar: 4.5,
      meal_tariff_lunch_zar: 4.5,
      claims_locked: false,
      updated_at: now,
    },
    { onConflict: 'profile_id' }
  );
  if (aErr) {
    // some schemas use id as PK only — try insert if no row
    const { data: existing } = await sb
      .from('nsnp_agency_profiles')
      .select('id')
      .eq('profile_id', DBE_COMPANY_ID)
      .maybeSingle();
    if (!existing) {
      const { error: iErr } = await sb.from('nsnp_agency_profiles').insert({
        profile_id: DBE_COMPANY_ID,
        agency_name: name,
        agency_type: 'dbe',
        status: 'active',
        meal_tariff_zar: 4.5,
        meal_tariff_lunch_zar: 4.5,
        claims_locked: false,
        created_at: now,
        updated_at: now,
      });
      if (iErr) throw iErr;
    } else if (aErr) {
      console.warn('agency upsert warning', aErr.message);
    }
  }

  console.log('DBE on SchoolAdvisor®:', name);
  return prof;
}

async function onboardSchools() {
  const schools = await fetchAll(
    'school_profiles',
    'id, school_name, profile_id, province, district, local_municipality, natemis, emis_number, status, primary_agency_profile_id, member_type'
  );
  console.log('School profiles found:', schools.length);

  // Stamp schools as active under DBE
  let schoolsUpdated = 0;
  for (let i = 0; i < schools.length; i += 200) {
    const chunk = schools.slice(i, i + 200);
    const { error } = await sb
      .from('school_profiles')
      .update({
        primary_agency_profile_id: DBE_COMPANY_ID,
        status: 'active',
        member_type: 'school',
        updated_at: now,
      })
      .in(
        'id',
        chunk.map((s) => s.id)
      );
    if (error) console.error('school_profiles batch', error.message);
    else schoolsUpdated += chunk.length;
  }
  console.log('school_profiles updated:', schoolsUpdated);

  // Package every linked company profile
  const profileIds = [
    ...new Set(
      schools.map((s) => Number(s.profile_id)).filter((id) => Number.isFinite(id))
    ),
  ];
  console.log('School company profiles:', profileIds.length);

  let packaged = 0;
  let packageErrors = 0;
  for (let i = 0; i < profileIds.length; i += 40) {
    const batch = profileIds.slice(i, i + 40);
    const { data: profs, error } = await sb
      .from('profiles')
      .select('id, metadata, business_type, org_type, trading_name')
      .in('id', batch);
    if (error) {
      console.error('profiles load', error.message);
      packageErrors += batch.length;
      continue;
    }
    await Promise.all(
      (profs || []).map(async (prof) => {
        const meta = schoolAdvisorMeta(
          prof.metadata && typeof prof.metadata === 'object'
            ? prof.metadata
            : {},
          'school'
        );
        const { error: uErr } = await sb
          .from('profiles')
          .update({
            business_type: 'school',
            org_type: 'school',
            industry: 'Public schools',
            industries: ['Public schools', 'NSNP'],
            metadata: meta,
            status: 'active',
            updated_at: now,
          })
          .eq('id', prof.id);
        if (uErr) {
          packageErrors += 1;
          console.error('profile package', prof.id, uErr.message);
        } else {
          packaged += 1;
        }
      })
    );
    if (i % 400 === 0 || i + 40 >= profileIds.length) {
      console.log(
        `Packaged ${Math.min(i + 40, profileIds.length)}/${profileIds.length} · ok ${packaged}`
      );
    }
  }

  // Ensure active agency links for every school
  let linksEnsured = 0;
  for (let i = 0; i < schools.length; i += 100) {
    const chunk = schools.slice(i, i + 100);
    const rows = chunk.map((s) => ({
      school_profile_id: Number(s.id),
      school_company_id:
        s.profile_id != null ? Number(s.profile_id) : DBE_COMPANY_ID,
      agency_profile_id: DBE_COMPANY_ID,
      status: 'active',
      accepted_at: now,
      notes: 'SchoolAdvisor® onboard — DBE registry',
      updated_at: now,
    }));
    const { error } = await sb
      .from('school_agency_links')
      .upsert(rows, { onConflict: 'school_profile_id,agency_profile_id' });
    if (error) {
      // fallback: update existing one-by-one insert
      for (const row of rows) {
        const { data: ex } = await sb
          .from('school_agency_links')
          .select('id')
          .eq('school_profile_id', row.school_profile_id)
          .eq('agency_profile_id', row.agency_profile_id)
          .maybeSingle();
        if (ex?.id) {
          await sb
            .from('school_agency_links')
            .update({
              status: 'active',
              accepted_at: now,
              school_company_id: row.school_company_id,
              notes: row.notes,
              updated_at: now,
            })
            .eq('id', ex.id);
          linksEnsured += 1;
        } else {
          const { error: iErr } = await sb
            .from('school_agency_links')
            .insert({ ...row, created_at: now });
          if (!iErr) linksEnsured += 1;
          else console.error('link insert', row.school_profile_id, iErr.message);
        }
      }
    } else {
      linksEnsured += rows.length;
    }
  }
  console.log('agency links ensured:', linksEnsured);

  return {
    schools: schools.length,
    schoolCompanies: profileIds.length,
    packaged,
    packageErrors,
    schoolsUpdated,
    linksEnsured,
  };
}

async function main() {
  console.log('=== SchoolAdvisor® full onboard ===');
  await ensureDbe();
  const schoolResult = await onboardSchools();

  // Verify
  const { count: agencyOk } = await sb
    .from('nsnp_agency_profiles')
    .select('id', { count: 'exact', head: true })
    .eq('profile_id', DBE_COMPANY_ID)
    .eq('status', 'active');
  const { count: activeLinks } = await sb
    .from('school_agency_links')
    .select('id', { count: 'exact', head: true })
    .eq('agency_profile_id', DBE_COMPANY_ID)
    .eq('status', 'active');
  const { count: schoolCount } = await sb
    .from('school_profiles')
    .select('id', { count: 'exact', head: true });

  console.log(
    JSON.stringify(
      {
        ok: true,
        dbeCompanyId: DBE_COMPANY_ID,
        dbeAgencyActive: agencyOk || 0,
        schoolProfiles: schoolCount,
        activeLinksToDbe: activeLinks,
        ...schoolResult,
      },
      null,
      2
    )
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
