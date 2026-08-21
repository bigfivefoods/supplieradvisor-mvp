/**
 * Run: npx --yes tsx lib/advisors/pwa-icon.test.ts
 */
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { knockOutLogoBoard, renderAdvisorPwaOgPng, transparentPwaIconPng } from './pwa-icon';
import { buildAdvisorPwaBrand } from './member-pwa';

async function main() {
  const whiteBoard = await sharp({
    create: {
      width: 200,
      height: 200,
      channels: 3,
      background: { r: 255, g: 255, b: 255 },
    },
  })
    .composite([
      {
        input: await sharp({
          create: {
            width: 80,
            height: 80,
            channels: 3,
            background: { r: 232, g: 232, b: 48 },
          },
        })
          .png()
          .toBuffer(),
        left: 60,
        top: 60,
      },
    ])
    .png()
    .toBuffer();

  const raw = await sharp(whiteBoard).ensureAlpha().raw().toBuffer({
    resolveWithObject: true,
  });
  const keyed = knockOutLogoBoard(
    raw.data,
    raw.info.width,
    raw.info.height,
    raw.info.channels
  );
  const cornerA = keyed[3];
  const mid = (100 * 200 + 100) * 4 + 3;
  assert.equal(cornerA, 0, 'white board corner must be transparent');
  assert.ok(keyed[mid] > 200, 'logo pixels stay opaque');

  const icon = await transparentPwaIconPng(whiteBoard, 192);
  const meta = await sharp(icon).metadata();
  assert.equal(meta.format, 'png');
  assert.equal(meta.width, 192);
  assert.equal(meta.height, 192);
  assert.equal(meta.hasAlpha, true);

  const outRaw = await sharp(icon).ensureAlpha().raw().toBuffer({
    resolveWithObject: true,
  });
  assert.equal(outRaw.data[3], 0, 'icon corner must stay transparent (no white board)');
  assert.equal(outRaw.data[outRaw.data.length - 1], 0, 'icon bottom-right must be transparent');

  let opaque = 0;
  for (let i = 3; i < outRaw.data.length; i += 4) {
    if (outRaw.data[i] > 16) opaque++;
  }
  assert.ok(opaque > 200, 'VUKA-style mark is still present after knockout');

  const ogBrand = buildAdvisorPwaBrand({
    module: 'fitgraph',
    publicToken: 'fg_110_abc',
    companyId: 110,
    settings: {
      brand_name: 'VUKA Fitness',
      company_logo_url: '/sa-icon-512.png',
      pwa_background_color: '#a3aaae',
    },
  });
  const og = await renderAdvisorPwaOgPng(ogBrand);
  const ogMeta = await sharp(og).metadata();
  assert.equal(ogMeta.format, 'png');
  assert.equal(ogMeta.width, 1200);
  assert.equal(ogMeta.height, 630);

  console.log('pwa-icon tests ok');
}

void main();
