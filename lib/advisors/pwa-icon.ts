/**
 * Square PNG home-screen icons from a company logo (AVIF/SVG/JPEG → PNG).
 * Output is always transparent — never a white/theme-colour board around the mark.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { AdvisorPwaBrand } from '@/lib/advisors/member-pwa';
import { preferPngLogoUrl } from '@/lib/business/company-logo';
import { ttlGet, ttlSet } from '@/lib/system/memory-ttl';

const MAX_BYTES = 2_500_000;
const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 };
const LOGO_TTL_MS = 10 * 60_000;
const ICON_TTL_MS = 10 * 60_000;

function hexRgb(hex: string): { r: number; g: number; b: number; alpha: number } {
  const h = String(hex || '').replace('#', '').trim();
  if (h.length !== 6) return { r: 12, g: 74, b: 110, alpha: 1 };
  const n = Number.parseInt(h, 16);
  if (!Number.isFinite(n)) return { r: 12, g: 74, b: 110, alpha: 1 };
  return {
    r: (n >> 16) & 255,
    g: (n >> 8) & 255,
    b: n & 255,
    alpha: 1,
  };
}

function isPrivateHost(host: string): boolean {
  const h = host.toLowerCase();
  if (h === 'localhost' || h.endsWith('.localhost')) return true;
  if (h === '127.0.0.1' || h === '0.0.0.0' || h === '::1') return true;
  if (/^10\./.test(h) || /^192\.168\./.test(h) || /^172\.(1[6-9]|2\d|3[0-1])\./.test(h)) {
    return true;
  }
  return false;
}

/** Supabase transcodes AVIF → raster. Width only — square contain pads with white. */
export function supabaseRenderIconUrl(iconUrl: string, size: number): string | null {
  const dim = Math.min(1024, Math.max(256, Math.round(size)));
  const png = preferPngLogoUrl(iconUrl);
  if (!png || png === iconUrl) {
    let u: URL;
    try {
      u = new URL(String(iconUrl || '').trim());
    } catch {
      return null;
    }
    if (u.protocol !== 'https:') return null;
    if (!u.hostname.endsWith('.supabase.co')) return null;
    const m = u.pathname.match(/^\/storage\/v1\/object\/public\/(.+)$/);
    if (!m) return null;
    return `${u.origin}/storage/v1/render/image/public/${m[1]}?width=${dim}`;
  }
  try {
    const u = new URL(png);
    u.searchParams.set('width', String(dim));
    u.searchParams.delete('height');
    u.searchParams.delete('resize');
    return u.toString();
  } catch {
    return png;
  }
}

async function fetchBytes(url: string): Promise<Buffer | null> {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  if (u.protocol !== 'https:') return null;
  if (isPrivateHost(u.hostname)) return null;
  const res = await fetch(u.toString(), {
    cache: 'force-cache',
    redirect: 'follow',
    headers: { Accept: 'image/png,image/webp,image/*;q=0.8' },
  });
  if (!res.ok) return null;
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 32 || buf.length > MAX_BYTES) return null;
  return buf;
}

function looksLikeSvg(source: Buffer): boolean {
  const head = source.subarray(0, Math.min(source.length, 512)).toString('utf8');
  return /<svg[\s>]/i.test(head) || (head.includes('<?xml') && /<svg[\s>]/i.test(source.toString('utf8').slice(0, 2000)));
}

