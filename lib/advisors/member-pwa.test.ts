/**
 * Run: npx --yes tsx lib/advisors/member-pwa.test.ts
 */
import assert from 'node:assert/strict';
import {
  ADVISOR_PWA_PORTAL_INDEX_KEYS,
  advisorPwaMemberOpenPath,
  advisorPwaStartPath,
  advisorPwaWebManifest,
  buildAdvisorPwaBrand,
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
  advisorPwaMemberOpenPath('fitgraph', 'mem_1'),
  '/member/fitgraph/mem_1'
);
assert.equal(advisorPwaMemberOpenPath('hiregraph', 'hc_1'), '/hire/hc_1');
assert.equal(memberTokenStorageKey('hiregraph'), 'sa_hiregraph_customer_token');
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
assert.equal(brand.iconUrl, 'https://cdn.example/vuka.png');
assert.equal(brand.joinKind, 'gym');
assert.equal(brand.joinPath, '/pwa/fitgraph/fg_110_abc?join=1');
assert.equal(advisorPwaJoinPath('physiograph', 'pg_1'), '/pwa/physiograph/pg_1?join=1');
assert.equal(advisorModuleFromJoinKind('physio'), 'physiograph');
assert.equal(advisorModuleFromJoinKind('gym'), 'fitgraph');
assert.equal(brand.joinGymPath, '/join/fitgraph/fg_110_abc?kind=group');
assert.equal(brand.joinPrivatePath, '/join/fitgraph/fg_110_abc?kind=private');
assert.equal(brand.enabled, true);
assert.equal(brand.shortName, 'VUKA Fitness');

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
  '/api/public/advisor-pwa/og?module=fitgraph&token=fg_110_abc&v=2'
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

console.log('member-pwa tests ok');
