/**
 * Browser Paystack helpers — InlineJS v2 + Apple Pay channels.
 * Load script: https://js.paystack.co/v2/inline.js
 *
 * Apple Pay requires:
 * - Paystack Dashboard → Preferences → enable Apple Pay
 * - Domain registered + .well-known verification file hosted
 * - HTTPS (production)
 */

export const PAYSTACK_CHANNELS_DEFAULT = [
  'card',
  'bank',
  'ussd',
  'qr',
  'mobile_money',
  'bank_transfer',
  'eft',
  'apple_pay',
] as const;

export type PaystackChannel = (typeof PAYSTACK_CHANNELS_DEFAULT)[number];

export type PaystackCheckoutOpts = {
  key: string;
  email: string;
  /** Amount in minor units (cents for ZAR) */
  amountCents: number;
  currency?: string;
  ref: string;
  metadata?: Record<string, unknown>;
  channels?: string[];
  onSuccess: (reference: string, raw?: Record<string, unknown>) => void;
  onClose?: () => void;
  onError?: (err: unknown) => void;
};

type PaystackPopV2 = {
  newTransaction?: (opts: Record<string, unknown>) => void;
  checkout?: (opts: Record<string, unknown>) => Promise<void> | void;
  paymentRequest?: (opts: Record<string, unknown>) => Promise<void> | void;
  setup?: (opts: Record<string, unknown>) => { openIframe: () => void };
};

declare global {
  interface Window {
    PaystackPop?: (new () => PaystackPopV2) & PaystackPopV2 & {
      setup?: (opts: Record<string, unknown>) => { openIframe: () => void };
    };
  }
}

export function getPaystackPublicKey(): string | null {
  const k = process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY || '';
  return k.trim() || null;
}

/** Detect likely Apple Pay environment (Safari / iOS) */
export function likelyApplePayEnvironment(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const isIOS = /iPhone|iPad|iPod/i.test(ua);
  const isSafari =
    /Safari/i.test(ua) &&
    !/Chrome|CriOS|FxiOS|EdgiOS|OPiOS|Android/i.test(ua);
  return isIOS || isSafari;
}

function metadataToCustomFields(
  meta: Record<string, unknown> | undefined
): Array<{ display_name: string; variable_name: string; value: string }> {
  if (!meta) return [];
  return Object.entries(meta).map(([k, v]) => ({
    display_name: k.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    variable_name: k,
    value: v == null ? '' : String(v),
  }));
}

/**
 * Open Paystack checkout with Apple Pay channel available.
 * Prefers InlineJS v2 `checkout` / `newTransaction`; falls back to v1 `setup`.
 */
export async function openPaystackCheckout(
  opts: PaystackCheckoutOpts
): Promise<void> {
  const Pop = window.PaystackPop;
  if (!Pop) {
    throw new Error('Paystack is still loading — try again in a moment');
  }

  const channels = opts.channels || [...PAYSTACK_CHANNELS_DEFAULT];
  const currency = opts.currency || 'ZAR';
  const baseMeta = {
    custom_fields: metadataToCustomFields(opts.metadata),
    ...opts.metadata,
  };

  const onSuccess = (response: { reference?: string } & Record<string, unknown>) => {
    opts.onSuccess(String(response?.reference || opts.ref), response);
  };

  // v2 instance API
  try {
    const isCtor = typeof Pop === 'function';
    const instance: PaystackPopV2 = isCtor
      ? new (Pop as new () => PaystackPopV2)()
      : (Pop as PaystackPopV2);

    const payload: Record<string, unknown> = {
      key: opts.key,
      email: opts.email,
      amount: opts.amountCents,
      currency,
      ref: opts.ref,
      reference: opts.ref,
      channels,
      metadata: baseMeta,
      onSuccess,
      callback: onSuccess, // v1-style
      onCancel: () => opts.onClose?.(),
      onClose: () => opts.onClose?.(),
      onError: (e: unknown) => opts.onError?.(e),
    };

    // Prefer checkout() — shows Apple Pay pre-modal on Safari/iOS
    if (typeof instance.checkout === 'function') {
      await instance.checkout(payload);
      return;
    }
    if (typeof instance.newTransaction === 'function') {
      instance.newTransaction(payload);
      return;
    }
  } catch (e) {
    // fall through to v1
    console.warn('[paystack] v2 checkout failed, trying setup()', e);
  }

  // v1 setup + openIframe (still passes channels if supported)
  const setupFn =
    typeof (Pop as { setup?: unknown }).setup === 'function'
      ? (Pop as { setup: (o: Record<string, unknown>) => { openIframe: () => void } })
          .setup
      : null;
  if (!setupFn) {
    throw new Error(
      'Paystack checkout API not available. Ensure js.paystack.co/v2/inline.js is loaded.'
    );
  }
  const handler = setupFn({
    key: opts.key,
    email: opts.email,
    amount: opts.amountCents,
    currency,
    ref: opts.ref,
    channels,
    metadata: baseMeta,
    callback: onSuccess,
    onClose: () => opts.onClose?.(),
  });
  handler.openIframe();
}

/**
 * Mount Apple Pay button into a container (InlineJS v2 paymentRequest).
 * Returns whether Apple Pay element mounted.
 */
export async function mountPaystackApplePay(opts: {
  key: string;
  email: string;
  amountCents: number;
  currency?: string;
  ref: string;
  containerId: string;
  otherChannelsButtonId?: string;
  metadata?: Record<string, unknown>;
  onSuccess: (reference: string) => void;
  onCancel?: () => void;
  onError?: (err: unknown) => void;
}): Promise<boolean> {
  const Pop = window.PaystackPop;
  if (!Pop) return false;
  const isCtor = typeof Pop === 'function';
  const instance: PaystackPopV2 = isCtor
    ? new (Pop as new () => PaystackPopV2)()
    : (Pop as PaystackPopV2);
  if (typeof instance.paymentRequest !== 'function') return false;

  let mounted = false;
  await instance.paymentRequest({
    key: opts.key,
    email: opts.email,
    amount: opts.amountCents,
    currency: opts.currency || 'ZAR',
    ref: opts.ref,
    reference: opts.ref,
    container: opts.containerId,
    loadPaystackCheckoutButton: opts.otherChannelsButtonId,
    channels: ['apple_pay', 'card', 'bank', 'ussd', 'mobile_money', 'bank_transfer'],
    metadata: {
      custom_fields: metadataToCustomFields(opts.metadata),
      ...opts.metadata,
    },
    style: {
      theme: 'dark',
      applePay: {
        width: '100%',
        borderRadius: '12px',
        type: 'pay',
        locale: 'en',
        margin: '0',
        padding: '0',
      },
    },
    onSuccess: (response: { reference?: string }) => {
      opts.onSuccess(String(response?.reference || opts.ref));
    },
    onCancel: () => opts.onCancel?.(),
    onError: (e: unknown) => opts.onError?.(e),
    onElementsMount: (elements: { applePay?: boolean } | null) => {
      mounted = Boolean(elements?.applePay);
    },
  });
  return mounted;
}
