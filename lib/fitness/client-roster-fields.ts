/**
 * Roster/contract fields live on subscriptions via allocate_member /
 * set_class_members. A clients upsert must not carry them.
 */
export const CLIENT_ROSTER_FIELD_KEYS = [
  'membership_plan_id',
  'private_client',
  'membership_status',
  'agreed_rate_zar',
  'private_rate_zar',
  'active',
] as const;

export function omitClientRosterFields(
  record: object
): Record<string, unknown> {
  const next = { ...(record as Record<string, unknown>) };
  for (const key of CLIENT_ROSTER_FIELD_KEYS) {
    delete next[key];
  }
  return next;
}
