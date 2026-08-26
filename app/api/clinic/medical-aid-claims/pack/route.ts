/**
 * GET ?companyId=&module=&patientId=&claimId= → claim pack PDF
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server-client';
import {
  requireCompanyAccess,
  legacyPrivyFrom,
} from '@/lib/auth/api-auth';
import { readMedicalgraphFromMetadata } from '@/lib/clinic/medicalgraph';
import { readPhysiographFromMetadata } from '@/lib/clinic/physiograph';
import { readDentalgraphFromMetadata } from '@/lib/dental/dentalgraph';
import { readPsychiatrygraphFromMetadata } from '@/lib/clinic/psychiatrygraph';
import { readVetgraphFromMetadata } from '@/lib/clinic/vetgraph';
import { billingFromSettings } from '@/lib/clinic/medical-aid-claims';
import { buildMedicalAidClaimPdf } from '@/lib/clinic/medical-aid-claim-pdf';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const companyId = Number(request.nextUrl.searchParams.get('companyId'));
    const module = String(request.nextUrl.searchParams.get('module') || '');
    const patientId = String(request.nextUrl.searchParams.get('patientId') || '');
    const claimId = String(request.nextUrl.searchParams.get('claimId') || '');
    if (!Number.isFinite(companyId) || !module || !patientId || !claimId) {
      return NextResponse.json({ error: 'Missing pack params' }, { status: 400 });
    }
    const gate = await requireCompanyAccess(request, companyId, {
      legacyPrivyUserId: legacyPrivyFrom(request),
    });
    if (!gate.ok) return gate.response;

    const supabase = getSupabaseServer();
    const { data } = await supabase
      .from('profiles')
      .select('metadata')
      .eq('id', companyId)
      .maybeSingle();
    const meta =
      data?.metadata && typeof data.metadata === 'object'
        ? (data.metadata as Record<string, unknown>)
        : {};
    const store =
      module === 'physiograph'
        ? readPhysiographFromMetadata(meta)
        : module === 'dentalgraph'
          ? readDentalgraphFromMetadata(meta)
          : module === 'psychiatrygraph'
            ? readPsychiatrygraphFromMetadata(meta)
            : module === 'vetgraph'
              ? readVetgraphFromMetadata(meta)
            : readMedicalgraphFromMetadata(meta);
    const patient = store.patients.find((p) => p.id === patientId);
    const claim = (patient?.medical?.claims || []).find((c) => c.id === claimId);
    if (!patient || !claim) {
      return NextResponse.json({ error: 'Claim not found' }, { status: 404 });
    }
    const pdf = await buildMedicalAidClaimPdf({
      practice: billingFromSettings(store.settings),
      patientName: patient.name,
      patientCode: patient.code,
      medical: patient.medical,
      claim,
      moduleLabel:
        module === 'physiograph'
          ? 'PhysioAdvisor®'
          : module === 'dentalgraph'
            ? 'DentalAdvisor®'
            : module === 'psychiatrygraph'
              ? 'PsychiatryAdvisor®'
              : module === 'vetgraph'
                ? 'VetAdvisor®'
              : 'MedicalAdvisor®',
    });
    const name = `${claim.claim_number || 'claim'}.pdf`;
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${name}"`,
      },
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Pack failed' },
      { status: 500 }
    );
  }
}
