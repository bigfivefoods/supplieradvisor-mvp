/**
 * Thin alias of POST/GET /api/paystack/webhook.
 * Configure Paystack Dashboard to the canonical path only:
 *   https://www.supplieradvisor.com/api/paystack/webhook
 */
export const runtime = 'nodejs';

export { POST, GET } from '@/app/api/paystack/webhook/route';
