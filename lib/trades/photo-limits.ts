/**
 * Customer and site photos are stored as JPEG data URLs, not a storage bucket.
 * 1280px on the long edge at quality 0.72 is enough to see a board, a leak, or
 * a room on a phone. If that is still over the cap, smaller steps are tried.
 * The character cap matches trade_portal_call in 20261014_tradegraph.sql.
 */
export const TRADE_PHOTO_MAX_EDGE = 1280;
export const TRADE_PHOTO_EDGE_STEPS = [1280, 960, 720] as const;
export const TRADE_PHOTO_QUALITIES = [0.72, 0.6, 0.5] as const;
export const TRADE_PHOTO_MAX_CHARS = 400_000;
export const TRADE_PHOTO_MAX_COUNT = 3;
/** Refuse decode of huge originals so a phone does not freeze. */
export const TRADE_PHOTO_MAX_FILE_BYTES = 12_000_000;
