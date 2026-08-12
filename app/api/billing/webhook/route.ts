/**
 * Alias for Paystack webhooks.
 *
 * Canonical path (configure in Paystack Dashboard):
 *   https://www.supplieradvisor.com/api/paystack/webhook
 *
 * Also accepted:
 *   https://www.supplieradvisor.com/api/billing/webhook
 *
 * Both share the same handler so either dashboard URL works.
 */
export {
  POST,
  GET,
  runtime,
} from '@/app/api/paystack/webhook/route';
