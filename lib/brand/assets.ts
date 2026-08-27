/**
 * Canonical SupplierAdvisor brand assets (public/ + App Router OG).
 * Updated monogram: SA + check (from "SA UPDATED LOGO").
 */
export const SA_LOGO_SRC = '/sa-logo.png';
/** Native pixel size of public/sa-logo.png (wide wordmark, not a square). */
export const SA_LOGO_NATIVE = { width: 640, height: 277 } as const;
export const SA_LOGO_TICK_SRC = '/sa-logo-tick.png';
export const SA_LOGO_JPG_SRC = '/sa-logo.jpg';
export const SA_ICON_192 = '/sa-icon-192.png';
export const SA_ICON_512 = '/sa-icon-512.png';
/** 1200×630 social share (also app/opengraph-image.png + app/twitter-image.png) */
export const SA_OG_IMAGE = '/og-image.png';
/** Bump when OG art changes so crawlers fetch a fresh preview */
export const SA_OG_IMAGE_VERSION = '20260810';
export const SA_OG_IMAGE_URL = `${SA_OG_IMAGE}?v=${SA_OG_IMAGE_VERSION}`;

/** Pixel box that keeps the SA wordmark’s 640×277 ratio (email + Next/Image). */
export function saLogoBox(heightPx: number): { width: number; height: number } {
  const height = Math.max(1, Math.round(Number(heightPx) || 0));
  const width = Math.max(
    1,
    Math.round((height * SA_LOGO_NATIVE.width) / SA_LOGO_NATIVE.height)
  );
  return { width, height };
}
