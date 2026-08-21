/**
 * Run: npx --yes tsx lib/advisors/pwa-icon.test.ts
 */
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {
  keepPrimaryLogoMark,
  knockOutLogoBoard,
  renderAdvisorPwaOgPng,
  stripSvgCaptions,
  transparentPwaIconPng,
} from './pwa-icon';
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

  const glyphSq = await sharp({
    create: {
      width: 10,
      height: 12,
      channels: 4,
      background: { r: 20, g: 20, b: 20, alpha: 255 },
    },
  })
    .png()
    .toBuffer();
  const glyphBoard = await sharp({
    create: {
      width: 200,
      height: 160,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([
      {
        input: await sharp({
          create: {
            width: 90,
            height: 90,
            channels: 4,
            background: { r: 232, g: 232, b: 48, alpha: 255 },
          },
        })
          .png()
          .toBuffer(),
        left: 55,
        top: 8,
      },
      ...Array.from({ length: 8 }, (_, i) => ({
        input: glyphSq,
        left: 20 + i * 22,
        top: 140,
      })),
    ])
    .raw()
    .toBuffer({ resolveWithObject: true });
  const cropped = keepPrimaryLogoMark(
    glyphBoard.data,
    glyphBoard.info.width,
    glyphBoard.info.height,
    glyphBoard.info.channels
  );
  assert.ok(cropped.height < 120, 'caption boxes under the mark must be cropped');
  assert.ok(cropped.width < 140, 'only the primary mark remains');

  const svgWithCaption = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10" fill="#e8e830"/><text y="9">000000000000</text></svg>`
  );
  const stripped = stripSvgCaptions(svgWithCaption).toString('utf8');
  assert.ok(!stripped.includes('000000000000'));
  assert.ok(!/<text/i.test(stripped));
  assert.ok(/<rect/i.test(stripped));

  const ogRaw = await sharp(og).ensureAlpha().raw().toBuffer({
    resolveWithObject: true,
  });
  const { data, info } = ogRaw;
  const sample = (x: number, y: number) => {
    const i = (y * info.width + x) * info.channels;
    return { r: data[i], g: data[i + 1], b: data[i + 2] };
  };
  const fillPx = sample(8, 8);
  let captionish = 0;
  for (let y = 560; y < 630; y += 2) {
    for (let x = 40; x < 1160; x += 4) {
      const p = sample(x, y);
      const d = Math.hypot(p.r - fillPx.r, p.g - fillPx.g, p.b - fillPx.b);
      if (d > 48) captionish++;
    }
  }
  assert.ok(
    captionish < 30,
    `share card must not have caption/glyph boxes under the logo (got ${captionish})`
  );

  console.log('pwa-icon tests ok');
}

void main();
