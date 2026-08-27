/**
 * Run: npx --yes tsx lib/advisors/member-pwa.test.ts
 */
import assert from 'node:assert/strict';
import {
  ADVISOR_PWA_MODULES,
  ADVISOR_PWA_PORTAL_INDEX_KEYS,
  advisorPwaMemberOpenPath,
  advisorPwaOpenPath,
  isAdvisorStaffPortalPath,
  advisorPwaStartPath,
  advisorPwaBrandStamp,
  advisorPwaWebManifest,
  buildAdvisorPwaBrand,
  advisorPwaSwitchPath,
  memberTokenStorageKey,
  normalizeHexColor,
  advisorPwaIconPath,
  advisorPwaOgPath,
  advisorModuleFromJoinKind,
  advisorPwaJoinPath,
  advisorPwaShareCopy,
  advisorPwaWhatsAppBody,
  htmlColorValue,
  pwaSettingsPatch,
  pwaShortName,
  readPwaSettings,
} from './member-pwa';
import { supabaseRenderIconUrl } from './pwa-icon';
import { preferPngLogoUrl } from '@/lib/business/company-logo';
import {
  isPlaceholderPhone,
  normalizeWhatsAppNumber,
  whatsAppUrl,
} from '@/lib/services/advisor-whatsapp';

assert.equal(normalizeHexColor('#E8E830', '#000000'), '#e8e830');
assert.equal(normalizeHexColor('0077b6', '#000'), '#0077b6');
assert.equal(normalizeHexColor('nope', '#0c4a6e'), '#0c4a6e');
assert.equal(htmlColorValue('#E8E830', '#0c4a6e'), '#e8e830');
assert.equal(htmlColorValue('not-a-color', '#E8E830'), '#e8e830');
assert.equal(htmlColorValue('', '#0f172a'), '#0f172a');
assert.equal(normalizeWhatsAppNumber('000000000000'), null);
assert.equal(isPlaceholderPhone('000 000 0000'), true);
assert.equal(isPlaceholderPhone('000000000000'), true);
assert.equal(isPlaceholderPhone('0'), false);
assert.equal(isPlaceholderPhone('0821234567'), false);
assert.equal(isPlaceholderPhone(''), false);
assert.match(
  whatsAppUrl('000000000000', 'https://example.com/pwa'),
  /^https:\/\/wa\.me\/\?text=/
);
assert.equal(pwaShortName('VUKA Fitness'), 'VUKA Fitness');
assert.equal(pwaShortName('VUKA Fitness Studio West'), 'VUKA Fitness');
assert.equal(advisorPwaStartPath('fitgraph', 'fg_110_abc'), '/pwa/fitgraph/fg_110_abc');
assert.equal(
  advisorPwaSwitchPath('fitgraph', 'fg_110_abc'),
  '/pwa/fitgraph/fg_110_abc?switch=1'
);
assert.equal(
  advisorPwaMemberOpenPath('fitgraph', 'mem_1'),
  '/member/fitgraph/mem_1'
);
assert.equal(
  advisorPwaOpenPath('fitgraph', 'coach_110_abc'),
  '/coach/fitgraph/coach_110_abc'
);
assert.equal(
  advisorPwaOpenPath('fitgraph', 'member_110_abc'),
  '/member/fitgraph/member_110_abc'
);
assert.equal(
  advisorPwaOpenPath('physiograph', 'clin_9_phys_abc'),
  '/clinician/physiograph/clin_9_phys_abc'
);
assert.equal(
  advisorPwaOpenPath('dentalgraph', 'clin_9_dent_abc'),
  '/clinician/dentalgraph/clin_9_dent_abc'
);
assert.equal(
  advisorPwaOpenPath('vetgraph', 'clin_9_vet_abc'),
  '/clinician/vetgraph/clin_9_vet_abc'
);
assert.ok(ADVISOR_PWA_MODULES.includes('vetgraph'));
assert.equal(advisorModuleFromJoinKind('vet'), 'vetgraph');
assert.equal(
  advisorPwaOpenPath('physiograph', 'ppat_9_abc'),
  '/member/physiograph/ppat_9_abc'
);
assert.equal(isAdvisorStaffPortalPath('/coach/fitgraph/coach_1'), true);
assert.equal(
  isAdvisorStaffPortalPath('/clinician/physiograph/clin_1'),
  true
);
assert.equal(isAdvisorStaffPortalPath('/member/fitgraph/member_1'), false);
assert.equal(isAdvisorStaffPortalPath('/hire/hc_1'), false);
assert.equal(advisorPwaMemberOpenPath('hiregraph', 'hc_1'), '/hire/hc_1');
assert.equal(
  advisorPwaMemberOpenPath('retailgraph', 'rtl_cus_1_abc'),
  '/member/retailgraph/rtl_cus_1_abc'
);
assert.ok(!advisorPwaMemberOpenPath('retailgraph', 'rtl_cus_1_abc').includes('/embed/'));
assert.equal(memberTokenStorageKey('hiregraph'), 'sa_hiregraph_customer_token');
assert.ok(
  ADVISOR_PWA_PORTAL_INDEX_KEYS.retailgraph.includes('retailgraph_customer_tokens')
);
assert.equal(memberTokenStorageKey('fitgraph'), 'sa_fitgraph_member_token');
assert.ok(
  ADVISOR_PWA_PORTAL_INDEX_KEYS.fitgraph.includes('fitgraph_client_tokens')
);