function isSvgLogoUrl(url: string): boolean {
  try {
    const u = new URL(url, 'https://example.invalid');
    return /\.svg$/i.test(u.pathname);
  } catch {
    return /\.svg(\?|#|$)/i.test(url);
  }
}

/** Drop SVG captions so missing fonts cannot rasterize as □ / 0000 under the mark. */
export function stripSvgCaptions(source: Buffer): Buffer {
  if (!looksLikeSvg(source)) return source;
  const xml = source.toString('utf8');
  if (!/<svg[\s>]/i.test(xml)) return source;
  const cleaned = xml
    .replace(/<(text|textPath|tspan|flowRoot|flowPara|flowSpan)\b[\s\S]*?<\/\1>/gi, '')
    .replace(/<(text|textPath|tspan|flowRoot|flowPara|flowSpan)\b[^>]*\/>/gi, '');
  return Buffer.from(cleaned);
}

async function loadLogoBytes(iconUrl: string): Promise<Buffer | null> {
  const raw = String(iconUrl || '').trim();
  if (!raw) return null;
  const cacheKey = `pwa-logo-v2:${raw}`;
  const hit = ttlGet<Buffer>(cacheKey);
  if (hit) return hit;
  let bytes: Buffer | null = null;
  // Rasterizing SVG via Supabase bakes missing-font tofu. Fetch the SVG and
  // strip captions before sharp draws it.
  if (isSvgLogoUrl(raw) && raw.startsWith('https://')) {
    bytes = await fetchBytes(raw);
  }
  const rendered = !bytes && !isSvgLogoUrl(raw) ? supabaseRenderIconUrl(raw, 1024) : null;
  if (!bytes && rendered) bytes = await fetchBytes(rendered);
  if (!bytes && raw.startsWith('/') && !raw.startsWith('//')) {
    const rel = raw.replace(/^\/+/, '').replace(/\.\./g, '');
    const file = path.join(process.cwd(), 'public', rel);
    try {
      bytes = await readFile(file);
    } catch {
      bytes = null;
    }
  }
  if (!bytes && raw.startsWith('https://')) bytes = await fetchBytes(raw);
  if (bytes) {
    bytes = Buffer.from(stripSvgCaptions(bytes));
    ttlSet(cacheKey, bytes, LOGO_TTL_MS);
  }
  return bytes;
}

type Corner = { r: number; g: number; b: number; a: number };

function sampleCorners(
  data: Uint8Array,
  width: number,
  height: number,
  channels: number
): Corner[] {
  const n = Math.max(2, Math.min(8, Math.floor(Math.min(width, height) / 8)));
  const origins: Array<[number, number]> = [
    [0, 0],
    [width - n, 0],
    [0, height - n],
    [width - n, height - n],
  ];
  return origins.map(([ox, oy]) => {
    let r = 0;
    let g = 0;
    let b = 0;
    let a = 0;
    let c = 0;
    for (let y = oy; y < oy + n; y++) {
      for (let x = ox; x < ox + n; x++) {
        const i = (y * width + x) * channels;
        r += data[i];
        g += data[i + 1];
        b += data[i + 2];
        a += channels > 3 ? data[i + 3] : 255;
        c++;
      }
    }
    return { r: r / c, g: g / c, b: b / c, a: a / c };
  });
}

function rgbDist(a: Corner, b: Corner): number {
  return Math.hypot(a.r - b.r, a.g - b.g, a.b - b.b);
}

type LogoBlob = {
  seed: number;
  area: number;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

function erodeOpaqueMask(
  data: Uint8Array,
  width: number,
  height: number,
  channels: number,
  opaque: number
): Uint8Array {
  const mask = new Uint8Array(width * height);
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      if (data[i * channels + 3] < opaque) continue;
      if (
        data[((y - 1) * width + x) * channels + 3] < opaque ||
        data[((y + 1) * width + x) * channels + 3] < opaque ||
        data[(i - 1) * channels + 3] < opaque ||
        data[(i + 1) * channels + 3] < opaque
      ) {
        continue;
      }
      mask[i] = 1;
    }
  }
  return mask;
}

