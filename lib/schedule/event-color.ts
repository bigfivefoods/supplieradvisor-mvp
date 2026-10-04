/**
 * Hex colours on diary chips (class + coach). Named tones stay the fallback.
 */
export const CALENDAR_SWATCHES = [
  '#E8E830',
  '#FACC15',
  '#F59E0B',
  '#EA580C',
  '#F43F5E',
  '#EC4899',
  '#D946EF',
  '#8B5CF6',
  '#6366F1',
  '#0EA5E9',
  '#06B6D4',
  '#14B8A6',
  '#10B981',
  '#22C55E',
  '#84CC16',
  '#64748B',
  '#0F172A',
  '#FFFFFF',
] as const;

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const n = normalizeEventHex(hex) || '#e8e830';
  const h = n.replace('#', '');
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

export function rgbToHex(r: number, g: number, b: number): string {
  const c = (n: number) =>
    Math.max(0, Math.min(255, Math.round(Number(n) || 0)))
      .toString(16)
      .padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

export function normalizeEventHex(raw?: string | null): string | null {
  const s = String(raw || '').trim();
  if (/^#[0-9a-fA-F]{6}$/.test(s)) return s.toLowerCase();
  if (/^[0-9a-fA-F]{6}$/.test(s)) return `#${s.toLowerCase()}`;
  return null;
}

/** Mix hex toward white so chips stay readable. */
export function tintHex(hex: string, whiteMix = 0.78): string {
  const { r, g, b } = hexToRgb(hex);
  const t = Math.min(1, Math.max(0, whiteMix));
  const mix = (c: number) => Math.round(c + (255 - c) * t);
  const to = (n: number) => n.toString(16).padStart(2, '0');
  return `#${to(mix(r))}${to(mix(g))}${to(mix(b))}`;
}

export function eventColorStyle(
  fillHex: string,
  stripeHex?: string | null
): {
  backgroundColor: string;
  borderColor: string;
  color: string;
  boxShadow?: string;
  paddingLeft?: number;
} {
  const fill = normalizeEventHex(fillHex) || '#E8E830';
  const stripe = normalizeEventHex(stripeHex || '');
  return {
    backgroundColor: tintHex(fill, 0.78),
    borderColor: fill,
    color: '#0f172a',
    boxShadow: stripe && stripe !== fill ? `inset 4px 0 0 ${stripe}` : undefined,
    paddingLeft: stripe && stripe !== fill ? 8 : undefined,
  };
}
