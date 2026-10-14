/**
 * Rasterise branded share cards to public/share and App Router image files.
 * Run: npx tsx scripts/seo/render-share-cards.ts
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import sharp from 'sharp';
import { BRAND_CYAN, allShareCards, type ShareCardSpec } from '@/lib/seo/share-cards';

const ROOT = process.cwd();
const WIDTH = 1200;
const HEIGHT = 630;

const FILE_COPIES: Record<string, string[]> = {
  'share/home.png': ['app/opengraph-image.png', 'app/twitter-image.png'],
  'share/pricing.png': [
    'app/pricing/opengraph-image.png',
    'app/pricing/twitter-image.png',
  ],
  'share/demo.png': ['app/demo/opengraph-image.png', 'app/demo/twitter-image.png'],
  'share/industries.png': [
    'app/industries/opengraph-image.png',
    'app/industries/twitter-image.png',
  ],
};

function xml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function cardSvg(card: ShareCardSpec, logoWidth: number, logoHeight: number): string {
  const headlineSize = card.headline.some((line) => line.length > 20) ? 48 : 64;
  const headlineStart = 268;
  const headlineGap = headlineSize + 14;
  const headlines = card.headline
    .map(
      (line, index) =>
        `<text x="72" y="${headlineStart + index * headlineGap}" fill="#0f172a" font-family="Inter, DejaVu Sans, sans-serif" font-size="${headlineSize}" font-weight="700">${xml(line)}</text>`
    )
    .join('');
  const subStart = headlineStart + card.headline.length * headlineGap + 24;
  const subs = card.sub
    .map(
      (line, index) =>
        `<text x="72" y="${subStart + index * 38}" fill="#334155" font-family="Inter, DejaVu Sans, sans-serif" font-size="28" font-weight="500">${xml(line)}</text>`
    )
    .join('');
  const panel = card.pricePanel
    ? `<g>
        <text x="1096" y="250" fill="#0f172a" font-family="Inter, DejaVu Sans, sans-serif" font-size="54" font-weight="700" text-anchor="middle">${xml(card.pricePanel.amount)}</text>
        ${card.pricePanel.caption
          .map(
            (line, index) =>
              `<text x="1096" y="${300 + index * 32}" fill="#0f172a" font-family="Inter, DejaVu Sans, sans-serif" font-size="20" font-weight="600" text-anchor="middle">${xml(line)}</text>`
          )
          .join('')}
      </g>`
    : `<text x="1096" y="330" fill="#0f172a" font-family="Inter, DejaVu Sans, sans-serif" font-size="28" font-weight="700" text-anchor="middle">SA</text>`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${WIDTH}" height="${HEIGHT}" fill="#ffffff"/>
  <rect width="${WIDTH}" height="16" fill="${BRAND_CYAN}"/>
  <rect x="996" y="16" width="204" height="${HEIGHT - 16}" fill="${BRAND_CYAN}"/>
  <text x="72" y="188" fill="${BRAND_CYAN}" font-family="Inter, DejaVu Sans, sans-serif" font-size="22" font-weight="700">${xml(card.eyebrow)}</text>
  ${headlines}
  ${subs}
  <text x="72" y="582" fill="#64748b" font-family="Inter, DejaVu Sans, sans-serif" font-size="22">${xml(card.foot)}</text>
  ${panel}
  <image href="__LOGO__" x="72" y="52" width="${logoWidth}" height="${logoHeight}"/>
</svg>`;
}

async function renderCard(card: ShareCardSpec, logo: Buffer): Promise<Buffer> {
  const logoPng = await sharp(logo).resize({ height: 64 }).png().toBuffer();
  const meta = await sharp(logoPng).metadata();
  const logoWidth = meta.width || 148;
  const logoHeight = meta.height || 64;
  const logoHref = `data:image/png;base64,${logoPng.toString('base64')}`;
  const svg = cardSvg(card, logoWidth, logoHeight).replace('__LOGO__', logoHref);
  return sharp(Buffer.from(svg)).png().toBuffer();
}

async function main() {
  const logo = await sharp(join(ROOT, 'public/sa-logo.png')).png().toBuffer();
  const cards = allShareCards();
  for (const card of cards) {
    const png = await renderCard(card, logo);
    const info = await sharp(png).metadata();
    if (info.width !== WIDTH || info.height !== HEIGHT) {
      throw new Error(`${card.id} rendered ${info.width}x${info.height}`);
    }
    const target = join(ROOT, 'public', card.file);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, png);
    const copies = FILE_COPIES[card.file] || [];
    for (const copy of copies) {
      const dest = join(ROOT, copy);
      mkdirSync(dirname(dest), { recursive: true });
      writeFileSync(dest, png);
      writeFileSync(dest.replace(/\.png$/, '.alt.txt'), `${card.alt}\n`);
    }
    process.stdout.write(`wrote ${card.file}\n`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