const brand = buildAdvisorPwaBrand({
  module: 'fitgraph',
  publicToken: 'fg_110_abc',
  companyId: 110,
  settings: {
    brand_name: 'VUKA Fitness',
    embed_primary_color: '#E8E830',
    public_bio: 'Hyrox and strength.',
    company_logo_url: 'https://cdn.example/vuka.png',
  },
});
assert.equal(brand.brandName, 'VUKA Fitness');
assert.equal(brand.themeColor, '#e8e830');
assert.equal(brand.backgroundColor, '#e8e830');
assert.equal(brand.iconUrl, 'https://cdn.example/vuka.png');
const splashBrand = buildAdvisorPwaBrand({
  module: 'fitgraph',
  publicToken: 'fg_110_abc',
  companyId: 110,
  settings: {
    brand_name: 'VUKA Fitness',
    embed_primary_color: '#E8E830',
    pwa_background_color: '#a3aaae',
  },
});
assert.equal(splashBrand.backgroundColor, '#a3aaae');
assert.notEqual(
  advisorPwaBrandStamp(brand),
  advisorPwaBrandStamp(splashBrand)
);
const hireBrand = buildAdvisorPwaBrand({
  module: 'hiregraph',
  publicToken: 'hire_pub_1_abc',
  companyId: 1,
  settings: {
    brand_name: 'VUKA Fitness',
    company_logo_url: 'https://cdn.example/vuka.png',
    pwa_name: 'VUKA Fitness',
  },
});
assert.equal(hireBrand.brandName, 'HireAdvisor®');
assert.equal(hireBrand.shortName, 'HireAdvisor');
assert.equal(hireBrand.iconUrl, '/sa-icon-512.png');
assert.doesNotMatch(hireBrand.brandName, /VUKA/);
assert.ok(!hireBrand.iconUrl.includes('vuka'));
assert.equal(brand.joinKind, 'gym');
assert.equal(brand.joinPath, '/pwa/fitgraph/fg_110_abc?join=1');
assert.equal(advisorPwaJoinPath('physiograph', 'pg_1'), '/pwa/physiograph/pg_1?join=1');
assert.equal(advisorModuleFromJoinKind('physio'), 'physiograph');
assert.equal(advisorModuleFromJoinKind('gym'), 'fitgraph');
assert.equal(brand.joinGymPath, '/join/fitgraph/fg_110_abc?kind=group');
assert.equal(brand.joinPrivatePath, '/join/fitgraph/fg_110_abc?kind=private');
assert.equal(brand.enabled, true);
assert.equal(brand.shortName, 'VUKA Fitness');

const named = buildAdvisorPwaBrand({
  module: 'fitgraph',
  publicToken: 'fg_110_abc',
  companyId: 110,
  settings: {
    brand_name: 'VUKA Fitness',
    pwa_name: 'VUKA',
    pwa_short_name: 'VUKA',
  },
});
assert.equal(named.brandName, 'VUKA');
assert.equal(named.shortName, 'VUKA');
assert.equal(advisorPwaWebManifest(named).name, 'VUKA');
assert.equal(advisorPwaWebManifest(named).short_name, 'VUKA');

