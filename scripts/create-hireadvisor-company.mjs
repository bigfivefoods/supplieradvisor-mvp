/**
 * Create HireAdvisor company with hiregraph module + dual-commission pack,
 * invite craig@bigfivefoods.com and andrew@holtzmac.co.za as owners.
 *
 * Usage:
 *   node scripts/create-hireadvisor-company.mjs
 */
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import { Resend } from 'resend';

dotenv.config({ path: '.env.local' });
dotenv.config();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const resendKey = process.env.RESEND_API_KEY;
const appUrl = (
  process.env.NEXT_PUBLIC_APP_URL ||
  process.env.APP_URL ||
  'https://www.supplieradvisor.com'
).replace(/\/$/, '');

if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const sb = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const OWNERS = [
  { email: 'craig@bigfivefoods.com', name: 'Craig' },
  { email: 'andrew@holtzmac.co.za', name: 'Andrew' },
];

const COMPANY_NAME = 'HireAdvisor';
const PACK_ID = 'staffing_hire';
const now = new Date().toISOString();
const INVITE_DAYS = 14;

function hireAdvisorMetadata(prev = {}) {
  const meta = { ...(prev && typeof prev === 'object' ? prev : {}) };

  // Explicit module enablement — hiregraph on; other verticals off by default
  const enabled = {
    home: true,
    'my-business': true,
    guide: true,
    network: true,
    suppliers: true,
    customers: true,
    operations: true,
    distribution: true,
    inventory: true,
    hiregraph: true,
    people: true,
    accounting: true,
    // industry verticals opt-in
    fitgraph: false,
    physiograph: false,
    dentalgraph: false,
    medicalgraph: false,
    psychiatrygraph: false,
    fieldgraph: false,
    quarrygraph: false,
    schools: false,
    health: false,
    platform: false,
  };
  meta.enabled_modules = {
    ...(typeof meta.enabled_modules === 'object' && !Array.isArray(meta.enabled_modules)
      ? meta.enabled_modules
      : {}),
    ...enabled,
  };
  meta.modules_configured_at = now;

  // Packaging: tertiary services + hire/rental pack
  meta.os_architecture = 'core_sector_pack_module';
  meta.os_entity_type = 'private_company';
  meta.os_sector = 'tertiary';
  meta.os_industry = 'hire-rental';
  meta.os_industries = ['hire-rental'];
  meta.industry_packs = [PACK_ID];
  meta.industry_modules = ['hire_os', 'hire_network', 'hire_ops'];
  meta.setup_path = 'self_serve';
  meta.setup_status = 'active';
  meta.packaging_configured_at = now;
  meta.packaging_price_zar = {
    core: 299,
    packs: 199,
    total: 498,
  };

  meta.hireadvisor = {
    brand: 'HireAdvisor®',
    commercial_model: 'dual_commission',
    supplier_commission_pct: 2.5,
    customer_commission_pct: 2.5,
    onboarded_at: now,
  };

  meta.owner_emails = OWNERS.map((o) => o.email);
  return meta;
}

function teamInviteHtml({ inviteeName, companyName, inviteLink, role }) {
  const name = inviteeName || '';
  return `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:620px;margin:32px auto;background:#fff;border-radius:20px;overflow:hidden;border:1px solid #e2e8f0;">
    <div style="background:linear-gradient(135deg,#00b4d8 0%,#0077b6 100%);padding:36px 40px;color:#fff;text-align:center;">
      <div style="font-size:13px;letter-spacing:0.12em;text-transform:uppercase;opacity:0.9;margin-bottom:8px;">SupplierAdvisor® · HireAdvisor®</div>
      <h1 style="margin:0;font-size:26px;font-weight:800;">You're invited as Owner</h1>
    </div>
    <div style="padding:36px 40px;">
      <p style="color:#334155;font-size:16px;line-height:1.7;">Hello${name ? ` ${name}` : ''},</p>
      <p style="color:#334155;font-size:16px;line-height:1.7;">
        You have been invited as <strong>${role}</strong> of <strong>${companyName}</strong> on SupplierAdvisor —
        the HireAdvisor® hire/rental marketplace (suppliers list gear, people rent B2C, dual 2.5% + 2.5% commission).
      </p>
      <div style="text-align:center;margin:28px 0;">
        <a href="${inviteLink}" style="background:#00b4d8;color:#fff;padding:16px 40px;border-radius:9999px;text-decoration:none;font-weight:700;font-size:16px;display:inline-block;">
          Accept invitation &amp; join →
        </a>
      </div>
      <p style="font-size:13px;color:#64748b;word-break:break-all;">Or open: <a href="${inviteLink}" style="color:#0077b6;">${inviteLink}</a></p>
      <p style="font-size:12px;color:#94a3b8;">Link expires in ${INVITE_DAYS} days. Sign in with this same email address.</p>
    </div>
  </div>
</body></html>`;
}

