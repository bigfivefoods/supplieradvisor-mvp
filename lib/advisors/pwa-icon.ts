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

async function loadLogoBytes(iconUrl: string): Promise<Buffer | null> {
  const raw = String(iconUrl || '').trim();
  if (!raw) return null;
  const cacheKey = `pwa-logo:${raw}`;
  const hit = ttlGet<Buffer>(cacheKey);
  if (hit) return hit;
  let bytes: Buffer | null = null;
  const rendered = supabaseRenderIconUrl(raw, 1024);
  if (rendered) bytes = await fetchBytes(rendered);
  if (!bytes && raw.startsWith('/') && !raw.startsWith('//')) {
    const rel = raw.replace(/^\/+/, '').replace(/\.\./g, '');
    const file = path.join(process.cwd(), 'public', rel);
    try {
      bytes = await readFile(file);
    } catch {
      bytes = null;
    }
  }
  if (!bytes && !rendered) bytes = await fetchBytes(raw);
  if (bytes) ttlSet(cacheKey, bytes, LOGO_TTL_MS);
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

/** WhatsApp / iMessage card: company mark only — no captions. */
export async function renderAdvisorPwaOgPng(
  brand: AdvisorPwaBrand
): Promise<Buffer> {
  const sharp = (await import('sharp')).default;
  const W = 1200;
  const H = 630;
  const cacheKey = `pwa-og-logo:${brand.module}:${brand.publicToken}:${brand.iconUrl}:${brand.backgroundColor}:${brand.themeColor}`;
  const hit = ttlGet<Buffer>(cacheKey);
  if (hit) return hit;

  const fill = brand.backgroundColor || brand.themeColor || '#0c4a6e';
  const mark = await renderAdvisorPwaIconPng(brand, 512);
  const logoSize = 380;
  const logo = Buffer.from(
    await sharp(mark)
      .resize(logoSize, logoSize, {
        fit: 'contain',
        background: TRANSPARENT,
      })
      .png()
      .toBuffer()
  );
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
          top: Math.round((H - logoSize) / 2),
          left: Math.round((W - logoSize) / 2),
        },
      ])
      .png({ compressionLevel: 6 })
      .toBuffer()
  );
  ttlSet(cacheKey, png, ICON_TTL_MS);
  return png;
}
