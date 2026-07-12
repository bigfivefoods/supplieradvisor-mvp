/**
 * Auto-raise NCR (+ optional CAPA draft) when a QA inspection fails.
 * Idempotent on inspection_id.
 */
import { getSupabaseServer } from '@/lib/supabase/server-client';
import { formatRef } from '@/lib/sheq/types';
import { auditLog } from '@/lib/audit/log';

type InspectionLike = {
  id: number;
  lot_number?: string | null;
  product_id?: number | null;
  status?: string | null;
  defects_found?: number | null;
  notes?: string | null;
  inspector_name?: string | null;
  inspection_type?: string | null;
};

export async function ensureNcrForFailedInspection(opts: {
  companyId: number;
  actorUserId?: string | null;
  inspection: InspectionLike;
  createCapa?: boolean;
}): Promise<{ ncrId: number | null; capaId: number | null; created: boolean; error?: string }> {
  const { companyId, inspection } = opts;
  if (String(inspection.status || '').toLowerCase() !== 'failed') {
    return { ncrId: null, capaId: null, created: false };
  }

  const supabase = getSupabaseServer();

  // Idempotent: existing NCR for this inspection
  const { data: existing, error: findErr } = await supabase
    .from('sheq_ncrs')
    .select('id, capa_id')
    .eq('profile_id', companyId)
    .eq('inspection_id', inspection.id)
    .maybeSingle();

  if (findErr) {
    if (/does not exist|schema cache|column/i.test(findErr.message)) {
      return {
        ncrId: null,
        capaId: null,
        created: false,
        error: 'SHEQ tables missing — run 20260712_sheq_module.sql',
      };
    }
    return { ncrId: null, capaId: null, created: false, error: findErr.message };
  }

  if (existing?.id) {
    return {
      ncrId: Number(existing.id),
      capaId: existing.capa_id != null ? Number(existing.capa_id) : null,
      created: false,
    };
  }

  const lot = inspection.lot_number ? String(inspection.lot_number) : null;
  const title = lot
    ? `QA fail — lot ${lot}`
    : `QA inspection #${inspection.id} failed`;
  const description = [
    `Auto-raised from quality inspection #${inspection.id}.`,
    inspection.inspection_type ? `Type: ${inspection.inspection_type}.` : null,
    inspection.defects_found != null ? `Defects: ${inspection.defects_found}.` : null,
    inspection.inspector_name ? `Inspector: ${inspection.inspector_name}.` : null,
    inspection.notes ? `Notes: ${inspection.notes}` : null,
  ]
    .filter(Boolean)
    .join(' ');

  const now = new Date().toISOString();
  const { data: ncr, error: ncrErr } = await supabase
    .from('sheq_ncrs')
    .insert({
      profile_id: companyId,
      source: 'inspection',
      domain: 'quality',
      status: 'open',
      severity: 'high',
      title,
      description,
      lot_number: lot,
      product_id: inspection.product_id ?? null,
      inspection_id: inspection.id,
      raised_by: opts.actorUserId || inspection.inspector_name || null,
      raised_at: now,
      containment: lot
        ? `Lot ${lot} remains on hold until disposition / CAPA.`
        : 'Affected product/lot on hold pending disposition.',
      created_by: opts.actorUserId || null,
      updated_at: now,
    })
    .select('id')
    .single();

  if (ncrErr || !ncr) {
    return {
      ncrId: null,
      capaId: null,
      created: false,
      error: ncrErr?.message || 'Failed to create NCR',
    };
  }

  const ncrId = Number(ncr.id);
  // Set public_ref
  await supabase
    .from('sheq_ncrs')
    .update({ public_ref: formatRef('NCR', ncrId) })
    .eq('id', ncrId);

  let capaId: number | null = null;
  const wantCapa = opts.createCapa !== false;

  if (wantCapa) {
    const { data: capa, error: capaErr } = await supabase
      .from('sheq_capas')
      .insert({
        profile_id: companyId,
        ncr_id: ncrId,
        title: `CAPA — ${title}`,
        description: `Draft CAPA for failed inspection #${inspection.id}. Complete root cause and actions.`,
        status: 'open',
        priority: 'high',
        created_by: opts.actorUserId || null,
        updated_at: now,
      })
      .select('id')
      .single();

    if (!capaErr && capa) {
      capaId = Number(capa.id);
      await supabase
        .from('sheq_capas')
        .update({ public_ref: formatRef('CAPA', capaId) })
        .eq('id', capaId);
      await supabase
        .from('sheq_ncrs')
        .update({
          capa_id: capaId,
          status: 'capa_linked',
          updated_at: now,
        })
        .eq('id', ncrId);
    }
  }

  void auditLog({
    companyId,
    actorUserId: opts.actorUserId,
    action: 'sheq.ncr.auto_from_inspection',
    entityType: 'sheq_ncr',
    entityId: ncrId,
    summary: `NCR ${formatRef('NCR', ncrId)} raised from failed inspection #${inspection.id}`,
    metadata: {
      inspectionId: inspection.id,
      lot_number: lot,
      capaId,
    },
  });

  return { ncrId, capaId, created: true };
}
