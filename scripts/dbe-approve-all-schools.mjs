/**
 * Re-affirm all registry schools as active under DBE company 144,
 * and create company profiles for schools missing profile_id so they
 * appear in the platform company directory for claims / ops.
 *
 * Usage: node scripts/dbe-approve-all-schools.mjs
 */
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: '.env.local' });
dotenv.config();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Missing Supabase env');
  process.exit(1);
}

const sb = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const DBE_COMPANY_ID = Number(process.env.DBE_COMPANY_ID || 144);
const now = new Date().toISOString();

async function fetchAll(select, apply) {
  const page = 1000;
  let from = 0;
  const all = [];
  for (;;) {
    let q = sb.from('school_profiles').select(select).range(from, from + page - 1);
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

async function main() {
  console.log('DBE company', DBE_COMPANY_ID);

  // 1) All school links → active
  let linkFrom = 0;
  let linksUpdated = 0;
  for (;;) {
    const { data: links, error } = await sb
      .from('school_agency_links')
      .select('id, status')
      .eq('agency_profile_id', DBE_COMPANY_ID)
      .order('id', { ascending: true })
      .range(linkFrom, linkFrom + 999);
    if (error) throw error;
    if (!links?.length) break;

    const need = links.filter((l) => l.status !== 'active');
    if (need.length) {
      const { error: uErr } = await sb
        .from('school_agency_links')
        .update({
          status: 'active',
          accepted_at: now,
          notes: 'DBE books — registry approved',
          updated_at: now,
        })
        .in(
          'id',
          need.map((l) => l.id)
        );
      if (uErr) throw uErr;
      linksUpdated += need.length;
    } else {
      // still stamp notes on a sample path — update all in chunk for consistency
      await sb
        .from('school_agency_links')
        .update({
          status: 'active',
          accepted_at: now,
          notes: 'DBE books — registry approved',
          updated_at: now,
        })
        .in(
          'id',
          links.map((l) => l.id)
        );
      linksUpdated += links.length;
    }

    if (links.length < 1000) break;
    linkFrom += 1000;
  }
  console.log('Links set active:', linksUpdated);

  // 2) School profiles: active + primary agency
  const schools = await fetchAll(
    'id, school_name, profile_id, province, district, local_municipality, natemis, emis_number, registry_source, member_type, status, primary_agency_profile_id',
    (q) => q.or('registry_source.eq.xlsx_import,primary_agency_profile_id.eq.' + DBE_COMPANY_ID)
  );
  console.log('Schools to process:', schools.length);

  let profilesCreated = 0;
  let schoolsLinked = 0;
  let schoolsUpdated = 0;

  // Schools missing company profiles (directory / claims)
  const needProfile = schools.filter((s) => s.profile_id == null);
  const haveProfile = schools.filter((s) => s.profile_id != null);
  console.log({ needProfile: needProfile.length, haveProfile: haveProfile.length });

  // Ensure already-linked schools stay active + primary agency
  for (let i = 0; i < haveProfile.length; i += 200) {
    const chunk = haveProfile.slice(i, i + 200);
    const { error: sErr } = await sb
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
    if (sErr) console.error('batch school update', sErr.message);
    else schoolsUpdated += chunk.length;
  }

  // Bulk-ish create: insert profile then link school (batches of 50 parallel)
  for (let i = 0; i < needProfile.length; i += 50) {
    const batch = needProfile.slice(i, i + 50);
    await Promise.all(
      batch.map(async (s) => {
        const name = String(s.school_name || `School ${s.id}`).slice(0, 200);
        const { data: prof, error: pErr } = await sb
          .from('profiles')
          .insert({
            trading_name: name,
            legal_name: name,
            org_type: 'school',
            business_type: 'school',
            industry: 'Public schools',
            industries: ['Public schools'],
            province: s.province || 'KwaZulu-Natal',
            city: s.local_municipality || s.district || null,
            country: 'South Africa',
            continent: 'Africa',
            planet: 'Earth',
            status: 'active',
            trust_score: 0,
            created_at: now,
            metadata: {
              entity_kind: 'school',
              registry_import: true,
              dbe_approved: true,
              dbe_agency_profile_id: DBE_COMPANY_ID,
              natemis: s.natemis || null,
              emis_number: s.emis_number || null,
              enabled_modules: {
                schools: true,
                home: true,
                guide: true,
                network: true,
              },
              directory_visible: true,
            },
            updated_at: now,
          })
          .select('id')
          .single();
        if (pErr) {
          console.error('Profile create failed', s.id, pErr.message);
          return;
        }
        const profileId = Number(prof.id);
        profilesCreated += 1;
        const { error: sErr } = await sb
          .from('school_profiles')
          .update({
            profile_id: profileId,
            primary_agency_profile_id: DBE_COMPANY_ID,
            status: 'active',
            member_type: 'school',
            updated_at: now,
          })
          .eq('id', s.id);
        if (sErr) {
          console.error('School update failed', s.id, sErr.message);
          return;
        }
        schoolsLinked += 1;
        schoolsUpdated += 1;
      })
    );
    if (i % 250 === 0 || i + 50 >= needProfile.length) {
      console.log(
        `Profiles ${Math.min(i + 50, needProfile.length)}/${needProfile.length} · created ${profilesCreated}`
      );
    }
  }

  // Ensure every school has an active agency link
  const allSchools = await fetchAll('id, profile_id', (q) =>
    q.eq('primary_agency_profile_id', DBE_COMPANY_ID)
  );
  let linksEnsured = 0;
  for (let i = 0; i < allSchools.length; i += 100) {
    const chunk = allSchools.slice(i, i + 100);
    const rows = chunk.map((s) => ({
      school_profile_id: Number(s.id),
      school_company_id: s.profile_id != null ? Number(s.profile_id) : DBE_COMPANY_ID,
      agency_profile_id: DBE_COMPANY_ID,
      status: 'active',
      accepted_at: now,
      notes: 'DBE books — registry approved',
      updated_at: now,
    }));
    const { error } = await sb
      .from('school_agency_links')
      .upsert(rows, { onConflict: 'school_profile_id,agency_profile_id' });
    if (error) console.error('link upsert', error.message);
    else linksEnsured += rows.length;
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        profilesCreated,
        schoolsUpdated,
        schoolsLinked,
        linksEnsured,
        dbeCompanyId: DBE_COMPANY_ID,
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