function teamInviteText({ inviteeName, companyName, inviteLink, role }) {
  return [
    `Hello${inviteeName ? ` ${inviteeName}` : ''},`,
    '',
    `You have been invited as ${role} of ${companyName} on SupplierAdvisor (HireAdvisor® marketplace).`,
    '',
    'Open this join link to accept:',
    inviteLink,
    '',
    `Sign in with this same email. Link expires in ${INVITE_DAYS} days.`,
    '',
    '— SupplierAdvisor®',
  ].join('\n');
}

async function findExistingCompany() {
  // Prefer exact trading name
  const { data: byName } = await sb
    .from('profiles')
    .select('id, trading_name, legal_name, email, metadata, subscription_status')
    .ilike('trading_name', 'HireAdvisor')
    .order('id', { ascending: true })
    .limit(5);

  if (byName?.length) return byName[0];

  // Metadata brand
  try {
    const { data } = await sb
      .from('profiles')
      .select('id, trading_name, legal_name, email, metadata, subscription_status')
      .contains('metadata', { hireadvisor: { brand: 'HireAdvisor®' } })
      .limit(1)
      .maybeSingle();
    if (data) return data;
  } catch {
    /* soft */
  }
  return null;
}

async function createCompany() {
  const meta = hireAdvisorMetadata(null);
  const base = {
    trading_name: COMPANY_NAME,
    legal_name: 'HireAdvisor (Pty) Ltd',
    industry: 'Hire & rental marketplace',
    industries: ['Hire & rental', 'Kids party hire', 'Plant hire', 'Services'],
    business_type: 'business',
    org_type: 'private_company',
    country: 'South Africa',
    email: OWNERS[0].email,
    contact_name: 'Craig',
    short_description:
      'HireAdvisor® — suppliers list gear for hire; people rent B2C. Dual 2.5% + 2.5% commission on rental GMV. Kids party (jumping castles), plant, vehicles, tools and more.',
    supplier_status: 'active',
    is_discoverable: true,
    status: 'active',
    verification_status: 'verified',
    subscription_status: 'active',
    created_at: now,
    updated_at: now,
    claimed_at: now,
    metadata: meta,
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
  ];
  let attempt = { ...base };
  let lastErr = null;

  for (let i = 0; i < optional.length + 3; i++) {
    const { data, error } = await sb
      .from('profiles')
      .insert(attempt)
      .select('id, trading_name, legal_name, email, metadata, subscription_status')
      .single();
    if (!error && data) return { company: data, created: true };
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
  throw new Error(lastErr?.message || 'Failed to create HireAdvisor company');
}

async function updateCompanyMeta(company) {
  const prev =
    company.metadata && typeof company.metadata === 'object'
      ? company.metadata
      : {};
  const meta = hireAdvisorMetadata(prev);
  const { error } = await sb
    .from('profiles')
    .update({
      trading_name: COMPANY_NAME,
      legal_name: company.legal_name || 'HireAdvisor (Pty) Ltd',
      metadata: meta,
      supplier_status: 'active',
      updated_at: now,
    })
    .eq('id', company.id);
  if (error) console.warn('Meta update soft-fail:', error.message);
  return meta;
}

async function resolveUserIdByEmail(email) {
  // business_users with active user
  const { data: bu } = await sb
    .from('business_users')
    .select('user_id, email, invited_email')
    .or(`email.eq.${email},invited_email.eq.${email}`)
    .not('user_id', 'is', null)
    .limit(5);
  for (const row of bu || []) {
    if (row.user_id) return String(row.user_id);
  }
  // profiles.user_id match by email
  const { data: prof } = await sb
    .from('profiles')
    .select('user_id, email')
    .ilike('email', email)
    .not('user_id', 'is', null)
    .limit(3);
  for (const row of prof || []) {
    if (row.user_id) return String(row.user_id);
  }
  return null;
}

async function upsertOwnerInvite(companyId, owner) {
  const email = owner.email.toLowerCase();
  const token = randomUUID();
  const expiresAt = new Date(
    Date.now() + INVITE_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();
  const userId = await resolveUserIdByEmail(email);

  const { data: existingRows } = await sb
    .from('business_users')
    .select('id, status, user_id, email, invited_email, role')
    .eq('profile_id', companyId);

  const existing = (existingRows || []).find((r) => {
    const e1 = String(r.email || '').toLowerCase();
    const e2 = String(r.invited_email || '').toLowerCase();
    return e1 === email || e2 === email;
  });

  const payload = {
    name: owner.name,
    email,
    invited_email: email,
    role: 'owner',
    status: userId ? 'active' : 'invited',
    invite_token: token,
    invited_at: now,
    expires_at: expiresAt,
    updated_at: now,
    invited_by: 'system:create-hireadvisor-company',
  };
  if (userId) {
    payload.user_id = userId;
    payload.joined_at = now;
  }

  let memberId = existing?.id ? Number(existing.id) : null;

  if (existing?.id) {
    const { data, error } = await sb
      .from('business_users')
      .update(payload)
      .eq('id', existing.id)
      .select('id, status, role')
      .single();
    if (error) {
      // strip optional cols
      const minimal = {
        role: 'owner',
        status: userId ? 'active' : 'invited',
        email,
        invited_email: email,
        invite_token: token,
        updated_at: now,
      };
      if (userId) minimal.user_id = userId;
      const retry = await sb
        .from('business_users')
        .update(minimal)
        .eq('id', existing.id)
        .select('id, status, role')
        .single();
      if (retry.error) throw retry.error;
      memberId = Number(retry.data.id);
    } else {
      memberId = Number(data.id);
    }
  } else {
    const insert = {
      profile_id: companyId,
      ...payload,
      created_at: now,
    };
    const { data, error } = await sb
      .from('business_users')
      .insert(insert)
      .select('id, status, role')
      .single();
    if (error) {
      const minimal = {
        profile_id: companyId,
        role: 'owner',
        status: userId ? 'active' : 'invited',
        email,
        invited_email: email,
        invite_token: token,
        created_at: now,
      };
      if (userId) minimal.user_id = userId;
      const retry = await sb
        .from('business_users')
        .insert(minimal)
        .select('id, status, role')
        .single();
      if (retry.error) throw retry.error;
      memberId = Number(retry.data.id);
    } else {
      memberId = Number(data.id);
    }
  }

  return {
    memberId,
    email,
    name: owner.name,
    userId,
    token,
    inviteLink: `${appUrl}/onboarding/team?invite=${encodeURIComponent(token)}`,
    status: userId ? 'active' : 'invited',
  };
}

async function sendOwnerEmail(invite) {
  if (!resendKey) {
    return { ok: false, error: 'RESEND_API_KEY not set' };
  }
  const resend = new Resend(resendKey);
  const from =
    process.env.RESEND_FROM_EMAIL ||
    process.env.RESEND_FROM ||
    process.env.EMAIL_FROM ||
    'SupplierAdvisor <hello@supplieradvisor.com>';
  const { data, error } = await resend.emails.send({
    from,
    to: invite.email,
    subject: `Join ${COMPANY_NAME} on SupplierAdvisor as Owner — your join link inside`,
    html: teamInviteHtml({
      inviteeName: invite.name,
      companyName: COMPANY_NAME,
      inviteLink: invite.inviteLink,
      role: 'Owner',
    }),
    text: teamInviteText({
      inviteeName: invite.name,
      companyName: COMPANY_NAME,
      inviteLink: invite.inviteLink,
      role: 'Owner',
    }),
    tags: [
      { name: 'type', value: 'team_invite' },
      { name: 'company', value: 'hireadvisor' },
    ],
  });
  if (error) return { ok: false, error: error.message || String(error) };
  return { ok: true, id: data?.id || null };
}

async function main() {
  console.log('=== Create HireAdvisor company ===');
  console.log('App URL:', appUrl);

  let company = await findExistingCompany();
  let created = false;
  if (company) {
    console.log('Found existing company id=', company.id, company.trading_name);
    await updateCompanyMeta(company);
  } else {
    const result = await createCompany();
    company = result.company;
    created = result.created;
    console.log('Created company id=', company.id);
  }

  // Refresh meta always
  await updateCompanyMeta(company);

  const results = [];
  for (const owner of OWNERS) {
    console.log('\nOwner:', owner.email);
    const invite = await upsertOwnerInvite(company.id, owner);
    console.log(
      '  membership id=',
      invite.memberId,
      'status=',
      invite.status,
      'userId=',
      invite.userId || '(pending accept)'
    );
    console.log('  invite link:', invite.inviteLink);
    const mail = await sendOwnerEmail(invite);
    if (mail.ok) {
      console.log('  email sent id=', mail.id);
    } else {
      console.warn('  email FAILED:', mail.error);
      console.warn('  Share invite link manually.');
    }
    results.push({ ...invite, emailResult: mail });
  }

  console.log('\n=== Done ===');
  console.log(
    JSON.stringify(
      {
        companyId: company.id,
        trading_name: COMPANY_NAME,
        created,
        module: 'hiregraph',
        pack: PACK_ID,
        commercial: '2.5% supplier + 2.5% customer',
        owners: results.map((r) => ({
          email: r.email,
          memberId: r.memberId,
          status: r.status,
          inviteLink: r.inviteLink,
          emailSent: r.emailResult.ok,
          emailId: r.emailResult.id || null,
          emailError: r.emailResult.error || null,
        })),
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
