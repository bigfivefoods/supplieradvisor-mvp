/** Shared geo reference types — backed by Supabase continents / countries / provinces */

export type GeoContinent = {
  id: number;
  name: string;
};

export type GeoCountry = {
  id: number;
  name: string;
  flag?: string | null;
  continent_id?: number | null;
  iso2?: string | null;
};

export type GeoProvince = {
  id: number;
  name: string;
  country_id?: number | null;
};

export type GeoValue = {
  continent: string;
  country: string;
  province: string;
  city: string;
};

export const EMPTY_GEO: GeoValue = {
  continent: '',
  country: '',
  province: '',
  city: '',
};
