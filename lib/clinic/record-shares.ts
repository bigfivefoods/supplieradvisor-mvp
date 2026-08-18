/**
 * Persist consented patient-record shares on clinic Advisor stores.
 */
import type { PatientRecordShareGrant } from '@/lib/services/advisor-b2c-relationship';

const STATUSES = new Set(['pending', 'active', 'revoked', 'expired']);
const SCOPES = new Set([
  'summary',
  'treatment_plan',
  'scripts',
  'clinical_notes',
  'imaging_docs',
  'full_chart',
]);

export function normalizeRecordShares(raw: unknown): PatientRecordShareGrant[] {
  if (!Array.isArray(raw)) return [];
  const out: PatientRecordShareGrant[] = [];
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue;
    const r = row as Record<string, unknown>;
    const toRaw = r.to;
    if (!toRaw || typeof toRaw !== 'object') continue;
    const t = toRaw as Record<string, unknown>;
    let to: PatientRecordShareGrant['to'] | null = null;
    if (t.type === 'patient') to = { type: 'patient' };
    else if (t.type === 'practitioner' && String(t.practitioner_id || '').trim()) {
      to = {
        type: 'practitioner',
        practitioner_id: String(t.practitioner_id),
        label: t.label != null ? String(t.label) : undefined,
      };
    } else if (t.type === 'professional' && Number(t.company_id) > 0) {
      to = {
        type: 'professional',
        company_id: Number(t.company_id),
        module: (String(t.module || 'medical') || 'medical') as Extract<
          PatientRecordShareGrant['to'],
          { type: 'professional' }
        >['module'],
        label: t.label != null ? String(t.label) : undefined,
      };
    }
    if (!to) continue;
    const scopes = Array.isArray(r.scopes)
      ? r.scopes
          .map((s) => String(s))
          .filter((s): s is PatientRecordShareGrant['scopes'][number] =>
            SCOPES.has(s)
          )
      : [];
    const status = STATUSES.has(String(r.status))
      ? (r.status as PatientRecordShareGrant['status'])
      : 'pending';
    out.push({
      id: String(r.id || ''),
      person_id: String(r.person_id || ''),
      from_company_id: Number(r.from_company_id) || 0,
      from_module: String(r.from_module || 'medical') as PatientRecordShareGrant['from_module'],
      to,
      scopes,
      status,
      requested_by: r.requested_by === 'patient' ? 'patient' : 'practice',
      note: r.note != null ? String(r.note) : null,
      created_at: String(r.created_at || new Date().toISOString()),
      decided_at: r.decided_at != null ? String(r.decided_at) : null,
      expires_at: r.expires_at != null ? String(r.expires_at) : null,
      consented_at: r.consented_at != null ? String(r.consented_at) : null,
      consent_source:
        r.consent_source === 'desk' || r.consent_source === 'patient'
          ? r.consent_source
          : null,
    });
  }
  return out.filter((g) => g.id && g.person_id);
}
