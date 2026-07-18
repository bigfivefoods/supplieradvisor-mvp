/**
 * Resolve ops alert recipient list from any supported env name.
 * Production historically used OPS_EMAIL_ALERT; code also accepts OPS_ALERT_EMAIL.
 */
export function getOpsAlertEmails(): string[] {
  const raw = [
    process.env.OPS_ALERT_EMAIL,
    process.env.OPS_EMAIL_ALERT,
    process.env.PAYSTACK_OPS_EMAIL,
    process.env.RESEND_REPLY_TO,
  ]
    .filter(Boolean)
    .join(',');
  return raw
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.includes('@'));
}

export function hasOpsAlertEmail(): boolean {
  return getOpsAlertEmails().length > 0;
}
