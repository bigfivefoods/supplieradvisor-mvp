export type WatchSource = 'garmin' | 'apple_watch' | 'wear_os' | 'manual';

export type FitWatchSession = {
  id: string;
  client_id: string;
  booking_id?: string | null;
  session_id?: string | null;
  source: WatchSource | string;
  started_at: string;
  duration_min?: number | null;
  distance_km?: number | null;
  calories?: number | null;
  avg_hr?: number | null;
  max_hr?: number | null;
  activity_type?: string | null;
  garmin_activity_id?: string | null;
  created_at: string;
};

export type GarminConnection = {
  connected: boolean;
  user_id?: string | null;
  access_token?: string | null;
  refresh_token?: string | null;
  token_type?: string | null;
  expires_at?: string | null;
  connected_at?: string | null;
  last_sync_at?: string | null;
};

export type GarminOauthPending = {
  state: string;
  client_id: string;
  portal_token: string;
  code_verifier: string;
  created_at: string;
};