function collectOpaqueBlobs(
  mask: Uint8Array,
  width: number,
  height: number
): LogoBlob[] {
  const seen = new Uint8Array(width * height);
  const stack = new Int32Array(width * height);
  const dirs = [1, 0, -1, 0, 1];
  const blobs: LogoBlob[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (seen[i] || !mask[i]) continue;
      let area = 0;
      let top = 0;
      let minX = x;
      let minY = y;
      let maxX = x;
      let maxY = y;
      stack[top++] = i;
      seen[i] = 1;
      const seed = i;
      while (top > 0) {
        const p = stack[--top];
        area++;
        const px = p % width;
        const py = (p / width) | 0;
        if (px < minX) minX = px;
        if (py < minY) minY = py;
        if (px > maxX) maxX = px;
        if (py > maxY) maxY = py;
        for (let d = 0; d < 4; d++) {
          const nx = px + dirs[d];
          const ny = py + dirs[d + 1];
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          const ni = ny * width + nx;
          if (seen[ni] || !mask[ni]) continue;
          seen[ni] = 1;
          stack[top++] = ni;
        }
      }
      if (area >= 8) {
        blobs.push({ seed, area, minX, minY, maxX, maxY });
      }
    }
  }
  return blobs;
}

function blobScore(b: LogoBlob): number {
  const w = b.maxX - b.minX + 1;
  const h = b.maxY - b.minY + 1;
  const aspect = h / Math.max(1, w);
  // Captions / tofu are a short wide strip. Prefer the taller mark.
  const stripPenalty = aspect < 0.28 ? 0.25 : 1;
  return b.area * (8 + h) * stripPenalty;
}

/**
 * Keep the brand mark and drop the tofu / 0000 caption row that missing
 * fonts rasterize underneath it. Wordmark letters on the same row stay.
 */
export function keepPrimaryLogoMark(
  data: Uint8Array,
  width: number,
  height: number,
  channels: number
): { data: Uint8Array; width: number; height: number } {
  if (channels < 4 || width < 4 || height < 4) {
    return { data, width, height };
  }
  const opaque = 24;
  let mask = erodeOpaqueMask(data, width, height, channels, opaque);
  let blobs = collectOpaqueBlobs(mask, width, height);
  if (!blobs.length) {
    mask = new Uint8Array(width * height);
    for (let i = 0; i < width * height; i++) {
      if (data[i * channels + 3] >= opaque) mask[i] = 1;
    }
    blobs = collectOpaqueBlobs(mask, width, height);
  }
  if (!blobs.length) return { data, width, height };

  blobs.sort((a, b) => blobScore(b) - blobScore(a));
  const primary = blobs[0];
  const pH = primary.maxY - primary.minY + 1;
  const yTol = Math.max(6, Math.round(pH * 0.4));
  const keep = blobs.filter((b) => {
    const cy = (b.minY + b.maxY) / 2;
    if (cy < primary.minY - yTol) return false;
    if (cy > primary.maxY + yTol) return false;
    return b.minY <= primary.maxY + yTol && b.maxY >= primary.minY - yTol;
  });

  const keepMask = new Uint8Array(width * height);
  const stack = new Int32Array(width * height);
  const dirs = [1, 0, -1, 0, 1];
  for (const b of keep) {
    let top = 0;
    stack[top++] = b.seed;
    keepMask[b.seed] = 1;
    while (top > 0) {
      const p = stack[--top];
      const px = p % width;
      const py = (p / width) | 0;
      for (let d = 0; d < 4; d++) {
        const nx = px + dirs[d];
        const ny = py + dirs[d + 1];
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const ni = ny * width + nx;
        if (keepMask[ni] || !mask[ni]) continue;
        keepMask[ni] = 1;
        stack[top++] = ni;
      }
    }
  }

  // Dilate 2px so erosion does not nibble the mark, then copy original pixels.
  const dilate = new Uint8Array(keepMask);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!keepMask[y * width + x]) continue;
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          dilate[ny * width + nx] = 1;
        }
      }
    }
  }

  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;
  const kept: number[] = [];
  for (let i = 0; i < dilate.length; i++) {
    if (!dilate[i]) continue;
    if (data[i * channels + 3] < opaque) continue;
    kept.push(i);
    const px = i % width;
    const py = (i / width) | 0;
    if (px < minX) minX = px;
    if (py < minY) minY = py;
    if (px > maxX) maxX = px;
    if (py > maxY) maxY = py;
  }
  if (!kept.length) return { data, width, height };

  const pad = 2;
  const x0 = Math.max(0, minX - pad);
  const y0 = Math.max(0, minY - pad);
  const x1 = Math.min(width - 1, maxX + pad);
  const y1 = Math.min(height - 1, maxY + pad);
  const nw = x1 - x0 + 1;
  const nh = y1 - y0 + 1;
  const out = new Uint8Array(nw * nh * 4);
  for (const p of kept) {
    const px = p % width;
    const py = (p / width) | 0;
    const si = p * channels;
    const di = ((py - y0) * nw + (px - x0)) * 4;
    out[di] = data[si];
    out[di + 1] = data[si + 1];
    out[di + 2] = data[si + 2];
    out[di + 3] = data[si + 3];
  }
  return { data: out, width: nw, height: nh };
}

