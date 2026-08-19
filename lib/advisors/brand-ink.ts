/** Ink colour on a brand fill — dark text on pale yellow, white on deep hues. */
export function isLightBrand(color: string): boolean {
  const hex = color.replace('#', '').trim();
  if (hex.length !== 6) return false;
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  if ([r, g, b].some((n) => Number.isNaN(n))) return false;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.62;
}

export function advisorBrandInk(color: string): string {
  return isLightBrand(color) ? '#0f172a' : '#ffffff';
}
