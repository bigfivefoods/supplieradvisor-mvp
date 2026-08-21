/**
 * Square PNG home-screen icons from a company logo (AVIF/SVG/JPEG → PNG).
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { AdvisorPwaBrand } from '@/lib/advisors/member-pwa';

const MAX_BYTES = 2_500_000;

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

/** Supabase can transcode AVIF → PNG when sharp's HEIF decoder cannot. */
export function supabaseRenderIconUrl(iconUrl: string, size: number): string | null {
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
  const dim = size >= 512 ? 512 : size >= 192 ? 192 : 180;
  return `${u.origin}/storage/v1/render/image/public/${m[1]}?width=${dim}&height=${dim}&resize=contain`;
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
    cache: 'no-store',
    redirect: 'follow',
    headers: { Accept: 'image/png,image/jpeg,image/webp,image/*,*/*' },
  });
  if (!res.ok) return null;
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 32 || buf.length > MAX_BYTES) return null;
  return buf;
}

async function loadLogoBytes(iconUrl: string, size: number): Promise<Buffer | null> {
  const raw = String(iconUrl || '').trim();
  if (!raw) return null;
  const rendered = supabaseRenderIconUrl(raw, size);
  if (rendered) {
    const png = await fetchBytes(rendered);
    if (png) return png;
  }
  if (raw.startsWith('/') && !raw.startsWith('//')) {
    const rel = raw.replace(/^\/+/, '').replace(/\.\./g, '');
    const file = path.join(process.cwd(), 'public', rel);
    try {
      return await readFile(file);
    } catch {
      return null;
    }
  }
  return fetchBytes(raw);
}

export async function renderAdvisorPwaIconPng(
  brand: AdvisorPwaBrand,
  size: number
): Promise<Buffer> {
  const sharp = (await import('sharp')).default;
  const dim = size === 180 || size === 192 ? size : 512;
  const bg = hexRgb(brand.themeColor || brand.backgroundColor);
  const source = await loadLogoBytes(brand.iconUrl, dim);
  if (!source) {
    const fallback = await loadLogoBytes('/sa-icon-512.png', dim);
    if (!fallback) {
      return sharp({
        create: {
          width: dim,
          height: dim,
          channels: 4,
          background: bg,
        },
      })
        .png()
        .toBuffer();
    }
    return squarePng(sharp, fallback, dim, bg);
  }
  return squarePng(sharp, source, dim, bg);
}

async function squarePng(
  sharp: typeof import('sharp'),
  source: Buffer,
  dim: number,
  bg: { r: number; g: number; b: number; alpha: number }
): Promise<Buffer> {
  const pad = Math.round(dim * 0.1);
  const inner = Math.max(32, dim - pad * 2);
  try {
    return await sharp(source)
      .resize(inner, inner, { fit: 'contain', background: bg })
      .extend({
        top: pad,
        bottom: pad,
        left: pad,
        right: pad,
        background: bg,
      })
      .png()
      .toBuffer();
  } catch {
    return source;
  }
}