/**
 * Knock a uniform exported board (white / grey / solid) to alpha 0.
 * Returns a new buffer, or the original when the mark is already transparent
 * or is full-bleed (corners do not agree).
 */
export function knockOutLogoBoard(
  data: Uint8Array,
  width: number,
  height: number,
  channels: number
): Uint8Array {
  if (channels < 4 || width < 8 || height < 8) return data;
  const corners = sampleCorners(data, width, height, channels);
  const avgA = corners.reduce((s, p) => s + p.a, 0) / corners.length;
  if (avgA < 24) return data;

  const key: Corner = {
    r: corners.reduce((s, p) => s + p.r, 0) / corners.length,
    g: corners.reduce((s, p) => s + p.g, 0) / corners.length,
    b: corners.reduce((s, p) => s + p.b, 0) / corners.length,
    a: 255,
  };
  const spread = Math.max(...corners.map((p) => rgbDist(p, key)));
  if (spread > 36) return data;

  const out = Uint8Array.from(data);
  const hard = 28;
  const soft = 52;
  let opaqueKept = 0;
  for (let i = 0; i < out.length; i += channels) {
    const a = out[i + 3];
    if (a === 0) continue;
    const pixel = { r: out[i], g: out[i + 1], b: out[i + 2], a };
    const d = rgbDist(pixel, key);
    if (d <= hard) {
      out[i + 3] = 0;
    } else if (d <= soft) {
      out[i + 3] = Math.round(a * ((d - hard) / (soft - hard)));
      if (out[i + 3] > 16) opaqueKept++;
    } else {
      opaqueKept++;
    }
  }
  const minKeep = Math.max(24, width * height * 0.008);
  if (opaqueKept < minKeep) return data;
  return out;
}

export async function transparentPwaIconPng(
  source: Buffer,
  dim: number
): Promise<Buffer> {
  const sharp = (await import('sharp')).default;
  const pad = Math.round(dim * 0.06);
  const inner = Math.max(32, dim - pad * 2);
  const { data, info } = await sharp(source)
    .rotate()
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const keyed = knockOutLogoBoard(data, info.width, info.height, info.channels);
  let trimmed: Buffer = Buffer.from(
    await sharp(keyed, {
      raw: {
        width: info.width,
        height: info.height,
        channels: 4,
      },
    })
      .png()
      .toBuffer()
  );
  try {
    trimmed = Buffer.from(
      await sharp(trimmed)
        .trim({
          background: TRANSPARENT,
          threshold: 8,
        })
        .png()
        .toBuffer()
    );
  } catch {
    /* keep untrimmed when the mark already fills the frame */
  }
  return Buffer.from(
    await sharp(trimmed)
      .resize(inner, inner, {
        fit: 'contain',
        background: TRANSPARENT,
      })
      .extend({
        top: pad,
        bottom: pad,
        left: pad,
        right: pad,
        background: TRANSPARENT,
      })
      .png({ compressionLevel: 6 })
      .toBuffer()
  );
}

