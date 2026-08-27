/**
 * Email logo sizing. Wordmarks must keep native ratio; never force a square.
 * public/sa-logo.png is 640×277. Unknown company logos use a max box + contain.
 */
import { SA_LOGO_NATIVE, saLogoBox } from '@/lib/brand/assets';

function esc(s: string): string {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/"/g, '&quot;');
}

export function isSaWordmarkSrc(src: string | null | undefined): boolean {
  const s = String(src || '').toLowerCase();
  if (s.includes('sa-logo-tick')) return false;
  return s.includes('sa-logo.png') || s.includes('sa-logo.jpg');
}

export function isProtectedSquareEmailSrc(
  src: string | null | undefined,
  alt?: string | null
): boolean {
  const h = `${src || ''} ${alt || ''}`.toLowerCase();
  return /qr|barcode|apple-touch|favicon|sa-icon-|sa-logo-tick|icon-192|icon-512/.test(
    h
  );
}

export function emailSaWordmark(opts: {
  src: string;
  alt?: string;
  height: number;
  maxWidth?: number;
  margin?: string;
}): string {
  const box = saLogoBox(opts.height);
  const maxW = opts.maxWidth ?? Math.max(box.width, 180);
  const margin = opts.margin || '0 auto';
  return `<img src="${esc(opts.src)}" alt="${esc(opts.alt || 'SupplierAdvisor')}" width="${box.width}" height="${box.height}" style="display:block;margin:${margin};width:${box.width}px;height:${box.height}px;max-width:${maxW}px;border:0;outline:none;" />`;
}

/** Unknown company / brand mark — constrain a box, never stretch. */
export function emailContainLogo(opts: {
  src: string;
  alt?: string;
  maxHeight: number;
  maxWidth?: number;
}): string {
  const maxH = Math.max(1, Math.round(opts.maxHeight));
  const maxW = Math.max(maxH, Math.round(opts.maxWidth || 240));
  return `<img src="${esc(opts.src)}" alt="${esc(opts.alt || 'Logo')}" height="${maxH}" style="display:block;margin:0 auto;max-height:${maxH}px;max-width:${maxW}px;width:auto;height:auto;object-fit:contain;object-position:center;border:0;outline:none;" />`;
}

function attr(tag: string, name: string): string | null {
  const m = tag.match(
    new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i')
  );
  if (!m) return null;
  return m[2] ?? m[3] ?? m[4] ?? null;
}

function parsePx(raw: string | null | undefined): number | null {
  if (raw == null || raw === '') return null;
  const n = Number.parseFloat(String(raw).replace(/px$/i, '').trim());
  return Number.isFinite(n) && n > 0 ? n : null;
}

function styleMap(style: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of String(style || '').split(';')) {
    const i = part.indexOf(':');
    if (i < 0) continue;
    const k = part.slice(0, i).trim().toLowerCase();
    const v = part.slice(i + 1).trim();
    if (k) out[k] = v;
  }
  return out;
}

function styleStr(map: Record<string, string>): string {
  return Object.entries(map)
    .filter(([, v]) => v != null && String(v).trim() !== '')
    .map(([k, v]) => `${k}:${v}`)
    .join(';');
}

function looksLikeLogo(src: string, alt: string, tag: string): boolean {
  const h = `${src} ${alt} ${tag}`.toLowerCase();
  return /logo|wordmark|brand.?mark/.test(h);
}

function saHeightFromBox(
  width: number | null,
  height: number | null
): number {
  if (width && height && Math.abs(width - height) < 1) {
    return height >= 50 ? 58 : 36;
  }
  if (height) return Math.round(height);
  if (width) {
    return Math.round((width * SA_LOGO_NATIVE.height) / SA_LOGO_NATIVE.width);
  }
  return 36;
}

function rewriteOneImg(tag: string): string {
  const src = attr(tag, 'src') || '';
  const alt = attr(tag, 'alt') || '';
  if (!src) return tag;
  if (isProtectedSquareEmailSrc(src, alt)) return tag;

  const styles = styleMap(attr(tag, 'style') || '');
  const w = parsePx(attr(tag, 'width') || styles.width);
  const h = parsePx(attr(tag, 'height') || styles.height);
  const margin = styles.margin || '';

  if (isSaWordmarkSrc(src)) {
    const height = saHeightFromBox(w, h);
    const maxWidth = parsePx(styles['max-width']) || undefined;
    return emailSaWordmark({
      src,
      alt: alt || 'SupplierAdvisor',
      height,
      maxWidth,
      margin: margin || (height <= 40 ? '16px auto 10px' : '0 auto'),
    });
  }

  if (!looksLikeLogo(src, alt, tag)) {
    if (w && h && Math.abs(w - h) < 1) return tag;
    if (!styles['object-fit']) return tag;
    return tag;
  }

  styles['object-fit'] = 'contain';
  styles['object-position'] = 'center';
  styles['border'] = styles['border'] || '0';
  styles['outline'] = styles['outline'] || 'none';
  styles['display'] = styles['display'] || 'block';

  if (w && h && Math.abs(w - h) < 1) {
    styles['width'] = 'auto';
    styles['height'] = 'auto';
    styles['max-height'] = `${Math.round(h)}px`;
    styles['max-width'] = styles['max-width'] || `${Math.max(Math.round(h) * 3, 180)}px`;
    const style = styleStr(styles);
    return `<img src="${esc(src)}" alt="${esc(alt)}" height="${Math.round(h)}" style="${style}" />`;
  }

  styles['width'] = 'auto';
  styles['height'] = 'auto';
  if (h) styles['max-height'] = styles['max-height'] || `${Math.round(h)}px`;
  if (w) styles['max-width'] = styles['max-width'] || `${Math.round(w)}px`;
  else styles['max-width'] = styles['max-width'] || '240px';
  const heightAttr = h ? ` height="${Math.round(h)}"` : '';
  return `<img src="${esc(src)}" alt="${esc(alt)}"${heightAttr} style="${styleStr(styles)}" />`;
}

/** Rewrite logo <img> tags in any HTML so they are never stretched. */
export function unstretchEmailLogos(html: string): string {
  const raw = String(html || '');
  if (!raw.includes('<img')) return raw;
  return raw.replace(/<img\b[^>]*>/gi, rewriteOneImg);
}
