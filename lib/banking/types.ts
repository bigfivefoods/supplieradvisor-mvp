/** Canonical bank middleware types — shared by API, PDF/CSV, BankLink. */

export type BankProviderId = 'banklink' | 'fnb' | 'csv' | 'pdf' | 'sandbox' | 'ofx';

export type CanonicalTxn = {
  provider: BankProviderId;
  provider_txn_id: string;
  booked_at: string; // YYYY-MM-DD
  amount: number; // signed: +in, −out
  currency: string;
  description: string;
  reference: string | null;
  counterparty: string | null;
  balance_after: number | null;
  raw?: Record<string, unknown>;
};

export type BankConnectionRow = {
  id: number;
  profile_id: number;
  bank_account_id?: number | null;
  provider: string;
  external_connection_id?: string | null;
  external_account_id?: string | null;
  status: string;
  bank_name?: string | null;
  account_name?: string | null;
  account_mask?: string | null;
  currency?: string | null;
  consent_expires_at?: string | null;
  last_sync_at?: string | null;
  last_error?: string | null;
  link_session_id?: string | null;
  metadata?: Record<string, unknown> | null;
  created_by?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type IngestResult = {
  fetched: number;
  inserted: number;
  duplicates: number;
  errors: number;
  batch_id?: number | null;
  sync_run_id?: number | null;
  error_message?: string;
  auto_matched?: number;
};

export type LinkSessionResult = {
  connectionId: number;
  sessionId: string;
  /** Hosted link URL (BankLink) or in-app callback (sandbox) */
  url: string;
  mode: 'live' | 'sandbox';
  message?: string;
};