export async function renderAdvisorPwaIconPng(
  brand: AdvisorPwaBrand,
  size: number
): Promise<Buffer> {
  const sharp = (await import('sharp')).default;
  const dim = size === 144 || size === 180 || size === 192 ? size : 512;
  const cacheKey = `pwa-icon:${brand.module}:${brand.publicToken}:${dim}:${brand.iconUrl}`;
  const cached = ttlGet<Buffer>(cacheKey);
  if (cached) return cached;

  const bg = hexRgb(brand.themeColor || brand.backgroundColor);
  const source = await loadLogoBytes(brand.iconUrl);
  let png: Buffer;
  if (!source) {
    const fallback = await loadLogoBytes('/sa-icon-512.png');
    if (!fallback) {
      png = Buffer.from(
        await sharp({
          create: {
            width: dim,
            height: dim,
            channels: 4,
            background: bg,
          },
        })
          .png()
          .toBuffer()
      );
    } else {
      png = await transparentPwaIconPng(fallback, dim);
    }
  } else {
    try {
      png = await transparentPwaIconPng(source, dim);
    } catch {
      png = source;
    }
  }
  ttlSet(cacheKey, png, ICON_TTL_MS);
  return png;
}

/** Tight cropped mark for share cards — no home-screen pad, no captions. */
async function transparentShareMarkPng(source: Buffer): Promise<Buffer> {
  const sharp = (await import('sharp')).default;
  const { data, info } = await sharp(stripSvgCaptions(source))
    .rotate()
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const keyed = knockOutLogoBoard(data, info.width, info.height, info.channels);
  const primary = keepPrimaryLogoMark(
    keyed,
    info.width,
    info.height,
    info.channels
  );
  let trimmed: Buffer = Buffer.from(
    await sharp(primary.data, {
      raw: {
        width: primary.width,
        height: primary.height,
        channels: 4,
      },
    })
      .png()
      .toBuffer()
  );
  try {
    trimmed = Buffer.from(
      await sharp(trimmed)
        .trim({ background: TRANSPARENT, threshold: 16 })
        .png()
        .toBuffer()
    );
  } catch {
    /* already tight */
  }
  return trimmed;
}

/** WhatsApp / iMessage card: company mark only — no captions, no glyph boxes. */
export async function renderAdvisorPwaOgPng(
  brand: AdvisorPwaBrand
): Promise<Buffer> {
  const sharp = (await import('sharp')).default;
  const W = 1200;
  const H = 630;
  const cacheKey = `pwa-og-mark-v5:${brand.module}:${brand.publicToken}:${brand.iconUrl}:${brand.themeColor}`;
  const hit = ttlGet<Buffer>(cacheKey);
  if (hit) return hit;

  const fill = brand.themeColor || brand.backgroundColor || '#0c4a6e';
  const source =
    (await loadLogoBytes(brand.iconUrl)) ||
    (await loadLogoBytes('/sa-icon-512.png'));
  let logo: Buffer;
  if (!source) {
    logo = Buffer.from(
      await sharp({
        create: {
          width: 360,
          height: 360,
          channels: 4,
          background: TRANSPARENT,
        },
      })
        .png()
        .toBuffer()
    );
  } else {
    try {
      const mark = await transparentShareMarkPng(source);
      logo = Buffer.from(
        await sharp(mark)
          .resize(720, 420, {
            fit: 'inside',
            withoutEnlargement: false,
            background: TRANSPARENT,
          })
          .png()
          .toBuffer()
      );
    } catch {
      logo = Buffer.from(
        await sharp(source)
          .resize(720, 420, { fit: 'inside', background: TRANSPARENT })
          .png()
          .toBuffer()
      );
    }
  }
  const meta = await sharp(logo).metadata();
  const lw = meta.width || 720;
  const lh = meta.height || 420;
  const png = Buffer.from(
    await sharp({
      create: {
        width: W,
        height: H,
        channels: 4,
        background: hexRgb(fill),
      },
    })
      .composite([
        {
          input: logo,
          top: Math.max(0, Math.round((H - lh) / 2)),
          left: Math.max(0, Math.round((W - lw) / 2)),
        },
      ])
      .png({ compressionLevel: 6 })
      .toBuffer()
  );
  ttlSet(cacheKey, png, ICON_TTL_MS);
  return png;
}
