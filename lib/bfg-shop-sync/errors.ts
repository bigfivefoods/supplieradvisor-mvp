/** Error codes, HTTP statuses and retryable flags from contract section 5.2. */
import { CONTRACT_VERSION } from './config';

export type SyncErrorCode =
  | 'bad_signature'
  | 'stale_timestamp'
  | 'bad_request'
  | 'validation_failed'
  | 'unsupported_version'
  | 'unknown_event'
  | 'profile_not_allowed'
  | 'origin_not_allowed'
  | 'invoice_not_found'
  | 'order_not_synced'
  | 'conflict_in_progress'
  | 'totals_changed'
  | 'payment_against_void'
  | 'void_after_paid'
  | 'amount_mismatch'
  | 'unmapped_product'
  | 'totals_mismatch'
  | 'customer_unresolvable'
  | 'rate_limited'
  | 'internal_error'
  | 'unavailable';

const TABLE: Record<SyncErrorCode, { status: number; retryable: boolean }> = {
  bad_signature: { status: 401, retryable: false },
  stale_timestamp: { status: 401, retryable: true },
  bad_request: { status: 400, retryable: false },
  validation_failed: { status: 400, retryable: false },
  unsupported_version: { status: 400, retryable: false },
  unknown_event: { status: 400, retryable: false },
  profile_not_allowed: { status: 403, retryable: false },
  origin_not_allowed: { status: 403, retryable: false },
  invoice_not_found: { status: 404, retryable: false },
  order_not_synced: { status: 409, retryable: true },
  conflict_in_progress: { status: 409, retryable: true },
  totals_changed: { status: 409, retryable: false },
  payment_against_void: { status: 409, retryable: false },
  void_after_paid: { status: 409, retryable: false },
  amount_mismatch: { status: 409, retryable: false },
  unmapped_product: { status: 422, retryable: false },
  totals_mismatch: { status: 422, retryable: false },
  customer_unresolvable: { status: 422, retryable: false },
  rate_limited: { status: 429, retryable: true },
  internal_error: { status: 500, retryable: true },
  unavailable: { status: 503, retryable: true },
};

/** Thrown inside the handlers; turned into the section 5.2 body by the route. */
export class SyncError extends Error {
  readonly code: SyncErrorCode;
  readonly status: number;
  readonly retryable: boolean;
  readonly details: Record<string, unknown> | null;

  constructor(
    code: SyncErrorCode,
    message: string,
    details?: Record<string, unknown> | null
  ) {
    super(message);
    this.name = 'SyncError';
    this.code = code;
    this.status = TABLE[code].status;
    this.retryable = TABLE[code].retryable;
    this.details = details ?? null;
  }
}

export type SyncErrorBody = {
  ok: false;
  contract_version: string;
  error: {
    code: SyncErrorCode;
    message: string;
    retryable: boolean;
    details?: Record<string, unknown>;
  };
};

export function errorBody(err: SyncError): SyncErrorBody {
  return {
    ok: false,
    contract_version: CONTRACT_VERSION,
    error: {
      code: err.code,
      message: err.message,
      retryable: err.retryable,
      ...(err.details ? { details: err.details } : {}),
    },
  };
}
