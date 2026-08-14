/**
 * Qualifications + certificates on coach / clinician bios.
 */

export type QualificationCertificate = {
  id: string;
  file_name: string;
  url: string;
  uploaded_at: string;
};

export type PersonQualification = {
  id: string;
  title: string;
  issuer?: string;
  year?: string | null;
  registration_number?: string;
  notes?: string;
  /** When false, hidden on the public website (still on desk + portal). */
  public?: boolean;
  certificates: QualificationCertificate[];
  created_at: string;
};

export function newQualificationId(prefix = 'qual'): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function parseCertificates(raw: unknown): QualificationCertificate[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((row) => {
      const r = row as Record<string, unknown>;
      const url = String(r.url || '').trim();
      if (!url) return null;
      return {
        id: String(r.id || newQualificationId('qcert')),
        file_name: String(r.file_name || r.name || 'certificate'),
        url,
        uploaded_at: String(r.uploaded_at || new Date().toISOString()),
      } satisfies QualificationCertificate;
    })
    .filter((c): c is QualificationCertificate => Boolean(c));
}

export function parseQualifications(raw: unknown): PersonQualification[] {
  if (!Array.isArray(raw)) return [];
  const out: PersonQualification[] = [];
  for (const row of raw) {
    const r = row as Record<string, unknown>;
    const title = String(r.title || r.name || '').trim();
    if (!title) continue;
    const certs = parseCertificates(
      r.certificates ||
        (r.certificate && typeof r.certificate === 'object'
          ? [r.certificate]
          : [])
    );
    out.push({
      id: String(r.id || newQualificationId()),
      title,
      issuer: r.issuer ? String(r.issuer) : undefined,
      year: r.year != null && String(r.year).trim() ? String(r.year).trim() : null,
      registration_number: r.registration_number
        ? String(r.registration_number)
        : r.number
          ? String(r.number)
          : undefined,
      notes: r.notes ? String(r.notes) : undefined,
      public: r.public !== false,
      certificates: certs,
      created_at: String(r.created_at || new Date().toISOString()),
    });
    if (out.length >= 40) break;
  }
  return out;
}

export function publicQualifications(
  raw: PersonQualification[] | unknown
): Array<{
  title: string;
  issuer?: string;
  year?: string | null;
  registration_number?: string;
  certificates: Array<{ file_name: string; url: string }>;
}> {
  return parseQualifications(raw)
    .filter((q) => q.public !== false)
    .map((q) => ({
      title: q.title,
      issuer: q.issuer,
      year: q.year,
      registration_number: q.registration_number,
      certificates: q.certificates.map((c) => ({
        file_name: c.file_name,
        url: c.url,
      })),
    }));
}

export function formatQualificationLine(q: {
  title: string;
  issuer?: string;
  year?: string | null;
}): string {
  const bits = [q.title];
  if (q.issuer) bits.push(q.issuer);
  if (q.year) bits.push(String(q.year));
  return bits.join(' · ');
}
