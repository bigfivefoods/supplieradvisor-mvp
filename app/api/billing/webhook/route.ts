/**
 * Alias for Paystack webhooks.
 *
 * Canonical path (configure in Paystack Dashboard):
 *   https://www.supplieradvisor.com/api/paystack/webhook
 *
 * Also accepted:
 *   https://www.supplieradvisor.com/api/billing/webhook
 *
 * Handlers are re-exported; `runtime` must be declared here (Next.js forbids re-exporting route segment config).
 */
export const runtime = 'nodejs';

export { POST, GET } from '@/app/api/paystack/webhook/route';
