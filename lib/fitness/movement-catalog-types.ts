/** Shared catalog row types — no imports, safe for extra + core files. */

export type MovementLevel = 'beginner' | 'intermediate' | 'advanced';

export type CatalogDraft = {
  code: string;
  name: string;
  category: string;
  equipment: string;
  muscles: string;
  level: MovementLevel;
  overview: string;
  details: string;
};
