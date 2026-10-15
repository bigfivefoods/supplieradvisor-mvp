/** Stop ids that already belong to another job cannot be reused. Pure, no database client. */

export const STOP_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function stopRowsConflict(
  rows: Array<{ id?: string; job_id?: string | null; company_id?: number | null }>,
  companyId: number,
  jobId: string | null
): boolean {
  return rows.some((row) => Number(row.company_id) !== companyId || String(row.job_id || '') !== (jobId || ''));
}