const manifest = advisorPwaWebManifest(brand);
assert.equal(manifest.id, '/pwa/fitgraph/fg_110_abc');
assert.equal(manifest.start_url, '/pwa/fitgraph/fg_110_abc?source=pwa');
assert.equal(manifest.scope, '/');
assert.equal(manifest.handle_links, 'not-preferred');
assert.equal(manifest.name, 'VUKA Fitness');
assert.notEqual(manifest.id, '/me');
assert.notEqual(manifest.id, '/');
const icons = (manifest.icons || []) as Array<{ src: string; purpose?: string }>;
assert.equal(icons.length >= 2, true);
assert.ok(
  icons.every((i) => i.src.includes('/api/public/advisor-pwa/icon')),
  'install icons must be the company PNG endpoint, not SA'
);
assert.ok(!icons.some((i) => i.src.includes('sa-icon')));
assert.equal(
  advisorPwaIconPath('fitgraph', 'fg_110_abc', 512),
  '/api/public/advisor-pwa/icon?module=fitgraph&token=fg_110_abc&size=512'
);
assert.equal(
  advisorPwaOgPath('fitgraph', 'fg_110_abc'),
  '/api/public/advisor-pwa/og?module=fitgraph&token=fg_110_abc&v=6'
);
const share = advisorPwaShareCopy(brand, 'https://www.supplieradvisor.com/pwa/fitgraph/fg_110_abc');
assert.equal(share.title, 'VUKA Fitness');
assert.equal(share.text, 'VUKA Fitness');
assert.ok(!/SupplierAdvisor/i.test(share.text));
assert.ok(!/GymAdvisor/i.test(share.text));
const wa = advisorPwaWhatsAppBody(
  brand,
  'https://www.supplieradvisor.com/pwa/fitgraph/fg_110_abc'
);
assert.equal(wa, 'https://www.supplieradvisor.com/pwa/fitgraph/fg_110_abc');
assert.ok(!/GymAdvisor/i.test(wa));
assert.ok(!/Add /i.test(wa));
assert.ok(!/000000000000/.test(wa));

assert.equal(
  supabaseRenderIconUrl(
    'https://onkklullmgrdqoertngp.supabase.co/storage/v1/object/public/company-documents/110/profile/logo.avif',
    512
  ),
  'https://onkklullmgrdqoertngp.supabase.co/storage/v1/render/image/public/company-documents/110/profile/logo.avif?width=512'
);
assert.match(
  String(
    preferPngLogoUrl(
      'https://onkklullmgrdqoertngp.supabase.co/storage/v1/object/public/company-documents/110/profile/logo.avif'
    )
  ),
  /render\/image\/public\/.+logo\.avif\?width=1024$/
);

const other = buildAdvisorPwaBrand({
  module: 'physiograph',
  publicToken: 'pg_9_xyz',
  companyId: 9,
  settings: { brand_name: 'Cape Physio', pwa_enabled: false },
});
assert.equal(other.joinPath, '/pwa/physiograph/pg_9_xyz?join=1');
assert.equal(other.joinGymPath, '');
assert.ok(!other.joinPath.includes('/embed/'));
for (const mod of ADVISOR_PWA_MODULES) {
  const b = buildAdvisorPwaBrand({
    module: mod,
    publicToken: 'tok_parity',
    companyId: 1,
    settings: { brand_name: 'Parity Co' },
  });
  assert.equal(b.joinPath, `/pwa/${mod}/tok_parity?join=1`);
  assert.ok(!b.joinPath.includes('/embed/'));
  assert.match(advisorPwaOgPath(mod, 'tok_parity'), /\/og\?/);
  const open = advisorPwaMemberOpenPath(mod, 'mem_1');
  assert.ok(open);
  assert.ok(!open.includes('/embed/'));
  if (mod === 'hiregraph') {
    assert.equal(open, '/hire/mem_1');
  } else {
    assert.equal(open, `/member/${mod}/mem_1`);
  }
}
assert.equal(other.enabled, false);
assert.notEqual(advisorPwaWebManifest(other).id, manifest.id);

const draft = readPwaSettings({ pwa_name: 'VUKA', pwa_enabled: false });
assert.equal(draft.pwa_name, 'VUKA');
assert.equal(draft.pwa_enabled, false);

const patch = pwaSettingsPatch({
  pwa_enabled: true,
  pwa_name: '  VUKA Fitness Studio  ',
  pwa_short_name: '',
  pwa_theme_color: 'E8E830',
});
assert.equal(patch.pwa_name, 'VUKA Fitness Studio');
assert.equal(patch.pwa_short_name, 'VUKA Fitness');
assert.equal(patch.pwa_theme_color, '#e8e830');
assert.equal(patch.pwa_background_color, '#e8e830');
const splashPatch = pwaSettingsPatch(
  { pwa_name: 'VUKA', pwa_background_color: '#112233' },
  { theme: '#e8e830', splash: '#0c4a6e' }
);
assert.equal(splashPatch.pwa_background_color, '#112233');
assert.equal(
  pwaSettingsPatch(
    { pwa_name: 'VUKA' },
    { theme: '#e8e830', splash: '#a3aaae' }
  ).pwa_background_color,
  '#a3aaae'
);

console.log('member-pwa tests ok');
